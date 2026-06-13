import { Router, type Request, type Response } from 'express'
import { getDb, all, get as getRow, run, persist } from '../database.js'

const router = Router()

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const type = req.query.type as string
    const resolved = req.query.resolved as string
    let sql = 'SELECT * FROM alerts'
    const conditions: string[] = []
    const params: unknown[] = []

    if (type) {
      conditions.push('type = ?')
      params.push(type)
    }
    if (resolved !== undefined) {
      conditions.push('is_resolved = ?')
      params.push(resolved === 'true' ? 1 : 0)
    }
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ')
    }
    sql += ' ORDER BY created_at DESC'

    const alerts = all(db, sql, params)
    res.json({ success: true, data: alerts })
  } catch (error) {
    res.status(500).json({ success: false, error: '获取预警列表失败' })
  }
})

router.put('/:id/resolve', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const existing = getRow(db, 'SELECT id FROM alerts WHERE id = ?', [req.params.id])
    if (!existing) {
      res.status(404).json({ success: false, error: '预警不存在' })
      return
    }

    run(db, 'UPDATE alerts SET is_resolved = 1 WHERE id = ?', [req.params.id])
    persist(db)

    const alert = getRow(db, 'SELECT * FROM alerts WHERE id = ?', [req.params.id])
    res.json({ success: true, data: alert })
  } catch (error) {
    res.status(500).json({ success: false, error: '处置预警失败' })
  }
})

router.get('/weather', async (_req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const weatherAlerts = all(db, "SELECT * FROM alerts WHERE type = 'weather' AND is_resolved = 0")
    const hasWarning = weatherAlerts.length > 0

    const windSpeed = 5 + Math.floor(Math.random() * 20)
    const waveHeight = parseFloat((0.5 + Math.random() * 3).toFixed(1))
    const visibility = 3 + Math.floor(Math.random() * 15)

    const weatherData = {
      temperature: 18 + Math.floor(Math.random() * 12),
      windDirection: ['东北', '东', '东南', '南', '西南', '西', '西北', '北'][Math.floor(Math.random() * 8)],
      windSpeed,
      waveHeight,
      visibility,
      condition: windSpeed > 15 ? '大风' : windSpeed > 10 ? '多云' : '晴朗',
      warning: hasWarning,
      warningDetails: hasWarning ? weatherAlerts : [],
      updatedAt: new Date().toISOString().replace('T', ' ').slice(0, 19)
    }

    res.json({ success: true, data: weatherData })
  } catch (error) {
    res.status(500).json({ success: false, error: '获取天气数据失败' })
  }
})

export default router
