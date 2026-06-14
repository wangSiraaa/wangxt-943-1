import { Router, type Request, type Response } from 'express'
import { getDb, all, get as getRow, run, persist } from '../database.js'
import crypto from 'crypto'

const router = Router()

function genId(): string {
  return crypto.randomUUID()
}

function logStatusChange(
  db: Awaited<ReturnType<typeof getDb>>,
  params: {
    planId?: string
    voyageId?: string
    oldStatus: string
    newStatus: string
    changeType: string
    reason: string
    operatorId: string
    operatorRole: string
    emergencyControlId?: string
    metadata?: Record<string, unknown>
  }
): void {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  run(db,
    `INSERT INTO status_change_logs 
     (id, plan_id, voyage_id, old_status, new_status, change_type, reason, 
      operator_id, operator_role, emergency_control_id, metadata, created_at) 
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      genId(),
      params.planId || null,
      params.voyageId || null,
      params.oldStatus,
      params.newStatus,
      params.changeType,
      params.reason,
      params.operatorId,
      params.operatorRole,
      params.emergencyControlId || null,
      params.metadata ? JSON.stringify(params.metadata) : null,
      now
    ]
  )
}

async function runEmergencyChecks(
  db: Awaited<ReturnType<typeof getDb>>,
  controlId: string,
  operatorId: string,
  operatorRole: string
): Promise<{ affectedPlans: number; affectedVoyages: number; logs: string[] }> {
  const logs: string[] = []
  let affectedPlans = 0
  let affectedVoyages = 0
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

  const control = getRow(db, 'SELECT * FROM emergency_controls WHERE id = ?', [controlId])
  if (!control) return { affectedPlans, affectedVoyages, logs }

  const controlTitle = control.title as string
  const controlType = control.control_type as string
  const reason = `应急管控触发: ${controlTitle} (${controlType})`

  const submittedPlans = all(db,
    `SELECT p.*, s.name as ship_name 
     FROM plans p 
     LEFT JOIN ships s ON p.ship_id = s.id 
     WHERE p.status IN ('submitted') 
       AND (p.emergency_control_id IS NULL OR p.emergency_control_id != ?)`,
    [controlId]
  )

  for (const plan of submittedPlans) {
    const planId = plan.id as string
    const oldStatus = plan.status as string
    
    run(db, "UPDATE plans SET status = 'rejected', rejection_reason = ?, emergency_control_id = ?, last_status_change_reason = ?, updated_at = ? WHERE id = ?",
      [reason, controlId, reason, now, planId])
    
    run(db, "INSERT INTO approval_records (id, plan_id, node, action, operator_id, operator_role, comment, created_at) VALUES (?,?,?,?,?,?,?,?)",
      [genId(), planId, 'emergency_review', 'rejected', operatorId, operatorRole, reason, now])
    
    logStatusChange(db, {
      planId,
      oldStatus,
      newStatus: 'rejected',
      changeType: 'emergency_reject',
      reason,
      operatorId,
      operatorRole,
      emergencyControlId: controlId,
      metadata: { controlType, shipName: plan.ship_name }
    })
    
    run(db,
      `INSERT INTO alerts (id, type, level, title, message, related_voyage_id, related_ship_id, is_resolved, created_at) 
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [genId(), 'route_risk', 'critical', 
       `应急管控: ${plan.ship_name}计划已被打回`, 
       `因${controlTitle}，出港计划已被自动打回，请调整后重新提交`,
       null, plan.ship_id as string, 0, now]
    )
    
    affectedPlans++
    logs.push(`已打回计划 ${plan.ship_name}: ${oldStatus} → rejected`)
  }

  const reviewingPlans = all(db,
    `SELECT p.*, s.name as ship_name 
     FROM plans p 
     LEFT JOIN ships s ON p.ship_id = s.id 
     WHERE p.status IN ('reviewing', 'inspecting') 
       AND (p.emergency_control_id IS NULL OR p.emergency_control_id != ?)`,
    [controlId]
  )

  for (const plan of reviewingPlans) {
    const planId = plan.id as string
    const oldStatus = plan.status as string
    
    run(db, "UPDATE plans SET status = 'submitted', emergency_control_id = ?, last_status_change_reason = ?, updated_at = ? WHERE id = ?",
      [controlId, reason, now, planId])
    
    run(db, "INSERT INTO approval_records (id, plan_id, node, action, operator_id, operator_role, comment, created_at) VALUES (?,?,?,?,?,?,?,?)",
      [genId(), planId, 'emergency_review', 'pending', operatorId, operatorRole, `管控复核: ${reason}`, now])
    
    logStatusChange(db, {
      planId,
      oldStatus,
      newStatus: 'submitted',
      changeType: 'control_review',
      reason,
      operatorId,
      operatorRole,
      emergencyControlId: controlId,
      metadata: { controlType, shipName: plan.ship_name }
    })
    
    run(db,
      `INSERT INTO alerts (id, type, level, title, message, related_voyage_id, related_ship_id, is_resolved, created_at) 
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [genId(), 'route_risk', 'warning', 
       `应急管控: ${plan.ship_name}需重新复核`, 
       `因${controlTitle}，该计划已退回待重新复核`,
       null, plan.ship_id as string, 0, now]
    )
    
    affectedPlans++
    logs.push(`已退回复核 ${plan.ship_name}: ${oldStatus} → submitted`)
  }

  const releasedPlans = all(db,
    `SELECT p.*, s.name as ship_name, v.id as voyage_id, v.status as voyage_status
     FROM plans p 
     LEFT JOIN ships s ON p.ship_id = s.id 
     LEFT JOIN voyages v ON p.voyage_id = v.id
     WHERE p.status = 'released' 
       AND v.status = 'active'
       AND (p.emergency_control_id IS NULL OR p.emergency_control_id != ?)`,
    [controlId]
  )

  for (const plan of releasedPlans) {
    const planId = plan.id as string
    const voyageId = plan.voyage_id as string
    const shipId = plan.ship_id as string
    const oldPlanStatus = plan.status as string
    const oldVoyageStatus = plan.voyage_status as string
    const shipName = plan.ship_name as string

    const releaseLog = getRow(db, 'SELECT id FROM release_logs WHERE plan_id = ? ORDER BY released_at DESC LIMIT 1', [planId])
    const releaseLogId = releaseLog ? releaseLog.id : null

    run(db, 'INSERT INTO revoke_logs (id, plan_id, release_log_id, operator_id, reason, revoked_at) VALUES (?,?,?,?,?,?)',
      [genId(), planId, releaseLogId, operatorId, reason, now])

    run(db, "UPDATE plans SET status = 'revoked', emergency_control_id = ?, last_status_change_reason = ?, updated_at = ? WHERE id = ?",
      [controlId, reason, now, planId])

    run(db, "UPDATE voyages SET status = 'closed', close_reason = ?, emergency_control_id = ?, last_status_change_reason = ?, closed_by = ?, closed_at = ? WHERE id = ?",
      [`应急管控召回: ${reason}`, controlId, reason, operatorId, now, voyageId])

    run(db, "UPDATE ships SET status = 'in_port', current_voyage_id = NULL, updated_at = ? WHERE id = ?", [now, shipId])

    run(db, "INSERT INTO approval_records (id, plan_id, node, action, operator_id, operator_role, comment, created_at) VALUES (?,?,?,?,?,?,?,?)",
      [genId(), planId, 'emergency_review', 'revoked', operatorId, operatorRole, `管控召回: ${reason}`, now])

    logStatusChange(db, {
      planId,
      voyageId,
      oldStatus: oldPlanStatus,
      newStatus: 'revoked',
      changeType: 'control_recall',
      reason,
      operatorId,
      operatorRole,
      emergencyControlId: controlId,
      metadata: { controlType, shipName, voyageStatus: oldVoyageStatus }
    })

    run(db,
      `INSERT INTO alerts (id, type, level, title, message, related_voyage_id, related_ship_id, is_resolved, created_at) 
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [genId(), 'abnormal_release', 'critical', 
       `应急管控: ${shipName}已被召回`, 
       `因${controlTitle}，该船舶已被紧急召回，请立即返港`,
       voyageId, shipId, 0, now]
    )

    affectedPlans++
    affectedVoyages++
    logs.push(`已召回船舶 ${shipName}: ${oldPlanStatus} → revoked, voyage: ${oldVoyageStatus} → closed`)
  }

  return { affectedPlans, affectedVoyages, logs }
}

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const status = req.query.status as string
    const controlType = req.query.controlType as string
    
    let sql = `SELECT ec.*, u.name as created_by_name, u2.name as ended_by_name 
               FROM emergency_controls ec 
               LEFT JOIN users u ON ec.created_by = u.id
               LEFT JOIN users u2 ON ec.ended_by = u2.id`
    const conditions: string[] = []
    const params: unknown[] = []

    if (status) {
      conditions.push('ec.status = ?')
      params.push(status)
    }
    if (controlType) {
      conditions.push('ec.control_type = ?')
      params.push(controlType)
    }
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ')
    }
    sql += ' ORDER BY ec.created_at DESC'

    const controls = all(db, sql, params)
    res.json({ success: true, data: controls })
  } catch (error) {
    res.status(500).json({ success: false, error: '获取应急管控列表失败' })
  }
})

