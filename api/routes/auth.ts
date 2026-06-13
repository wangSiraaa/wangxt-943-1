import { Router, type Request, type Response } from 'express'
import { getDb, all, get as getRow, run, persist } from '../database.js'

const router = Router()

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, password } = req.body
    if (!username || !password) {
      res.status(400).json({ success: false, error: '用户名和密码不能为空' })
      return
    }

    const db = await getDb()
    const user = getRow(db, 'SELECT id, username, role, name FROM users WHERE username = ? AND password = ?', [username, password])

    if (!user) {
      res.status(401).json({ success: false, error: '用户名或密码错误' })
      return
    }

    res.json({ success: true, data: user })
  } catch (error) {
    res.status(500).json({ success: false, error: '登录失败' })
  }
})

router.get('/me', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.headers['x-user-id'] as string
    if (!userId) {
      res.status(401).json({ success: false, error: '未提供用户标识' })
      return
    }

    const db = await getDb()
    const user = getRow(db, 'SELECT id, username, role, name FROM users WHERE id = ?', [userId])

    if (!user) {
      res.status(404).json({ success: false, error: '用户不存在' })
      return
    }

    res.json({ success: true, data: user })
  } catch (error) {
    res.status(500).json({ success: false, error: '获取用户信息失败' })
  }
})

export default router
