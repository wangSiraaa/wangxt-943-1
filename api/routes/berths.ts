import { Router, type Request, type Response } from 'express'
import { getDb, all, get as getRow, run, persist } from '../database.js'

const router = Router()

router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const berths = all(db, 'SELECT * FROM berths ORDER BY name')
    res.json({ success: true, data: berths })
  } catch (error) {
    res.status(500).json({ success: false, error: '获取泊位列表失败' })
  }
})

router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const existing = getRow(db, 'SELECT id FROM berths WHERE id = ?', [req.params.id])
    if (!existing) {
      res.status(404).json({ success: false, error: '泊位不存在' })
      return
    }
    const { capacity, occupied, status } = req.body
    run(db, 'UPDATE berths SET capacity=COALESCE(?,capacity), occupied=COALESCE(?,occupied), status=COALESCE(?,status) WHERE id=?',
      [capacity ?? null, occupied ?? null, status || null, req.params.id])
    persist(db)
    const berth = getRow(db, 'SELECT * FROM berths WHERE id = ?', [req.params.id])
    res.json({ success: true, data: berth })
  } catch (error) {
    res.status(500).json({ success: false, error: '更新泊位失败' })
  }
})

export default router