router.get('/active', async (_req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const controls = all(db,
      `SELECT ec.*, u.name as created_by_name 
       FROM emergency_controls ec 
       LEFT JOIN users u ON ec.created_by = u.id
       WHERE ec.status = 'active' 
         AND datetime(ec.start_time) <= datetime(?) 
         AND datetime(ec.end_time) >= datetime(?)
       ORDER BY ec.created_at DESC`,
      [now, now]
    )
    res.json({ success: true, data: controls })
  } catch (error) {
    res.status(500).json({ success: false, error: '获取活跃应急管控失败' })
  }
})

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const control = getRow(db,
      `SELECT ec.*, u.name as created_by_name, u2.name as ended_by_name 
       FROM emergency_controls ec 
       LEFT JOIN users u ON ec.created_by = u.id
       LEFT JOIN users u2 ON ec.ended_by = u2.id
       WHERE ec.id = ?`,
      [req.params.id]
    )
    if (!control) {
      res.status(404).json({ success: false, error: '应急管控不存在' })
      return
    }

    const affectedPlans = all(db,
      `SELECT p.*, s.name as ship_name 
       FROM plans p 
       LEFT JOIN ships s ON p.ship_id = s.id 
       WHERE p.emergency_control_id = ?
       ORDER BY p.updated_at DESC`,
      [req.params.id]
    )

    const affectedVoyages = all(db,
      `SELECT v.*, s.name as ship_name 
       FROM voyages v 
       LEFT JOIN ships s ON v.ship_id = s.id 
       WHERE v.emergency_control_id = ?
       ORDER BY v.updated_at DESC`,
      [req.params.id]
    )

    const statusLogs = all(db,
      `SELECT scl.*, u.name as operator_name 
       FROM status_change_logs scl
       LEFT JOIN users u ON scl.operator_id = u.id
       WHERE scl.emergency_control_id = ?
       ORDER BY scl.created_at DESC`,
      [req.params.id]
    )

    res.json({ 
      success: true, 
      data: {
        ...control,
        affected_plans: affectedPlans,
        affected_voyages: affectedVoyages,
        status_logs: statusLogs
      } 
    })
  } catch (error) {
    res.status(500).json({ success: false, error: '获取应急管控详情失败' })
  }
})

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      controlType, title, description, affectedArea,
      startTime, endTime, riskLevel, autoProcess
    } = req.body

    if (!controlType || !title || !startTime || !endTime) {
      res.status(400).json({ success: false, error: '缺少必填字段' })
      return
    }

    const id = genId()
    const operatorId = (req.headers['x-user-id'] as string) || 'u3'
    const operatorRole = (req.headers['x-user-role'] as string) || 'supervisor'
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const db = await getDb()

    run(db,
      `INSERT INTO emergency_controls 
       (id, control_type, title, description, affected_area, start_time, end_time, 
        risk_level, status, created_by, created_at, updated_at) 
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, controlType, title, description || null, affectedArea || null,
       startTime, endTime, riskLevel || 'high', 'active', operatorId, now, now]
    )

    let processResult = { affectedPlans: 0, affectedVoyages: 0, logs: [] }
    if (autoProcess !== false) {
      processResult = await runEmergencyChecks(db, id, operatorId, operatorRole)
    }

    persist(db)

    const created = getRow(db, 'SELECT * FROM emergency_controls WHERE id = ?', [id])
    res.json({ 
      success: true, 
      data: {
        ...created,
        affected_plans: processResult.affectedPlans,
        affected_voyages: processResult.affectedVoyages,
        process_logs: processResult.logs
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, error: '发布应急管控失败' })
  }
})

router.post('/:id/end', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const control = getRow(db, 'SELECT * FROM emergency_controls WHERE id = ?', [req.params.id])
    if (!control) {
      res.status(404).json({ success: false, error: '应急管控不存在' })
      return
    }
    if (control.status !== 'active') {
      res.status(400).json({ success: false, error: '仅活跃状态可结束' })
      return
    }

    const { endReason } = req.body
    const operatorId = (req.headers['x-user-id'] as string) || 'u3'
    const operatorRole = (req.headers['x-user-role'] as string) || 'supervisor'
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

    run(db,
      `UPDATE emergency_controls 
       SET status = 'ended', ended_by = ?, ended_at = ?, updated_at = ? 
       WHERE id = ?`,
      [operatorId, now, now, req.params.id]
    )

    const affectedPlanIds = all(db,
      'SELECT id, ship_id FROM plans WHERE emergency_control_id = ? AND status = \"rejected\"',
      [req.params.id]
    )

    for (const plan of affectedPlanIds) {
      run(db,
        `INSERT INTO alerts (id, type, level, title, message, related_ship_id, is_resolved, created_at) 
         VALUES (?,?,?,?,?,?,?,?)`,
        [genId(), 'info', 'info',
         `管控解除: ${control.title}已结束`,
         `应急管控已结束，相关计划可重新提交`,
         plan.ship_id as string, 0, now]
      )
    }

    persist(db)

    const updated = getRow(db, 'SELECT * FROM emergency_controls WHERE id = ?', [req.params.id])
    res.json({ 
      success: true, 
      data: {
        ...updated,
        end_reason: endReason,
        notified_plans: affectedPlanIds.length
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, error: '结束应急管控失败' })
  }
})

router.post('/:id/process', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const control = getRow(db, 'SELECT * FROM emergency_controls WHERE id = ?', [req.params.id])
    if (!control) {
      res.status(404).json({ success: false, error: '应急管控不存在' })
      return
    }
    if (control.status !== 'active') {
      res.status(400).json({ success: false, error: '仅活跃状态可执行处理' })
      return
    }

    const operatorId = (req.headers['x-user-id'] as string) || 'u3'
    const operatorRole = (req.headers['x-user-role'] as string) || 'supervisor'

    const result = await runEmergencyChecks(db, req.params.id, operatorId, operatorRole)
    persist(db)

    res.json({ success: true, data: result })
  } catch (error) {
    res.status(500).json({ success: false, error: '执行应急管控处理失败' })
  }
})

router.get('/risk-aggregation', async (_req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

    const activeControls = all(db,
      `SELECT ec.*, u.name as created_by_name 
       FROM emergency_controls ec 
       LEFT JOIN users u ON ec.created_by = u.id
       WHERE ec.status = 'active' 
         AND datetime(ec.start_time) <= datetime(?) 
         AND datetime(ec.end_time) >= datetime(?)
       ORDER BY ec.risk_level DESC, ec.created_at DESC`,
      [now, now]
    )

    const criticalPlans = all(db,
      `SELECT p.id, p.status, p.route_risk_level, p.rejection_reason, p.last_status_change_reason,
              s.name as ship_name, s.id as ship_id, v.id as voyage_id, v.status as voyage_status
       FROM plans p
       LEFT JOIN ships s ON p.ship_id = s.id
       LEFT JOIN voyages v ON p.voyage_id = v.id
       WHERE p.emergency_control_id IS NOT NULL
         AND p.status NOT IN ('closed', 'withdrawn')
       ORDER BY p.route_risk_level DESC, p.updated_at DESC`
    )

    const pendingChangeRequests = all(db,
      `SELECT vcr.*, s.name as ship_name
       FROM voyage_change_requests vcr
       LEFT JOIN plans p ON vcr.plan_id = p.id
       LEFT JOIN ships s ON p.ship_id = s.id
       WHERE vcr.status = 'pending'
       ORDER BY vcr.created_at DESC`
    )

    const aggregation = {
      critical: criticalPlans.filter((p: any) =>
        p.route_risk_level === 'critical' || p.route_risk_level === 'high' ||
        (p.voyage_status && ['abnormal_return'].includes(p.voyage_status))
      ),
      warning: criticalPlans.filter((p: any) =>
        p.route_risk_level === 'medium' ||
        (p.status === 'rejected' && p.rejection_reason && String(p.rejection_reason).includes('应急'))
      ),
      info: criticalPlans.filter((p: any) =>
        p.route_risk_level === 'low' && p.status !== 'rejected'
      ),
      active_controls: activeControls,
      pending_change_requests: pendingChangeRequests,
      summary: {
        total_affected: criticalPlans.length,
        critical_count: criticalPlans.filter((p: any) =>
          p.route_risk_level === 'critical' || p.route_risk_level === 'high' ||
          (p.voyage_status && ['abnormal_return'].includes(p.voyage_status))
        ).length,
        warning_count: criticalPlans.filter((p: any) =>
          p.route_risk_level === 'medium' ||
          (p.status === 'rejected' && p.rejection_reason && String(p.rejection_reason).includes('应急'))
        ).length,
        info_count: criticalPlans.filter((p: any) =>
          p.route_risk_level === 'low' && p.status !== 'rejected'
        ).length,
        active_controls_count: activeControls.length,
        pending_change_requests_count: pendingChangeRequests.length
      }
    }

    res.json({ success: true, data: aggregation })
  } catch (error) {
    res.status(500).json({ success: false, error: '获取风险聚合数据失败' })
  }
})

router.get('/status-logs/:planId', async (req: Request, res: Response): Promise<void> => {
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

router.get('/voyage-status-logs/:voyageId', async (req: Request, res: Response): Promise<void> => {
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

export { logStatusChange }
export default router
