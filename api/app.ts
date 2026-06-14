import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import authRoutes from './routes/auth.js'
import shipRoutes from './routes/ships.js'
import crewRoutes from './routes/crew.js'
import berthRoutes from './routes/berths.js'
import planRoutes from './routes/plans.js'
import voyageRoutes from './routes/voyages.js'
import alertRoutes from './routes/alerts.js'
import statisticsRoutes from './routes/statistics.js'
import auditRoutes from './routes/audit.js'
import inspectionRoutes from './routes/inspections.js'
import emergencyRoutes from './routes/emergency.js'
import changeRequestRoutes from './routes/changeRequests.js'
import { getDb } from './database.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.use('/api/auth', authRoutes)
app.use('/api/ships', shipRoutes)
app.use('/api/crew', crewRoutes)
app.use('/api/berths', berthRoutes)
app.use('/api/plans', planRoutes)
app.use('/api/voyages', voyageRoutes)
app.use('/api/alerts', alertRoutes)
app.use('/api/statistics', statisticsRoutes)
app.use('/api/audit', auditRoutes)
app.use('/api/inspections', inspectionRoutes)
app.use('/api/emergency', emergencyRoutes)
app.use('/api/change-requests', changeRequestRoutes)

app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app
