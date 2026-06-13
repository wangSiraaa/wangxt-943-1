import { Router, type Request, type Response } from 'express'
import { getDb, all } from '../database.js'

const router = Router()

router.get('/approval-chain/:planId', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const records = all(db,
      `SELECT ar.*, u.name as operator_name FROM approval_records ar
       LEFT JOIN users u ON ar.operator_id = u.id
       WHERE ar.plan_id = ? ORDER BY ar.created_at`,
      [req.params.planId]
    )
    res.json({ success: true, data: records })
  } catch (error) {
    res.status(500).json({ success: false, error: '获取审批链失败' })
  }
})

router.get('/release-log', async (_req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const logs = all(db,
      `SELECT rl.*, s.name as ship_name, p.route, u.name as operator_name
       FROM release_logs rl
       LEFT JOIN ships s ON rl.ship_id = s.id
       LEFT JOIN plans p ON rl.plan_id = p.id
       LEFT JOIN users u ON rl.operator_id = u.id
       ORDER BY rl.released_at DESC`
    )
    res.json({ success: true, data: logs })
  } catch (error) {
    res.status(500).json({ success: false, error: '获取放行日志失败' })
  }
})

router.get('/revoke-log', async (_req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const logs = all(db,
      `SELECT rvl.*, s.name as ship_name, p.route, u.name as operator_name
       FROM revoke_logs rvl
       LEFT JOIN plans p ON rvl.plan_id = p.id
       LEFT JOIN users u ON rvl.operator_id = u.id
       LEFT JOIN release_logs rl ON rvl.release_log_id = rl.id
       LEFT JOIN ships s ON rl.ship_id = s.id
       ORDER BY rvl.revoked_at DESC`
    )
    res.json({ success: true, data: logs })
  } catch (error) {
    res.status(500).json({ success: false, error: '获取撤销日志失败' })
  }
})

export default router
