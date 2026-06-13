import { Router, type Request, type Response } from 'express'
import { getDb, all } from '../database.js'

const router = Router()

router.get('/overview', async (_req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()

    const shipStats = all(db, "SELECT status, COUNT(*) as cnt FROM ships GROUP BY status")
    const shipMap: Record<string, number> = {}
    for (const row of shipStats) {
      shipMap[row.status as string] = row.cnt as number
    }

    const planStats = all(db, "SELECT status, COUNT(*) as cnt FROM plans GROUP BY status")
    const planMap: Record<string, number> = {}
    for (const row of planStats) {
      planMap[row.status as string] = row.cnt as number
    }

    const voyageStats = all(db, "SELECT status, COUNT(*) as cnt FROM voyages GROUP BY status")
    const voyageMap: Record<string, number> = {}
    for (const row of voyageStats) {
      voyageMap[row.status as string] = row.cnt as number
    }

    const alertRows = all(db, "SELECT COUNT(*) as cnt FROM alerts WHERE is_resolved = 0")
    const unresolvedAlerts = alertRows.length > 0 ? (alertRows[0].cnt as number) : 0

    const berthStats = all(db, "SELECT SUM(capacity) as total, SUM(occupied) as occ FROM berths WHERE status != 'maintenance'")
    const berthTotal = berthStats.length > 0 ? (berthStats[0].total as number || 0) : 0
    const berthOccupied = berthStats.length > 0 ? (berthStats[0].occ as number || 0) : 0

    const certStats = all(db, "SELECT status, COUNT(*) as cnt FROM certificates GROUP BY status")
    const certMap: Record<string, number> = {}
    for (const row of certStats) {
      certMap[row.status as string] = row.cnt as number
    }

    res.json({
      success: true,
      data: {
        ships: {
          inPort: shipMap['in_port'] || 0,
          atSea: shipMap['at_sea'] || 0,
          maintenance: shipMap['maintenance'] || 0,
          total: Object.values(shipMap).reduce((a, b) => a + b, 0)
        },
        plans: {
          draft: planMap['draft'] || 0,
          submitted: planMap['submitted'] || 0,
          reviewing: planMap['reviewing'] || 0,
          released: planMap['released'] || 0,
          rejected: planMap['rejected'] || 0,
          revoked: planMap['revoked'] || 0,
          total: Object.values(planMap).reduce((a, b) => a + b, 0)
        },
        voyages: {
          active: voyageMap['active'] || 0,
          returning: voyageMap['returning'] || 0,
          abnormalReturn: voyageMap['abnormal_return'] || 0,
          closed: voyageMap['closed'] || 0,
          total: Object.values(voyageMap).reduce((a, b) => a + b, 0)
        },
        alerts: { unresolved: unresolvedAlerts },
        berths: { total: berthTotal, occupied: berthOccupied, available: berthTotal - berthOccupied },
        certificates: certMap
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, error: '获取总览统计失败' })
  }
})

router.get('/trends', async (req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()
    const days = parseInt(req.query.days as string) || 7

    const trends = []
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(Date.now() - i * 86400000)
      const dateStr = date.toISOString().slice(0, 10)

      const depRows = all(db, "SELECT COUNT(*) as cnt FROM voyages WHERE date(departure_time) = date(?)", [dateStr])
      const retRows = all(db, "SELECT COUNT(*) as cnt FROM voyages WHERE date(actual_return_time) = date(?)", [dateStr])

      trends.push({
        date: dateStr,
        departures: depRows.length > 0 ? (depRows[0].cnt as number) : 0,
        returns: retRows.length > 0 ? (retRows[0].cnt as number) : 0
      })
    }

    res.json({ success: true, data: trends })
  } catch (error) {
    res.status(500).json({ success: false, error: '获取趋势数据失败' })
  }
})

router.get('/compliance', async (_req: Request, res: Response): Promise<void> => {
  try {
    const db = await getDb()

    const totalRows = all(db, "SELECT COUNT(*) as cnt FROM plans")
    const total = totalRows.length > 0 ? (totalRows[0].cnt as number) : 0

    const rejectedRows = all(db, "SELECT COUNT(*) as cnt FROM plans WHERE status = 'rejected'")
    const rejected = rejectedRows.length > 0 ? (rejectedRows[0].cnt as number) : 0

    const revokedRows = all(db, "SELECT COUNT(*) as cnt FROM revoke_logs")
    const revoked = revokedRows.length > 0 ? (revokedRows[0].cnt as number) : 0

    const abnormalRows = all(db, "SELECT COUNT(*) as cnt FROM voyages WHERE status = 'abnormal_return'")
    const abnormal = abnormalRows.length > 0 ? (abnormalRows[0].cnt as number) : 0

    const voyageRows = all(db, "SELECT COUNT(*) as cnt FROM voyages")
    const voyages = voyageRows.length > 0 ? (voyageRows[0].cnt as number) : 0

    const reasons = all(db, "SELECT rejection_reason, COUNT(*) as cnt FROM plans WHERE status = 'rejected' AND rejection_reason IS NOT NULL GROUP BY rejection_reason")

    const avgRows = all(db,
      `SELECT AVG(julianday(ar2.created_at) - julianday(ar1.created_at)) * 24 as avg_hours
       FROM approval_records ar1
       JOIN approval_records ar2 ON ar1.plan_id = ar2.plan_id
       WHERE ar1.node = 'auto_check' AND ar1.action = 'approved'
       AND ar2.node = 'dock_release' AND ar2.action = 'approved'`
    )
    const avgHours = avgRows.length > 0 && avgRows[0].avg_hours
      ? parseFloat(Number(avgRows[0].avg_hours).toFixed(2))
      : 0

    res.json({
      success: true,
      data: {
        rejectionRate: total > 0 ? parseFloat(((rejected / total) * 100).toFixed(1)) : 0,
        revocationRate: total > 0 ? parseFloat(((revoked / total) * 100).toFixed(1)) : 0,
        abnormalReturnRate: voyages > 0 ? parseFloat(((abnormal / voyages) * 100).toFixed(1)) : 0,
        avgApprovalHours: avgHours,
        rejectionReasons: reasons,
        totalPlans: total,
        rejectedPlans: rejected,
        revokedReleases: revoked,
        abnormalVoyages: abnormal
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, error: '获取合规统计失败' })
  }
})

export default router
