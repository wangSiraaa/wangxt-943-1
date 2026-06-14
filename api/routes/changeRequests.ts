import { Router, type Request, type Response } from 'express'
import { getDb, all, get as getRow, run, persist } from '../database.js'
import { logStatusChange } from './emergency.js'
import crypto from 'crypto'

const router = Router()

function genId(): string {
  return crypto.randomUUID()
}

interface RecheckResult {
  passed: boolean
  errors: string[]
  checks: { certificate: boolean; berth: boolean; weather: boolean; inspection: boolean }
}

async function runChangeRechecks(
  db: Awaited<ReturnType<typeof getDb>>,
  planId: string,
  requestType: string,
  newValue: string
): Promise<RecheckResult> {
  const errors: string[] = []
  const checks = { certificate: true, berth: true, weather: true, inspection: true }
  const plan = getRow(db, 'SELECT * FROM plans WHERE id = ?', [planId])
  if (!plan) return { passed: false, errors: ['计划不存在'], checks }

  const shipId = plan.ship_id as string

  const expiredCerts = all(db, "SELECT type, expire_date FROM certificates WHERE ship_id = ? AND status = 'expired'", [shipId])
  if (expiredCerts.length > 0) {
    checks.certificate = false
    const types = expiredCerts.map(c => `${c.type}(${c.expire_date})`).join('、')
    errors.push(`船舶证书已过期: ${types}`)
  }

  const crewRows = all(db, 'SELECT crew_id FROM plan_crew WHERE plan_id = ?', [planId])
  if (crewRows.length > 0) {
    const placeholders = crewRows.map(() => '?').join(',')
    const crewIds = crewRows.map(r => r.crew_id as string)
    const blacklisted = all(db, `SELECT name FROM crew WHERE id IN (${placeholders}) AND is_blacklisted = 1`, crewIds)
    if (blacklisted.length > 0) {
      checks.certificate = false
      errors.push(`船员黑名单: ${blacklisted.map(c => c.name).join('、')}`)
    }
    const expiredQuals = all(db, `SELECT name, qualification_type, qualification_expire_date FROM crew WHERE id IN (${placeholders}) AND date(qualification_expire_date) < date('now')`, crewIds)
    if (expiredQuals.length > 0) {
      checks.certificate = false
      errors.push(`船员资质过期: ${expiredQuals.map(c => `${c.name}的${c.qualification_type}`).join('、')}`)
    }
  }

  const berthId = plan.berth_id as string | null
  if (berthId) {
    const berth = getRow(db, 'SELECT status, occupied, capacity FROM berths WHERE id = ?', [berthId])
    if (berth) {
      if (berth.status === 'maintenance') {
        checks.berth = false
        errors.push('泊位正在维护中')
      }
      if ((berth.occupied as number) >= (berth.capacity as number)) {
        checks.berth = false
        errors.push('泊位容量已满')
      }
    }
  } else {
    checks.berth = false
    errors.push('未分配泊位')
  }

  if (requestType === 'early_return') {
    const weatherAlerts = all(db, "SELECT title FROM alerts WHERE type = 'weather' AND is_resolved = 0")
    if (weatherAlerts.length > 0) {
      checks.weather = false
      errors.push(`存在活跃气象预警: ${weatherAlerts.map(a => a.title).join('、')}`)
    }

    const activeControls = all(db,
      `SELECT title, control_type FROM emergency_controls WHERE status = 'active' 
       AND datetime(start_time) <= datetime('now') AND datetime(end_time) >= datetime('now')`
    )
    if (activeControls.length > 0) {
      checks.weather = false
      errors.push(`存在活跃应急管控: ${activeControls.map(c => c.title).join('、')}`)
    }
  }

  if (requestType === 'route_change' || requestType === 'crew_change') {
    const routeRisk = plan.route_risk_level as string
    const dangerGoods = plan.danger_goods_declared as number
    if (routeRisk === 'high' || dangerGoods === 1) {
      const inspectRecord = getRow(db,
        "SELECT id FROM approval_records WHERE plan_id = ? AND node = 'supervisor_inspect' AND action = 'approved' ORDER BY created_at DESC LIMIT 1",
        [planId]
      )
      if (!inspectRecord) {
        checks.inspection = false
        errors.push('高风险航线需监管抽查，当前未完成抽查')
      }
    }
  }

  return { passed: errors.length === 0, errors, checks }
}

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const status = req.query.status as string
    const planId = req.query.planId as string
    const voyageId = req.query.voyageId as string

    let sql = `SELECT vcr.*, u.name as requested_by_name, u2.name as reviewed_by_name,
               p.route as plan_route, s.name as ship_name
               FROM voyage_change_requests vcr
               LEFT JOIN users u ON vcr.requested_by = u.id
               LEFT JOIN users u2 ON vcr.reviewed_by = u2.id
               LEFT JOIN plans p ON vcr.plan_id = p.id
               LEFT JOIN ships s ON p.ship_id = s.id`
    const conditions: string[] = []
    const params: unknown[] = []

    if (status) {
      conditions.push('vcr.status = ?')
      params.push(status)
    }
    if (planId) {
      conditions.push('vcr.plan_id = ?')
      params.push(planId)
    }
    if (voyageId) {
      conditions.push('vcr.voyage_id = ?')
      params.push(voyageId)
    }
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ')
    }
    sql += ' ORDER BY vcr.created_at DESC'

    const requests = all(db, sql, params)
    res.json({ success: true, data: requests })
  } catch (error) {
    res.status(500).json({ success: false, error: '获取变更申请列表失败' })
  }
})

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const request = getRow(db,
      `SELECT vcr.*, u.name as requested_by_name, u2.name as reviewed_by_name,
              p.route as plan_route, s.name as ship_name
       FROM voyage_change_requests vcr
       LEFT JOIN users u ON vcr.requested_by = u.id
       LEFT JOIN users u2 ON vcr.reviewed_by = u2.id
       LEFT JOIN plans p ON vcr.plan_id = p.id
       LEFT JOIN ships s ON p.ship_id = s.id
       WHERE vcr.id = ?`,
      [req.params.id]
    )
    if (!request) {
      res.status(404).json({ success: false, error: '变更申请不存在' })
      return
    }

    const statusLogs = all(db,
      `SELECT scl.*, u.name as operator_name
       FROM status_change_logs scl
       LEFT JOIN users u ON scl.operator_id = u.id
       WHERE scl.metadata LIKE ?
       ORDER BY scl.created_at DESC`,
      [`%${req.params.id}%`]
    )

    res.json({ success: true, data: { ...request, status_logs: statusLogs } })
  } catch (error) {
    res.status(500).json({ success: false, error: '获取变更申请详情失败' })
  }
})

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      planId, voyageId, requestType, oldValue, newValue, changeReason
    } = req.body

    if (!planId || !requestType || !newValue || !changeReason) {
      res.status(400).json({ success: false, error: '缺少必填字段' })
      return
    }

    if (!['route_change', 'crew_change', 'early_return'].includes(requestType)) {
      res.status(400).json({ success: false, error: '无效的变更类型' })
      return
    }

    const db = await getDb()
    const plan = getRow(db, 'SELECT * FROM plans WHERE id = ?', [planId])
    if (!plan) {
      res.status(404).json({ success: false, error: '关联计划不存在' })
      return
    }

    const validPlanStatuses = ['submitted', 'reviewing', 'inspecting', 'released']
    if (!validPlanStatuses.includes(plan.status as string)) {
      res.status(400).json({ success: false, error: `计划状态为${plan.status}，不可提交变更申请` })
      return
    }

    if (plan.status === 'released') {
      const voyage = voyageId
        ? getRow(db, 'SELECT status FROM voyages WHERE id = ?', [voyageId])
        : getRow(db, 'SELECT status FROM voyages WHERE id = ?', [plan.voyage_id as string])
      if (voyage && !['active', 'returning'].includes(voyage.status as string)) {
        res.status(400).json({ success: false, error: '关联航次状态不允许提交变更申请' })
        return
      }
    }

    const operatorId = (req.headers['x-user-id'] as string) || 'u1'
    const operatorRole = (req.headers['x-user-role'] as string) || 'captain'
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const id = genId()

    const recheck = await runChangeRechecks(db, planId, requestType, newValue)

    const id2 = genId()
    run(db,
      `INSERT INTO voyage_change_requests 
       (id, plan_id, voyage_id, request_type, old_value, new_value, change_reason, status,
        requested_by, requires_recheck, recheck_certificate, recheck_berth, recheck_weather, recheck_inspection,
        created_at, updated_at) 
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, planId, voyageId || plan.voyage_id || null, requestType,
       oldValue || null, newValue, changeReason, recheck.passed ? 'pending' : 'pending',
       operatorId, 1,
       recheck.checks.certificate ? 0 : 1,
       recheck.checks.berth ? 0 : 1,
       recheck.checks.weather ? 0 : 1,
       recheck.checks.inspection ? 0 : 1,
       now, now]
    )

    logStatusChange(db, {
      planId,
      voyageId: voyageId || (plan.voyage_id as string) || undefined,
      oldStatus: plan.status as string,
      newStatus: plan.status as string,
      changeType: 'change_request',
      reason: `船长申请${requestType === 'route_change' ? '改航线' : requestType === 'crew_change' ? '换船员' : '提前返港'}: ${changeReason}`,
      operatorId,
      operatorRole,
      metadata: { changeRequestId: id, requestType, recheckPassed: recheck.passed, recheckErrors: recheck.errors, recheckChecks: recheck.checks }
    })

    if (!recheck.passed) {
      run(db,
        `INSERT INTO alerts (id, type, level, title, message, related_voyage_id, related_ship_id, is_resolved, created_at)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [genId(), 'route_risk', 'warning',
         `变更申请需复核: ${plan.ship_id}`,
         `变更申请未通过自动校验: ${recheck.errors.join('; ')}，需人工复核`,
         voyageId || (plan.voyage_id as string) || null, plan.ship_id, 0, now]
      )
    }

    if (plan.status === 'released') {
      run(db, "UPDATE plans SET change_request_id = ?, updated_at = ? WHERE id = ?", [id, now, planId])
      if (plan.voyage_id) {
        run(db, "UPDATE voyages SET change_request_id = ?, last_status_change_reason = ? WHERE id = ?",
          [id, `变更申请中: ${changeReason}`, plan.voyage_id as string])
      }
    }

    persist(db)
    const created = getRow(db, 'SELECT * FROM voyage_change_requests WHERE id = ?', [id])
    res.status(201).json({ success: true, data: { ...created, recheck } })
  } catch (error) {
    res.status(500).json({ success: false, error: '创建变更申请失败' })
  }
})

