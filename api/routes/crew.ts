import { Router, type Request, type Response } from 'express'
import { getDb, all, get as getRow, run, persist } from '../database.js'

const router = Router()

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const crew = all(db, 'SELECT * FROM crew ORDER BY created_at DESC')
    res.json({ success: true, data: crew })
  } catch (error) {
    res.status(500).json({ success: false, error: '获取船员列表失败' })
  }
})

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, name, role, qualificationType, qualificationExpireDate, shipId } = req.body
    if (!id || !name || !role) {
      res.status(400).json({ success: false, error: '缺少必填字段' })
      return
    }
    const db = await getDb()
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    run(db, 'INSERT INTO crew (id, name, role, qualification_type, qualification_expire_date, is_blacklisted, ship_id, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)',
      [id, name, role, qualificationType || '', qualificationExpireDate || '', 0, shipId || null, now, now])
    persist(db)
    res.status(201).json({ success: true, data: { id, name, role, qualification_type: qualificationType, is_blacklisted: 0 } })
  } catch (error) {
    res.status(500).json({ success: false, error: '创建船员失败' })
  }
})

router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const existing = getRow(db, 'SELECT id FROM crew WHERE id = ?', [req.params.id])
    if (!existing) {
      res.status(404).json({ success: false, error: '船员不存在' })
      return
    }
    const { name, role, qualificationType, qualificationExpireDate, shipId } = req.body
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    run(db, 'UPDATE crew SET name=COALESCE(?,name), role=COALESCE(?,role), qualification_type=COALESCE(?,qualification_type), qualification_expire_date=COALESCE(?,qualification_expire_date), ship_id=COALESCE(?,ship_id), updated_at=? WHERE id=?',
      [name || null, role || null, qualificationType || null, qualificationExpireDate || null, shipId !== undefined ? shipId : null, now, req.params.id])
    persist(db)
    const crew = getRow(db, 'SELECT * FROM crew WHERE id = ?', [req.params.id])
    res.json({ success: true, data: crew })
  } catch (error) {
    res.status(500).json({ success: false, error: '更新船员失败' })
  }
})

router.put('/:id/blacklist', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const existing = getRow(db, 'SELECT id, is_blacklisted FROM crew WHERE id = ?', [req.params.id])
    if (!existing) {
      res.status(404).json({ success: false, error: '船员不存在' })
      return
    }
    const currentBlacklist = existing.is_blacklisted as number
    const newBlacklist = currentBlacklist === 0 ? 1 : 0
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
    run(db, 'UPDATE crew SET is_blacklisted = ?, updated_at = ? WHERE id = ?', [newBlacklist, now, req.params.id])
    persist(db)
    const crew = getRow(db, 'SELECT * FROM crew WHERE id = ?', [req.params.id])
    res.json({ success: true, data: crew })
  } catch (error) {
    res.status(500).json({ success: false, error: '更新黑名单状态失败' })
  }
})

export default router
