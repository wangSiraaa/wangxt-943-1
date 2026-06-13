import { Router, type Request, type Response } from 'express'
import { getDb, all, get as getRow, run, persist } from '../database.js'

const router = Router()

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const ships = all(db, 'SELECT * FROM ships ORDER BY created_at DESC')
    res.json({ success: true, data: ships })
  } catch (error) {
    res.status(500).json({ success: false, error: '获取船舶列表失败' })
  }
})

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const ship = getRow(db, 'SELECT * FROM ships WHERE id = ?', [req.params.id])
    if (!ship) {
      res.status(404).json({ success: false, error: '船舶不存在' })
      return
    }
    res.json({ success: true, data: ship })
  } catch (error) {
    res.status(500).json({ success: false, error: '获取船舶详情失败' })
  }
})

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, name, type, tonnage, length, status } = req.body
    if (!id || !name || !type) {
      res.status(400).json({ success: false, error: '缺少必填字段' })
      return
    }
    const db = await getDb()
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    run(db, 'INSERT INTO ships (id, name, type, tonnage, length, status, current_voyage_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)',
      [id, name, type, tonnage || 0, length || 0, status || 'in_port', null, now, now])
    persist(db)
    res.status(201).json({ success: true, data: { id, name, type, tonnage, length, status: status || 'in_port' } })
  } catch (error) {
    res.status(500).json({ success: false, error: '创建船舶失败' })
  }
})

router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const existing = getRow(db, 'SELECT id FROM ships WHERE id = ?', [req.params.id])
    if (!existing) {
      res.status(404).json({ success: false, error: '船舶不存在' })
      return
    }
    const { name, type, tonnage, length, status } = req.body
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    run(db, 'UPDATE ships SET name=COALESCE(?,name), type=COALESCE(?,type), tonnage=COALESCE(?,tonnage), length=COALESCE(?,length), status=COALESCE(?,status), updated_at=? WHERE id=?',
      [name || null, type || null, tonnage ?? null, length ?? null, status || null, now, req.params.id])
    persist(db)
    const ship = getRow(db, 'SELECT * FROM ships WHERE id = ?', [req.params.id])
    res.json({ success: true, data: ship })
  } catch (error) {
    res.status(500).json({ success: false, error: '更新船舶失败' })
  }
})

router.get('/:id/certificates', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const certs = all(db, 'SELECT * FROM certificates WHERE ship_id = ? ORDER BY created_at', [req.params.id])
    res.json({ success: true, data: certs })
  } catch (error) {
    res.status(500).json({ success: false, error: '获取证书列表失败' })
  }
})

router.post('/:id/certificates', async (req: Request, res: Response): Promise<void> => {
  try {
    const shipId = req.params.id
    const { id, type, issueDate, expireDate, status } = req.body
    if (!id || !type || !issueDate || !expireDate) {
      res.status(400).json({ success: false, error: '缺少必填字段' })
      return
    }
    const db = await getDb()
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    run(db, 'INSERT INTO certificates (id, ship_id, type, issue_date, expire_date, status, created_at) VALUES (?,?,?,?,?,?,?)',
      [id, shipId, type, issueDate, expireDate, status || 'valid', now])
    persist(db)
    res.status(201).json({ success: true, data: { id, ship_id: shipId, type, issue_date: issueDate, expire_date: expireDate, status: status || 'valid' } })
  } catch (error) {
    res.status(500).json({ success: false, error: '创建证书失败' })
  }
})

router.get('/:id/voyages', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const voyages = all(db, 
      `SELECT v.*, p.route, p.departure_time as plan_departure, 
              p.expected_return_time as plan_return, p.route_risk_level
       FROM voyages v 
       LEFT JOIN plans p ON v.plan_id = p.id 
       WHERE v.ship_id = ? 
       ORDER BY v.created_at DESC`, 
      [req.params.id]
    )
    res.json({ success: true, data: voyages })
  } catch (error) {
    res.status(500).json({ success: false, error: '获取船舶航次历史失败' })
  }
})

