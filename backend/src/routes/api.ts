import { Router, Request, Response } from 'express';
import { ZodError } from 'zod';
import {
  submitVoyagePlan,
  getVoyageDetail,
  listVoyages,
  verifyVoyageCrew,
  departVoyageService,
  returnVoyageService,
  closeVoyageService,
} from '../services/voyageService';
import {
  getActiveWeatherAlert,
  listWeatherAlerts,
  setWeatherAlert,
} from '../repositories/weatherRepository';
import { listUsers, getUserById } from '../repositories/userRepository';
import {
  getAllAuditLogs,
} from '../repositories/voyageRepository';
import type { CrewVerification, UserRole } from '../types';

const router = Router();

function handleError(res: Response, error: unknown): void {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: '参数校验失败',
      details: error.errors.map((e) => e.message),
    });
    return;
  }
  if (error instanceof Error) {
    res.status(400).json({ error: error.message });
    return;
  }
  res.status(500).json({ error: '服务器内部错误' });
}

router.get('/users', (req: Request, res: Response) => {
  try {
    const role = req.query.role as UserRole | undefined;
    const users = listUsers(role);
    res.json({ users });
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/users/:id', (req: Request, res: Response) => {
  try {
    const user = getUserById(req.params.id);
    if (!user) {
      res.status(404).json({ error: '用户不存在' });
      return;
    }
    res.json({ user });
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/weather/alert', (_req: Request, res: Response) => {
  try {
    const alert = getActiveWeatherAlert();
    res.json({ alert });
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/weather/alerts', (_req: Request, res: Response) => {
  try {
    const alerts = listWeatherAlerts();
    res.json({ alerts });
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/weather/alert', (req: Request, res: Response) => {
  try {
    const alert = setWeatherAlert(req.body);
    res.status(201).json({ alert });
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/audit-logs', (_req: Request, res: Response) => {
  try {
    const logs = getAllAuditLogs();
    res.json({ logs });
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/voyages', (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const captainId = req.query.captainId as string | undefined;
    const voyages = listVoyages(status, captainId);
    res.json({ voyages });
  } catch (err) {
    handleError(res, err);
  }
});

router.get('/voyages/:id', (req: Request, res: Response) => {
  try {
    const detail = getVoyageDetail(req.params.id);
    res.json(detail);
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/voyages', (req: Request, res: Response) => {
  try {
    const voyage = submitVoyagePlan(req.body);
    res.status(201).json({ voyage });
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/voyages/:id/verify-crew', (req: Request, res: Response) => {
  try {
    const { verifiedBy, crewVerifications } = req.body as {
      verifiedBy: string;
      crewVerifications: CrewVerification[];
    };
    if (!verifiedBy) {
      res.status(400).json({ error: '核验人不能为空' });
      return;
    }
    if (!Array.isArray(crewVerifications) || crewVerifications.length === 0) {
      res.status(400).json({ error: '船员核验数据不能为空' });
      return;
    }
    const success = verifyVoyageCrew(
      req.params.id,
      verifiedBy,
      crewVerifications,
    );
    res.json({ success });
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/voyages/:id/depart', (req: Request, res: Response) => {
  try {
    const { departedBy } = req.body as { departedBy: string };
    if (!departedBy) {
      res.status(400).json({ error: '放行人不能为空' });
      return;
    }
    const success = departVoyageService(req.params.id, departedBy);
    if (!success) {
      res.status(400).json({ error: '放行失败，请检查航次状态' });
      return;
    }
    res.json({ success });
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/voyages/:id/return', (req: Request, res: Response) => {
  try {
    const { returnedBy } = req.body as { returnedBy: string };
    if (!returnedBy) {
      res.status(400).json({ error: '登记人不能为空' });
      return;
    }
    const success = returnVoyageService(req.params.id, returnedBy);
    if (!success) {
      res.status(400).json({ error: '返港登记失败，请检查航次状态' });
      return;
    }
    res.json({ success });
  } catch (err) {
    handleError(res, err);
  }
});

router.post('/voyages/:id/close', (req: Request, res: Response) => {
  try {
    const { closedBy } = req.body as { closedBy: string };
    if (!closedBy) {
      res.status(400).json({ error: '关闭人不能为空' });
      return;
    }
    const success = closeVoyageService(req.params.id, closedBy);
    if (!success) {
      res.status(400).json({ error: '关闭失败，请检查航次是否已返港' });
      return;
    }
    res.json({ success });
  } catch (err) {
    handleError(res, err);
  }
});

export default router;
