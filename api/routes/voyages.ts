import { Router, type Request, type Response } from 'express'
import { getDb, all, get as getRow, run, persist } from '../database.js'
import crypto from 'crypto'

const router = Router()

function genId(): string {
  return crypto.randomUUID()
}

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const status = req.query.status as string
    let sql = `SELECT v.*, s.name as ship_name, p.route FROM voyages v LEFT JOIN ships s ON v.ship_id = s.id LEFT JOIN plans p ON v.plan_id = p.id`
    const params: unknown[] = []
    if (status) {
      sql += ' WHERE v.status = ?'
      params.push(status)
    }
    sql += ' ORDER BY v.created_at DESC'
    const voyages = all(db, sql, params)
    res.json({ success: true, data: voyages })
  } catch (error) {
    res.status(500).json({ success: false, error: '获取航次列表失败' })
  }
})

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const voyage = getRow(db, `SELECT v.*, s.name as ship_name, p.route FROM voyages v LEFT JOIN ships s ON v.ship_id = s.id LEFT JOIN plans p ON v.plan_id = p.id WHERE v.id = ?`, [req.params.id])
    if (!voyage) {
      res.status(404).json({ success: false, error: '航次不存在' })
      return
    }

    voyage.alerts = all(db, 'SELECT * FROM alerts WHERE related_voyage_id = ?', [req.params.id])
    voyage.approval_records = all(db, 'SELECT * FROM approval_records WHERE plan_id = ? ORDER BY created_at', [voyage.plan_id as string])

    res.json({ success: true, data: voyage })
  } catch (error) {
    res.status(500).json({ success: false, error: '获取航次详情失败' })
  }
})

router.post('/:id/return', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const voyage = getRow(db, 'SELECT * FROM voyages WHERE id = ?', [req.params.id])
    if (!voyage) {
      res.status(404).json({ success: false, error: '航次不存在' })
      return
    }
    if (voyage.status !== 'active') {
      res.status(400).json({ success: false, error: '仅活跃航次可登记返港' })
      return
    }

    const { actualReturnTime, returnDeviation } = req.body
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const returnTime = actualReturnTime || now

    const expectedReturn = new Date(voyage.expected_return_time as string).getTime()
    const actualReturn = new Date(returnTime).getTime()
    const isOverdue = actualReturn > expectedReturn
    const newStatus = isOverdue || returnDeviation ? 'abnormal_return' : 'returning'

    run(db, 'UPDATE voyages SET status = ?, actual_return_time = ?, return_deviation = ? WHERE id = ?',
      [newStatus, returnTime, returnDeviation || (isOverdue ? '返港超时' : null), req.params.id])

    if (newStatus === 'abnormal_return') {
      run(db, "INSERT INTO alerts (id, type, level, title, message, related_voyage_id, related_ship_id, is_resolved, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
        [genId(), 'return_timeout', isOverdue ? 'critical' : 'warning',
         isOverdue ? '返港超时告警' : '异常返港告警',
         isOverdue ? '船舶返港时间超过预计返港时间' : `偏差原因: ${returnDeviation || '未说明'}`,
         req.params.id, voyage.ship_id, 0, now])
    }

    run(db, "UPDATE ships SET status = 'in_port', current_voyage_id = NULL, updated_at = ? WHERE id = ?",
      [now, voyage.ship_id])

    persist(db)
    const updated = getRow(db, 'SELECT * FROM voyages WHERE id = ?', [req.params.id])
    res.json({ success: true, data: updated })
  } catch (error) {
    res.status(500).json({ success: false, error: '返港登记失败' })
  }
})

router.post('/:id/review-return', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const voyage = getRow(db, 'SELECT status, ship_id FROM voyages WHERE id = ?', [req.params.id])
    if (!voyage) {
      res.status(404).json({ success: false, error: '航次不存在' })
      return
    }
    if (voyage.status !== 'abnormal_return') {
      res.status(400).json({ success: false, error: '仅异常返港状态可复核' })
      return
    }

    const { approved } = req.body

    if (approved) {
      run(db, "UPDATE voyages SET status = 'returning' WHERE id = ?", [req.params.id])
    }

    const unresolvedAlerts = all(db, "SELECT id FROM alerts WHERE related_voyage_id = ? AND is_resolved = 0", [req.params.id])
    for (const alert of unresolvedAlerts) {
      run(db, 'UPDATE alerts SET is_resolved = 1 WHERE id = ?', [alert.id])
    }

    persist(db)
    const updated = getRow(db, 'SELECT * FROM voyages WHERE id = ?', [req.params.id])
    res.json({ success: true, data: updated })
  } catch (error) {
    res.status(500).json({ success: false, error: '异常返港复核失败' })
  }
})