router.get('/:id/crew', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const crew = all(db, 
      `SELECT c.*, 
        CASE WHEN date(c.qualification_expire_date) < date('now') THEN 'expired'
             WHEN date(c.qualification_expire_date) < date('now', '+30 days') THEN 'expiring_soon'
             ELSE 'valid' END as qualification_status
       FROM crew c 
       WHERE c.ship_id = ? 
       ORDER BY c.created_at`, 
      [req.params.id]
    )
    res.json({ success: true, data: crew })
  } catch (error) {
    res.status(500).json({ success: false, error: '获取船舶船员列表失败' })
  }
})

router.get('/:id/inspections', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const inspections = all(db, 
      `SELECT i.*, v.status as voyage_status, u.name as inspector_name
       FROM inspections i 
       LEFT JOIN voyages v ON i.voyage_id = v.id
       LEFT JOIN users u ON i.inspector_id = u.id
       WHERE i.ship_id = ? 
       ORDER BY i.created_at DESC`, 
      [req.params.id]
    )
    res.json({ success: true, data: inspections })
  } catch (error) {
    res.status(500).json({ success: false, error: '获取船舶临检记录失败' })
  }
})

router.post('/check-certificates', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const now = new Date()
    const thirtyDaysLater = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10)
    const today = now.toISOString().slice(0, 10)

    const expiredCerts = all(db, 
      `SELECT c.*, s.name as ship_name 
       FROM certificates c 
       LEFT JOIN ships s ON c.ship_id = s.id 
       WHERE date(c.expire_date) < date(?) 
       AND c.status != 'expired'`,
      [today]
    )

    const expiringCerts = all(db, 
      `SELECT c.*, s.name as ship_name 
       FROM certificates c 
       LEFT JOIN ships s ON c.ship_id = s.id 
       WHERE date(c.expire_date) >= date(?) 
       AND date(c.expire_date) <= date(?)
       AND c.status != 'expiring_soon'
       AND c.status != 'expired'`,
      [today, thirtyDaysLater]
    )

    for (const cert of expiredCerts) {
      run(db, "UPDATE certificates SET status = 'expired' WHERE id = ?", [cert.id as string])
      run(db, 
        "INSERT INTO alerts (id, type, level, title, message, related_ship_id, is_resolved, created_at) VALUES (?,?,?,?,?,?,?,?)",
        [crypto.randomUUID(), 'cert_expire', 'critical', 
         `证书过期: ${cert.ship_name}的${cert.type}`, 
         `证书已于${cert.expire_date}过期，请立即更新`,
         cert.ship_id as string, 0, now.toISOString().replace('T', ' ').slice(0, 19)]
      )
    }

    for (const cert of expiringCerts) {
      run(db, "UPDATE certificates SET status = 'expiring_soon' WHERE id = ?", [cert.id as string])
      run(db, 
        "INSERT INTO alerts (id, type, level, title, message, related_ship_id, is_resolved, created_at) VALUES (?,?,?,?,?,?,?,?)",
        [crypto.randomUUID(), 'cert_expire', 'warning', 
         `证书即将过期: ${cert.ship_name}的${cert.type}`, 
         `证书将于${cert.expire_date}过期，请及时更新`,
         cert.ship_id as string, 0, now.toISOString().replace('T', ' ').slice(0, 19)]
      )
    }

    persist(db)
    res.json({ 
      success: true, 
      data: { 
        expired: expiredCerts.length, 
        expiring: expiringCerts.length,
        expiredList: expiredCerts.map(c => ({ ship: c.ship_name, type: c.type, date: c.expire_date })),
        expiringList: expiringCerts.map(c => ({ ship: c.ship_name, type: c.type, date: c.expire_date }))
      } 
    })
  } catch (error) {
    res.status(500).json({ success: false, error: '检查证书有效期失败' })
  }
})

export default router