router.post('/:id/review', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const changeReq = getRow(db, 'SELECT * FROM voyage_change_requests WHERE id = ?', [req.params.id])
    if (!changeReq) {
      res.status(404).json({ success: false, error: '变更申请不存在' })
      return
    }
    if (changeReq.status !== 'pending') {
      res.status(400).json({ success: false, error: '仅待审核状态可审核' })
      return
    }

    const { action, reviewComment } = req.body
    if (!['approve', 'reject'].includes(action)) {
      res.status(400).json({ success: false, error: '无效的审核动作' })
      return
    }

    const operatorId = (req.headers['x-user-id'] as string) || 'u3'
    const operatorRole = (req.headers['x-user-role'] as string) || 'supervisor'
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const planId = changeReq.plan_id as string
    const voyageId = changeReq.voyage_id as string | null
    const requestType = changeReq.request_type as string
    const newValue = changeReq.new_value as string

    if (action === 'approve') {
      run(db,
        `UPDATE voyage_change_requests SET status = 'approved', reviewed_by = ?, review_comment = ?, reviewed_at = ?, updated_at = ? WHERE id = ?`,
        [operatorId, reviewComment || '审核通过', now, now, req.params.id]
      )

      if (requestType === 'route_change') {
        run(db, "UPDATE plans SET route = ?, route_risk_level = CASE WHEN route_risk_level = 'low' THEN 'medium' ELSE route_risk_level END, updated_at = ? WHERE id = ?",
          [newValue, now, planId])
        run(db, "INSERT INTO approval_records (id, plan_id, node, action, operator_id, operator_role, comment, created_at) VALUES (?,?,?,?,?,?,?,?)",
          [genId(), planId, 'change_review', 'approved', operatorId, operatorRole, `航线变更已批准: ${newValue}`, now])
      } else if (requestType === 'crew_change') {
        const newCrewIds = newValue.split(',').map(s => s.trim()).filter(Boolean)
        run(db, 'DELETE FROM plan_crew WHERE plan_id = ?', [planId])
        for (const crewId of newCrewIds) {
          run(db, 'INSERT INTO plan_crew (plan_id, crew_id) VALUES (?,?)', [planId, crewId])
        }
        run(db, "UPDATE plans SET crew_confirmed = 0, updated_at = ? WHERE id = ?", [now, planId])
        run(db, "INSERT INTO approval_records (id, plan_id, node, action, operator_id, operator_role, comment, created_at) VALUES (?,?,?,?,?,?,?,?)",
          [genId(), planId, 'change_review', 'approved', operatorId, operatorRole, '船员变更已批准，需重新确认', now])
      } else if (requestType === 'early_return') {
        run(db, "UPDATE plans SET expected_return_time = ?, updated_at = ? WHERE id = ?", [newValue, now, planId])
        if (voyageId) {
          run(db, "UPDATE voyages SET expected_return_time = ?, last_status_change_reason = ? WHERE id = ?",
            [newValue, `提前返港已批准: 新返港时间${newValue}`, voyageId])
        }
        run(db, "INSERT INTO approval_records (id, plan_id, node, action, operator_id, operator_role, comment, created_at) VALUES (?,?,?,?,?,?,?,?)",
          [genId(), planId, 'change_review', 'approved', operatorId, operatorRole, `提前返港已批准: ${newValue}`, now])
      }

      run(db, "UPDATE plans SET change_request_id = NULL, updated_at = ? WHERE id = ?", [now, planId])
      if (voyageId) {
        run(db, "UPDATE voyages SET change_request_id = NULL, last_status_change_reason = ? WHERE id = ?",
          [`变更申请已批准: ${reviewComment || '通过'}`, voyageId])
      }

      logStatusChange(db, {
        planId,
        voyageId: voyageId || undefined,
        oldStatus: 'pending_review',
        newStatus: 'change_approved',
        changeType: 'change_request',
        reason: `变更申请批准: ${reviewComment || '通过'}`,
        operatorId,
        operatorRole,
        metadata: { changeRequestId: req.params.id, requestType, newValue }
      })
    } else {
      run(db,
        `UPDATE voyage_change_requests SET status = 'rejected', reviewed_by = ?, review_comment = ?, reviewed_at = ?, updated_at = ? WHERE id = ?`,
        [operatorId, reviewComment || '审核不通过', now, now, req.params.id]
      )

      run(db, "UPDATE plans SET change_request_id = NULL, updated_at = ? WHERE id = ?", [now, planId])
      if (voyageId) {
        run(db, "UPDATE voyages SET change_request_id = NULL, last_status_change_reason = ? WHERE id = ?",
          [`变更申请被驳回: ${reviewComment || '不通过'}`, voyageId])
      }

      run(db, "INSERT INTO approval_records (id, plan_id, node, action, operator_id, operator_role, comment, created_at) VALUES (?,?,?,?,?,?,?,?)",
        [genId(), planId, 'change_review', 'rejected', operatorId, operatorRole, `变更申请被驳回: ${reviewComment || '不通过'}`, now])

      logStatusChange(db, {
        planId,
        voyageId: voyageId || undefined,
        oldStatus: 'pending_review',
        newStatus: 'change_rejected',
        changeType: 'change_request',
        reason: `变更申请驳回: ${reviewComment || '不通过'}`,
        operatorId,
        operatorRole,
        metadata: { changeRequestId: req.params.id, requestType }
      })
    }

    persist(db)
    const updated = getRow(db, 'SELECT * FROM voyage_change_requests WHERE id = ?', [req.params.id])
    res.json({ success: true, data: updated })
  } catch (error) {
    res.status(500).json({ success: false, error: '审核变更申请失败' })
  }
})

