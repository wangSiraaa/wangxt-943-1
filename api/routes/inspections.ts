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
    const { shipId, voyageId, inspectionResult } = req.query
    let sql = `SELECT i.*, s.name as ship_name, v.status as voyage_status, u.name as inspector_name 
              FROM inspections i 
              LEFT JOIN ships s ON i.ship_id = s.id 
              LEFT JOIN voyages v ON i.voyage_id = v.id
              LEFT JOIN users u ON i.inspector_id = u.id`
    const params: unknown[] = []
    const conditions: string[] = []

    if (shipId) {
      conditions.push('i.ship_id = ?')
      params.push(shipId)
    }
    if (voyageId) {
      conditions.push('i.voyage_id = ?')
      params.push(voyageId)
    }
    if (inspectionResult) {
      conditions.push('i.inspection_result = ?')
      params.push(inspectionResult)
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ')
    }
    sql += ' ORDER BY i.created_at DESC'

    const inspections = all(db, sql, params)
    res.json({ success: true, data: inspections })
  } catch (error) {
    res.status(500).json({ success: false, error: '获取临检记录失败' })
  }
})

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const inspection = getRow(db, 
      `SELECT i.*, s.name as ship_name, v.status as voyage_status, u.name as inspector_name 
       FROM inspections i 
       LEFT JOIN ships s ON i.ship_id = s.id 
       LEFT JOIN voyages v ON i.voyage_id = v.id
       LEFT JOIN users u ON i.inspector_id = u.id
       WHERE i.id = ?`, 
      [req.params.id]
    )
    if (!inspection) {
      res.status(404).json({ success: false, error: '临检记录不存在' })
      return
    }
    res.json({ success: true, data: inspection })
  } catch (error) {
    res.status(500).json({ success: false, error: '获取临检详情失败' })
  }
})

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      voyageId, shipId, inspectionType, inspectionResult,
      certificateCheck, crewCheck, cargoCheck, findings, comment
    } = req.body

    if (!voyageId || !shipId) {
      res.status(400).json({ success: false, error: '缺少必填字段：航次ID和船舶ID' })
      return
    }

    const id = genId()
    const db = await getDb()
    const inspectorId = (req.headers['x-user-id'] as string) || 'u3'
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

    run(db,
      `INSERT INTO inspections (id, voyage_id, ship_id, inspector_id, inspection_type, inspection_result,
       certificate_check, crew_check, cargo_check, findings, comment, created_at) 
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, voyageId, shipId, inspectorId, inspectionType || 'routine', inspectionResult || 'pending',
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

router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const existing = getRow(db, 'SELECT * FROM inspections WHERE id = ?', [req.params.id])
    if (!existing) {
      res.status(404).json({ success: false, error: '临检记录不存在' })
      return
    }
    if (existing.inspection_result !== 'pending') {
      res.status(400).json({ success: false, error: '仅待处理状态可编辑' })
      return
    }

    const {
      inspectionType, inspectionResult, certificateCheck,
      crewCheck, cargoCheck, findings, comment
    } = req.body
    const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

    run(db,
      `UPDATE inspections SET 
       inspection_type=COALESCE(?,inspection_type),
       inspection_result=COALESCE(?,inspection_result),
       certificate_check=COALESCE(?,certificate_check),
       crew_check=COALESCE(?,crew_check),
       cargo_check=COALESCE(?,cargo_check),
       findings=COALESCE(?,findings),
       comment=COALESCE(?,comment),
       created_at=?
       WHERE id=?`,
      [inspectionType || null, inspectionResult || null,
       certificateCheck ?? null, crewCheck ?? null, cargoCheck ?? null,
       findings || null, comment || null, now, req.params.id]
    )

    persist(db)
    const updated = getRow(db, 'SELECT * FROM inspections WHERE id = ?', [req.params.id])
    res.json({ success: true, data: updated })
  } catch (error) {
    res.status(500).json({ success: false, error: '更新临检记录失败' })
  }
})

router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const existing = getRow(db, 'SELECT * FROM inspections WHERE id = ?', [req.params.id])
    if (!existing) {
      res.status(404).json({ success: false, error: '临检记录不存在' })
      return
    }

    run(db, 'DELETE FROM inspections WHERE id = ?', [req.params.id])
    persist(db)
    res.json({ success: true, data: { message: '删除成功' } })
  } catch (error) {
    res.status(500).json({ success: false, error: '删除临检记录失败' })
  }
})

export default router