router.post('/:id/close', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const voyage = getRow(db, 'SELECT status FROM voyages WHERE id = ?', [req.params.id])
    if (!voyage) {
      res.status(404).json({ success: false, error: '航次不存在' })
      return
    }
    if (voyage.status !== 'returning') {
      res.status(400).json({ success: false, error: '仅返港中状态可关闭' })
      return
    }

    const { closeReason } = req.body
    const operatorId = (req.headers['x-user-id'] as string) || 'u3'
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

    run(db, "UPDATE voyages SET status = 'closed', close_reason = ?, closed_by = ?, closed_at = ? WHERE id = ?",
      [closeReason || '航次正常关闭', operatorId, now, req.params.id])

    persist(db)
    const updated = getRow(db, 'SELECT * FROM voyages WHERE id = ?', [req.params.id])
    res.json({ success: true, data: updated })
  } catch (error) {
    res.status(500).json({ success: false, error: '关闭航次失败' })
  }
})

router.get('/:id/approvals', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const voyage = getRow(db, 'SELECT plan_id FROM voyages WHERE id = ?', [req.params.id])
    if (!voyage) {
      res.status(404).json({ success: false, error: '航次不存在' })
      return
    }

    const records = all(db, 
      `SELECT ar.*, u.name as operator_name 
       FROM approval_records ar 
       LEFT JOIN users u ON ar.operator_id = u.id 
       WHERE ar.plan_id = ? 
       ORDER BY ar.created_at`, 
      [voyage.plan_id as string]
    )
    res.json({ success: true, data: records })
  } catch (error) {
    res.status(500).json({ success: false, error: '获取航次审批记录失败' })
  }
})

router.post('/check-return-timeout', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const overdueVoyages = all(db, 
      `SELECT v.*, s.name as ship_name 
       FROM voyages v 
       LEFT JOIN ships s ON v.ship_id = s.id 
       WHERE v.status = 'active' AND datetime(v.expected_return_time) < datetime('now')`
    )

    const alertsGenerated: string[] = []
    for (const voyage of overdueVoyages) {
      const existingAlert = getRow(db, 
        "SELECT id FROM alerts WHERE related_voyage_id = ? AND type = 'return_timeout' AND is_resolved = 0",
        [voyage.id as string]
      )
      if (!existingAlert) {
        const alertId = genId()
        run(db, 
          "INSERT INTO alerts (id, type, level, title, message, related_voyage_id, related_ship_id, is_resolved, created_at) VALUES (?,?,?,?,?,?,?,?,?)",
          [alertId, 'return_timeout', 'warning', 
           `返港超时预警: ${voyage.ship_name}`, 
           `船舶预计返港时间已过，请关注船舶安全`,
           voyage.id as string, voyage.ship_id as string, 0, now]
        )
        alertsGenerated.push(voyage.ship_name as string)
      }
    }

    persist(db)
    res.json({ 
      success: true, 
      data: { 
        checked: overdueVoyages.length, 
        alertsGenerated: alertsGenerated.length,
        ships: alertsGenerated
      } 
    })
  } catch (error) {
    res.status(500).json({ success: false, error: '检查返港超时失败' })
  }
})

router.post('/:id/inspection', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const voyage = getRow(db, 'SELECT * FROM voyages WHERE id = ?', [req.params.id])
    if (!voyage) {
      res.status(404).json({ success: false, error: '航次不存在' })
      return
    }

    const { inspectionType, inspectionResult, certificateCheck, crewCheck, cargoCheck, findings, comment } = req.body
    const inspectorId = (req.headers['x-user-id'] as string) || 'u3'
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    const id = genId()

    run(db,
      `INSERT INTO inspections (id, voyage_id, ship_id, inspector_id, inspection_type, inspection_result,
       certificate_check, crew_check, cargo_check, findings, comment, created_at) 
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, req.params.id, voyage.ship_id, inspectorId, inspectionType || 'routine', inspectionResult || 'pending',
       certificateCheck ? 1 : 0, crewCheck ? 1 : 0, cargoCheck ? 1 : 0,
       findings || null, comment || null, now]
    )

    persist(db)
    const created = getRow(db, 'SELECT * FROM inspections WHERE id = ?', [id])
    res.status(201).json({ success: true, data: created })
  } catch (error) {
    res.status(500).json({ success: false, error: '创建临检记录失败' })
  }
})

export default router