router.post('/:id/cancel', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const changeReq = getRow(db, 'SELECT * FROM voyage_change_requests WHERE id = ?', [req.params.id])
    if (!changeReq) {
      res.status(404).json({ success: false, error: '变更申请不存在' })
      return
    }
    if (changeReq.status !== 'pending') {
      res.status(400).json({ success: false, error: '仅待审核状态可取消' })
      return
    }

    const operatorId = (req.headers['x-user-id'] as string) || 'u1'
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const planId = changeReq.plan_id as string
    const voyageId = changeReq.voyage_id as string | null

    run(db, "UPDATE voyage_change_requests SET status = 'cancelled', updated_at = ? WHERE id = ?", [now, req.params.id])
    run(db, "UPDATE plans SET change_request_id = NULL, updated_at = ? WHERE id = ?", [now, planId])
    if (voyageId) {
      run(db, "UPDATE voyages SET change_request_id = NULL, last_status_change_reason = ? WHERE id = ?",
        ['变更申请已取消', voyageId])
    }

    logStatusChange(db, {
      planId,
      voyageId: voyageId || undefined,
      oldStatus: 'pending_review',
      newStatus: 'change_cancelled',
      changeType: 'change_request',
      reason: '变更申请已取消',
      operatorId,
      operatorRole: (req.headers['x-user-role'] as string) || 'captain',
      metadata: { changeRequestId: req.params.id }
    })

    persist(db)
    const updated = getRow(db, 'SELECT * FROM voyage_change_requests WHERE id = ?', [req.params.id])
    res.json({ success: true, data: updated })
  } catch (error) {
    res.status(500).json({ success: false, error: '取消变更申请失败' })
  }
})

router.get('/plan/:planId/status-logs', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const logs = all(db,
      `SELECT scl.*, u.name as operator_name, ec.title as control_title
       FROM status_change_logs scl
       LEFT JOIN users u ON scl.operator_id = u.id
       LEFT JOIN emergency_controls ec ON scl.emergency_control_id = ec.id
       WHERE scl.plan_id = ?
       ORDER BY scl.created_at DESC`,
      [req.params.planId]
    )
    res.json({ success: true, data: logs })
  } catch (error) {
    res.status(500).json({ success: false, error: '获取状态变更日志失败' })
  }
})

router.get('/voyage/:voyageId/status-logs', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const logs = all(db,
      `SELECT scl.*, u.name as operator_name, ec.title as control_title
       FROM status_change_logs scl
       LEFT JOIN users u ON scl.operator_id = u.id
       LEFT JOIN emergency_controls ec ON scl.emergency_control_id = ec.id
       WHERE scl.voyage_id = ?
       ORDER BY scl.created_at DESC`,
      [req.params.voyageId]
    )
    res.json({ success: true, data: logs })
  } catch (error) {
    res.status(500).json({ success: false, error: '获取航次状态变更日志失败' })
  }
})

export default router
