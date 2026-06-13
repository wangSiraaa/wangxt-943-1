import { Router, type Request, type Response } from 'express'
import { getDb, all, get as getRow, run, persist } from '../database.js'
import crypto from 'crypto'

const router = Router()

function genId(): string {
  return crypto.randomUUID()
}

async function runAutoChecks(db: Awaited<ReturnType<typeof getDb>>, planId: string, shipId: string, crewIds: string[], berthId: string | null): Promise<{ passed: boolean; errors: string[] }> {
  const errors: string[] = []
  const now = new Date()

  const activeVoyage = all(db, "SELECT id FROM voyages WHERE ship_id = ? AND status IN ('active','returning')", [shipId])
  if (activeVoyage.length > 0) {
    errors.push('该船舶存在未关闭的航次，不可重复出港')
  }

  const expiredCerts = all(db, "SELECT type, expire_date FROM certificates WHERE ship_id = ? AND status = 'expired'", [shipId])
  if (expiredCerts.length > 0) {
    const types = expiredCerts.map(c => `${c.type}(${c.expire_date})`).join('、')
    errors.push(`船舶证书已过期: ${types}`)
  }

  if (crewIds.length > 0) {
    const placeholders = crewIds.map(() => '?').join(',')
    const blacklisted = all(db, `SELECT name FROM crew WHERE id IN (${placeholders}) AND is_blacklisted = 1`, crewIds)
    if (blacklisted.length > 0) {
      const names = blacklisted.map(c => c.name).join('、')
      errors.push(`船员在黑名单中: ${names}`)
    }

    const expiredQuals = all(db, `SELECT name, qualification_type, qualification_expire_date FROM crew WHERE id IN (${placeholders}) AND date(qualification_expire_date) < date('now')`, crewIds)
    if (expiredQuals.length > 0) {
      const details = expiredQuals.map(c => `${c.name}的${c.qualification_type}(${c.qualification_expire_date})`).join('、')
      errors.push(`船员资质已过期: ${details}`)
    }
  }

  if (!berthId) {
    errors.push('未分配泊位')
  } else {
    const berth = getRow(db, 'SELECT status, occupied, capacity FROM berths WHERE id = ?', [berthId])
    if (berth) {
      if (berth.status === 'maintenance') {
        errors.push('泊位正在维护中')
      }
      if ((berth.occupied as number) >= (berth.capacity as number)) {
        errors.push('泊位容量已满')
      }
    }
  }

  const weatherAlerts = all(db, "SELECT title FROM alerts WHERE type = 'weather' AND is_resolved = 0 AND level = 'critical'")
  if (weatherAlerts.length > 0) {
    const titles = weatherAlerts.map(a => a.title).join('、')
    errors.push(`存在活跃气象预警: ${titles}`)
  }

  return { passed: errors.length === 0, errors }
}

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const status = req.query.status as string
    let sql = `SELECT p.*, s.name as ship_name FROM plans p LEFT JOIN ships s ON p.ship_id = s.id`
    const params: unknown[] = []
    if (status) {
      sql += ' WHERE p.status = ?'
      params.push(status)
    }
    sql += ' ORDER BY p.created_at DESC'
    const plans = all(db, sql, params)

    for (const plan of plans) {
      const crew = all(db, 'SELECT c.* FROM crew c INNER JOIN plan_crew pc ON c.id = pc.crew_id WHERE pc.plan_id = ?', [plan.id])
      plan.crew = crew
    }

    res.json({ success: true, data: plans })
  } catch (error) {
    res.status(500).json({ success: false, error: '获取计划列表失败' })
  }
})

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const plan = getRow(db, 'SELECT p.*, s.name as ship_name FROM plans p LEFT JOIN ships s ON p.ship_id = s.id WHERE p.id = ?', [req.params.id])
    if (!plan) {
      res.status(404).json({ success: false, error: '计划不存在' })
      return
    }

    plan.crew = all(db, 'SELECT c.* FROM crew c INNER JOIN plan_crew pc ON c.id = pc.crew_id WHERE pc.plan_id = ?', [req.params.id])
    plan.approval_records = all(db, 'SELECT * FROM approval_records WHERE plan_id = ? ORDER BY created_at', [req.params.id])

    res.json({ success: true, data: plan })
  } catch (error) {
    res.status(500).json({ success: false, error: '获取计划详情失败' })
  }
})

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      shipId, captainId, departureTime, expectedReturnTime,
      route, routeRiskLevel, dangerGoodsDeclared, dangerGoodsDetail,
      fuelRemaining, berthId, crewIds
    } = req.body

    if (!shipId || !captainId || !departureTime || !expectedReturnTime || !route) {
      res.status(400).json({ success: false, error: '缺少必填字段' })
      return
    }

    const id = genId()
    const db = await getDb()
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

    run(db,
      `INSERT INTO plans (id, ship_id, captain_id, voyage_id, status, departure_time, expected_return_time,
       route, route_risk_level, danger_goods_declared, danger_goods_detail, fuel_remaining, berth_id,
       rejection_reason, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, shipId, captainId, null, 'draft', departureTime, expectedReturnTime,
       route, routeRiskLevel || 'low', dangerGoodsDeclared ? 1 : 0, dangerGoodsDetail || null,
       fuelRemaining || 0, berthId || null, null, now, now]
    )

    if (Array.isArray(crewIds) && crewIds.length > 0) {
      for (const crewId of crewIds) {
        run(db, 'INSERT INTO plan_crew (plan_id, crew_id) VALUES (?,?)', [id, crewId])
      }
    }

    persist(db)
    res.status(201).json({ success: true, data: { id, status: 'draft' } })
  } catch (error) {
    res.status(500).json({ success: false, error: '创建计划失败' })
  }
})

router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const existing = getRow(db, 'SELECT status FROM plans WHERE id = ?', [req.params.id])
    if (!existing) {
      res.status(404).json({ success: false, error: '计划不存在' })
      return
    }
    if (existing.status !== 'draft') {
      res.status(400).json({ success: false, error: '仅草稿状态可编辑' })
      return
    }

    const {
      departureTime, expectedReturnTime, route, routeRiskLevel,
      dangerGoodsDeclared, dangerGoodsDetail, fuelRemaining, berthId, crewIds
    } = req.body
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

    run(db,
      `UPDATE plans SET departure_time=COALESCE(?,departure_time), expected_return_time=COALESCE(?,expected_return_time),
       route=COALESCE(?,route), route_risk_level=COALESCE(?,route_risk_level),
       danger_goods_declared=COALESCE(?,danger_goods_declared), danger_goods_detail=COALESCE(?,danger_goods_detail),
       fuel_remaining=COALESCE(?,fuel_remaining), berth_id=COALESCE(?,berth_id), updated_at=? WHERE id=?`,
      [departureTime || null, expectedReturnTime || null, route || null, routeRiskLevel || null,
       dangerGoodsDeclared ?? null, dangerGoodsDetail || null, fuelRemaining ?? null, berthId || null, now, req.params.id]
    )

    if (Array.isArray(crewIds)) {
      run(db, 'DELETE FROM plan_crew WHERE plan_id = ?', [req.params.id])
      for (const crewId of crewIds) {
        run(db, 'INSERT INTO plan_crew (plan_id, crew_id) VALUES (?,?)', [req.params.id, crewId])
      }
    }

    persist(db)
    const plan = getRow(db, 'SELECT * FROM plans WHERE id = ?', [req.params.id])
    res.json({ success: true, data: plan })
  } catch (error) {
    res.status(500).json({ success: false, error: '更新计划失败' })
  }
})

router.post('/:id/submit', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const plan = getRow(db, 'SELECT * FROM plans WHERE id = ?', [req.params.id])
    if (!plan) {
      res.status(404).json({ success: false, error: '计划不存在' })
      return
    }
    if (plan.status !== 'draft') {
      res.status(400).json({ success: false, error: '仅草稿状态可提交' })
      return
    }

    const crewRows = all(db, 'SELECT crew_id FROM plan_crew WHERE plan_id = ?', [req.params.id])
    const crewIds = crewRows.map(r => r.crew_id as string)

    const check = await runAutoChecks(db, req.params.id, plan.ship_id as string, crewIds, plan.berth_id as string | null)
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

    if (!check.passed) {
      run(db, "INSERT INTO approval_records (id, plan_id, node, action, operator_id, operator_role, comment, created_at) VALUES (?,?,?,?,?,?,?,?)",
        [genId(), req.params.id, 'auto_check', 'rejected', 'system', 'system', check.errors.join('; '), now])
      run(db, "UPDATE plans SET status = 'rejected', rejection_reason = ?, updated_at = ? WHERE id = ?", [check.errors.join('; '), now, req.params.id])
      persist(db)
      res.json({ success: false, data: { status: 'rejected', errors: check.errors } })
      return
    }

    run(db, "INSERT INTO approval_records (id, plan_id, node, action, operator_id, operator_role, comment, created_at) VALUES (?,?,?,?,?,?,?,?)",
      [genId(), req.params.id, 'auto_check', 'approved', 'system', 'system', '自动校验通过', now])
    run(db, "UPDATE plans SET status = 'submitted', updated_at = ? WHERE id = ?", [now, req.params.id])
    persist(db)

    const updated = getRow(db, 'SELECT * FROM plans WHERE id = ?', [req.params.id])
    res.json({ success: true, data: updated })
  } catch (error) {
    res.status(500).json({ success: false, error: '提交计划失败' })
  }
})

router.post('/:id/withdraw', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const plan = getRow(db, 'SELECT status FROM plans WHERE id = ?', [req.params.id])
    if (!plan) {
      res.status(404).json({ success: false, error: '计划不存在' })
      return
    }
    if (!['submitted', 'reviewing', 'inspecting'].includes(plan.status as string)) {
      res.status(400).json({ success: false, error: '当前状态不可撤回' })
      return
    }

    const operatorId = (req.headers['x-user-id'] as string) || 'system'
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    run(db, "UPDATE plans SET status = 'withdrawn', updated_at = ? WHERE id = ?", [now, req.params.id])
    run(db, "INSERT INTO approval_records (id, plan_id, node, action, operator_id, operator_role, comment, created_at) VALUES (?,?,?,?,?,?,?,?)",
      [genId(), req.params.id, 'duty_review', 'rejected', operatorId, 'captain', '船长撤回', now])
    persist(db)
    const updated = getRow(db, 'SELECT * FROM plans WHERE id = ?', [req.params.id])
    res.json({ success: true, data: updated })
  } catch (error) {
    res.status(500).json({ success: false, error: '撤回计划失败' })
  }
})

router.post('/:id/review', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const plan = getRow(db, 'SELECT status, ship_id, crew_confirmed FROM plans WHERE id = ?', [req.params.id])
    if (!plan) {
      res.status(404).json({ success: false, error: '计划不存在' })
      return
    }
    if (plan.status !== 'submitted' && plan.status !== 'reviewing') {
      res.status(400).json({ success: false, error: '仅已提交或复核中状态可复核' })
      return
    }

    const { action, approve, comment, crewConfirmed } = req.body
    const operatorId = (req.headers['x-user-id'] as string) || 'u2'
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

    const isRejected = action === 'reject' || approve === false

    if (isRejected) {
      const rejectReason = comment || '值班员打回'
      run(db, "UPDATE plans SET status = 'rejected', rejection_reason = ?, updated_at = ? WHERE id = ?", [rejectReason, now, req.params.id])
      run(db, "INSERT INTO approval_records (id, plan_id, node, action, operator_id, operator_role, comment, created_at) VALUES (?,?,?,?,?,?,?,?)",
        [genId(), req.params.id, 'duty_review', 'rejected', operatorId, 'duty_officer', rejectReason, now])
    } else {
      const crewRows = all(db, 'SELECT crew_id FROM plan_crew WHERE plan_id = ?', [req.params.id])
      if (crewRows.length === 0) {
        res.status(400).json({ success: false, error: '船员名单为空，无法通过复核' })
        return
      }

      const isCrewConfirmed = crewConfirmed === true || (plan.crew_confirmed as number) === 1
      if (!isCrewConfirmed) {
        res.status(400).json({ success: false, error: '船员名单未确认，无法通过复核' })
        return
      }

      run(db, "UPDATE plans SET status = 'reviewing', crew_confirmed = 1, updated_at = ? WHERE id = ?", [now, req.params.id])
      run(db, "INSERT INTO approval_records (id, plan_id, node, action, operator_id, operator_role, comment, created_at) VALUES (?,?,?,?,?,?,?,?)",
        [genId(), req.params.id, 'duty_review', 'approved', operatorId, 'duty_officer', comment || '船员名单核验通过，复核通过', now])
    }

    persist(db)
    const updated = getRow(db, 'SELECT * FROM plans WHERE id = ?', [req.params.id])
    res.json({ success: true, data: updated })
  } catch (error) {
    res.status(500).json({ success: false, error: '复核失败' })
  }
})

router.post('/:id/inspect', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const plan = getRow(db, 'SELECT * FROM plans WHERE id = ?', [req.params.id])
    if (!plan) {
      res.status(404).json({ success: false, error: '计划不存在' })
      return
    }
    if (plan.status !== 'reviewing' && plan.status !== 'inspecting') {
      res.status(400).json({ success: false, error: '仅复核中或抽查中状态可抽查' })
      return
    }

    const needInspect = (plan.route_risk_level as string) === 'high' || (plan.danger_goods_declared as number) === 1
    if (!needInspect) {
      res.status(400).json({ success: false, error: '该计划无需监管抽查，可直接放行' })
      return
    }

    if ((plan.crew_confirmed as number) !== 1) {
      res.status(400).json({ success: false, error: '船员名单未确认，不得进入监管抽查流程' })
      return
    }

    const { action, approve, comment } = req.body
    const operatorId = (req.headers['x-user-id'] as string) || 'u3'
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

    const isRejected = action === 'reject' || approve === false

    if (isRejected) {
      const rejectReason = comment || '监管员打回'
      run(db, "UPDATE plans SET status = 'rejected', rejection_reason = ?, updated_at = ? WHERE id = ?", [rejectReason, now, req.params.id])
      run(db, "INSERT INTO approval_records (id, plan_id, node, action, operator_id, operator_role, comment, created_at) VALUES (?,?,?,?,?,?,?,?)",
        [genId(), req.params.id, 'supervisor_inspect', 'rejected', operatorId, 'supervisor', rejectReason, now])
    } else {
      run(db, "UPDATE plans SET status = 'inspecting', updated_at = ? WHERE id = ?", [now, req.params.id])
      run(db, "INSERT INTO approval_records (id, plan_id, node, action, operator_id, operator_role, comment, created_at) VALUES (?,?,?,?,?,?,?,?)",
        [genId(), req.params.id, 'supervisor_inspect', 'approved', operatorId, 'supervisor', comment || '抽查通过', now])
    }

    persist(db)
    const updated = getRow(db, 'SELECT * FROM plans WHERE id = ?', [req.params.id])
    res.json({ success: true, data: updated })
  } catch (error) {
    res.status(500).json({ success: false, error: '抽查失败' })
  }
})

router.post('/:id/release', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const plan = getRow(db, 'SELECT * FROM plans WHERE id = ?', [req.params.id])
    if (!plan) {
      res.status(404).json({ success: false, error: '计划不存在' })
      return
    }

    if ((plan.crew_confirmed as number) !== 1) {
      res.status(400).json({ success: false, error: '船员名单未确认，不得放行' })
      return
    }

    const reviewRecord = getRow(db, 
      "SELECT id FROM approval_records WHERE plan_id = ? AND node = 'duty_review' AND action = 'approved' ORDER BY created_at DESC LIMIT 1",
      [req.params.id]
    )
    if (!reviewRecord) {
      res.status(400).json({ success: false, error: '值班复核未通过，不得放行' })
      return
    }

    const planStatus = plan.status as string
    const needInspect = (plan.route_risk_level as string) === 'high' || (plan.danger_goods_declared as number) === 1
    const validStatus = needInspect ? 'inspecting' : 'reviewing'

    if (needInspect) {
      const inspectRecord = getRow(db,
        "SELECT id FROM approval_records WHERE plan_id = ? AND node = 'supervisor_inspect' AND action = 'approved' ORDER BY created_at DESC LIMIT 1",
        [req.params.id]
      )
      if (!inspectRecord) {
        res.status(400).json({ success: false, error: '监管抽查未通过，不得放行' })
        return
      }
    }

    if (planStatus !== validStatus) {
      res.status(400).json({ success: false, error: `当前状态不可放行，需要状态为${validStatus}` })
      return
    }

    const operatorId = (req.headers['x-user-id'] as string) || 'u2'
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const voyageId = genId()

    run(db, `INSERT INTO voyages (id, plan_id, ship_id, status, departure_time, expected_return_time, created_at) VALUES (?,?,?,?,?,?,?)`,
      [voyageId, req.params.id, plan.ship_id, 'active', plan.departure_time, plan.expected_return_time, now])

    run(db, "UPDATE plans SET status = 'released', voyage_id = ?, updated_at = ? WHERE id = ?",
      [voyageId, now, req.params.id])

    run(db, "UPDATE ships SET status = 'at_sea', current_voyage_id = ?, updated_at = ? WHERE id = ?",
      [voyageId, now, plan.ship_id])

    run(db, "INSERT INTO approval_records (id, plan_id, node, action, operator_id, operator_role, comment, created_at) VALUES (?,?,?,?,?,?,?,?)",
      [genId(), req.params.id, 'dock_release', 'approved', operatorId, 'duty_officer', '码头放行', now])

    run(db, 'INSERT INTO release_logs (id, plan_id, ship_id, operator_id, released_at) VALUES (?,?,?,?,?)',
      [genId(), req.params.id, plan.ship_id, operatorId, now])

    persist(db)
    const updated = getRow(db, 'SELECT * FROM plans WHERE id = ?', [req.params.id])
    res.json({ success: true, data: { ...updated, voyage_id: voyageId } })
  } catch (error) {
    res.status(500).json({ success: false, error: '放行失败' })
  }
})

router.post('/:id/reject', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const plan = getRow(db, 'SELECT status FROM plans WHERE id = ?', [req.params.id])
    if (!plan) {
      res.status(404).json({ success: false, error: '计划不存在' })
      return
    }
    if (!['submitted', 'reviewing', 'inspecting'].includes(plan.status as string)) {
      res.status(400).json({ success: false, error: '当前状态不可打回' })
      return
    }

    const { reason } = req.body
    const operatorId = (req.headers['x-user-id'] as string) || 'u2'
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

    run(db, "UPDATE plans SET status = 'rejected', rejection_reason = ?, updated_at = ? WHERE id = ?", [reason || '审批不通过', now, req.params.id])
    run(db, "INSERT INTO approval_records (id, plan_id, node, action, operator_id, operator_role, comment, created_at) VALUES (?,?,?,?,?,?,?,?)",
      [genId(), req.params.id, 'duty_review', 'rejected', operatorId, 'duty_officer', reason || '审批不通过', now])
    persist(db)
    const updated = getRow(db, 'SELECT * FROM plans WHERE id = ?', [req.params.id])
    res.json({ success: true, data: updated })
  } catch (error) {
    res.status(500).json({ success: false, error: '打回失败' })
  }
})

router.post('/:id/revoke', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const plan = getRow(db, 'SELECT * FROM plans WHERE id = ?', [req.params.id])
    if (!plan) {
      res.status(404).json({ success: false, error: '计划不存在' })
      return
    }
    if (plan.status !== 'released') {
      res.status(400).json({ success: false, error: '仅已放行状态可撤销' })
      return
    }

    const { reason } = req.body
    if (!reason) {
      res.status(400).json({ success: false, error: '撤销原因不能为空' })
      return
    }

    const operatorId = (req.headers['x-user-id'] as string) || 'u3'
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

    const releaseLog = getRow(db, 'SELECT id FROM release_logs WHERE plan_id = ? ORDER BY released_at DESC LIMIT 1', [req.params.id])
    const releaseLogId = releaseLog ? releaseLog.id : null

    run(db, 'INSERT INTO revoke_logs (id, plan_id, release_log_id, operator_id, reason, revoked_at) VALUES (?,?,?,?,?,?)',
      [genId(), req.params.id, releaseLogId, operatorId, reason, now])

    run(db, "UPDATE plans SET status = 'revoked', updated_at = ? WHERE id = ?", [now, req.params.id])

    if (plan.voyage_id) {
      run(db, "UPDATE voyages SET status = 'closed', close_reason = ?, closed_by = ?, closed_at = ? WHERE id = ?",
        [`放行撤销: ${reason}`, operatorId, now, plan.voyage_id])
    }

    run(db, "UPDATE ships SET status = 'in_port', current_voyage_id = NULL, updated_at = ? WHERE id = ?", [now, plan.ship_id])

    run(db, "INSERT INTO approval_records (id, plan_id, node, action, operator_id, operator_role, comment, created_at) VALUES (?,?,?,?,?,?,?,?)",
      [genId(), req.params.id, 'dock_release', 'revoked', operatorId, 'supervisor', reason, now])

    persist(db)
    const updated = getRow(db, 'SELECT * FROM plans WHERE id = ?', [req.params.id])
    res.json({ success: true, data: updated })
  } catch (error) {
    res.status(500).json({ success: false, error: '撤销放行失败' })
  }
})

router.get('/:id/approval-records', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const records = all(db, 
      `SELECT ar.*, u.name as operator_name 
       FROM approval_records ar 
       LEFT JOIN users u ON ar.operator_id = u.id 
       WHERE ar.plan_id = ? 
       ORDER BY ar.created_at`, 
      [req.params.id]
    )
    res.json({ success: true, data: records })
  } catch (error) {
    res.status(500).json({ success: false, error: '获取审批记录失败' })
  }
})

router.get('/:id/risk-change-logs', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const logs = all(db, 
      `SELECT rcl.*, u.name as changed_by_name 
       FROM risk_change_logs rcl 
       LEFT JOIN users u ON rcl.changed_by = u.id 
       WHERE rcl.plan_id = ? 
       ORDER BY rcl.created_at`, 
      [req.params.id]
    )
    res.json({ success: true, data: logs })
  } catch (error) {
    res.status(500).json({ success: false, error: '获取风险变更日志失败' })
  }
})

router.post('/:id/risk-change', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const plan = getRow(db, 'SELECT * FROM plans WHERE id = ?', [req.params.id])
    if (!plan) {
      res.status(404).json({ success: false, error: '计划不存在' })
      return
    }

    const { newRiskLevel, changeReason } = req.body
    if (!newRiskLevel || !changeReason) {
      res.status(400).json({ success: false, error: '缺少新风险等级或变更原因' })
      return
    }

    const operatorId = (req.headers['x-user-id'] as string) || 'u3'
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const oldRiskLevel = plan.route_risk_level as string

    run(db,
      `INSERT INTO risk_change_logs (id, plan_id, old_risk_level, new_risk_level, change_reason, changed_by, created_at)
       VALUES (?,?,?,?,?,?,?)`,
      [genId(), req.params.id, oldRiskLevel, newRiskLevel, changeReason, operatorId, now]
    )

    run(db, "UPDATE plans SET route_risk_level = ?, updated_at = ? WHERE id = ?",
      [newRiskLevel, now, req.params.id]
    )

    if (oldRiskLevel !== 'high' && newRiskLevel === 'high' && plan.status === 'reviewing') {
      run(db, "UPDATE plans SET status = 'inspecting', updated_at = ? WHERE id = ?", [now, req.params.id])
      run(db, "INSERT INTO approval_records (id, plan_id, node, action, operator_id, operator_role, comment, created_at) VALUES (?,?,?,?,?,?,?,?)",
        [genId(), req.params.id, 'supervisor_inspect', 'pending', operatorId, 'supervisor', '风险等级提升，需监管抽查', now])
    }

    persist(db)
    const updated = getRow(db, 'SELECT * FROM plans WHERE id = ?', [req.params.id])
    res.json({ success: true, data: updated })
  } catch (error) {
    res.status(500).json({ success: false, error: '变更风险等级失败' })
  }
})

export default router
