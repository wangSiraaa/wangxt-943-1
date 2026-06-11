import { z } from 'zod';
import {
  createVoyage,
  getVoyageById,
  getVoyagesByCaptain,
  getVoyagesByStatus,
  getCrewByVoyage,
  verifyCrew,
  departVoyage,
  returnVoyage,
  closeVoyage,
  getAuditLogsByVoyage,
} from '../repositories/voyageRepository';
import {
  getActiveWeatherAlert,
  isWeatherWarningActive,
} from '../repositories/weatherRepository';
import { getUserById } from '../repositories/userRepository';
import type { CrewVerification, Voyage, CrewMember, AuditLog } from '../types';

export const createVoyageSchema = z.object({
  vesselName: z.string().min(1, '船名不能为空'),
  vesselNumber: z.string().min(1, '船舶编号不能为空'),
  captainId: z.string().min(1, '船长ID不能为空'),
  captainName: z.string().min(1, '船长姓名不能为空'),
  departureTime: z.string().min(1, '出港时间不能为空'),
  expectedReturnTime: z.string().min(1, '预计返港时间不能为空'),
  purpose: z.string().min(1, '出海目的不能为空'),
  destination: z.string().min(1, '目的地不能为空'),
  crew: z
    .array(
      z.object({
        name: z.string().min(1, '船员姓名不能为空'),
        idNumber: z.string().min(1, '身份证号不能为空'),
        position: z.string().min(1, '职务不能为空'),
        phone: z.string().min(1, '联系电话不能为空'),
      }),
    )
    .min(1, '至少需要一名船员'),
});

export function submitVoyagePlan(data: unknown): Voyage {
  const validated = createVoyageSchema.parse(data);
  if (isWeatherWarningActive()) {
    const alert = getActiveWeatherAlert();
    throw new Error(
      `当前气象预警期间(${alert?.title})，禁止出港，请待预警解除后再提交计划。`,
    );
  }
  return createVoyage(validated);
}

export function getVoyageDetail(voyageId: string): {
  voyage: Voyage;
  crew: CrewMember[];
  auditLogs: AuditLog[];
} {
  const voyage = getVoyageById(voyageId);
  if (!voyage) {
    throw new Error('航次不存在');
  }
  const crew = getCrewByVoyage(voyageId);
  const auditLogs = getAuditLogsByVoyage(voyageId);
  return { voyage, crew, auditLogs };
}

export function listVoyages(status?: string, captainId?: string): Voyage[] {
  if (captainId) {
    return getVoyagesByCaptain(captainId);
  }
  return getVoyagesByStatus(status);
}

export function verifyVoyageCrew(
  voyageId: string,
  verifiedBy: string,
  crewVerifications: CrewVerification[],
): boolean {
  const voyage = getVoyageById(voyageId);
  if (!voyage) {
    throw new Error('航次不存在');
  }
  if (voyage.status !== 'planned') {
    throw new Error(`当前航次状态为"${voyage.status}"，无法进行船员核验`);
  }
  const crew = getCrewByVoyage(voyageId);
  const verifiedCount = crewVerifications.filter((c) => c.isVerified).length;
  if (verifiedCount !== crew.length) {
    throw new Error(
      `必须确认全部船员名单（共${crew.length}人），当前已确认${verifiedCount}人`,
    );
  }
  const user = getUserById(verifiedBy);
  return verifyCrew(voyageId, verifiedBy, user?.name || '未知值班员', crewVerifications);
}

export function departVoyageService(voyageId: string, departedBy: string): boolean {
  const voyage = getVoyageById(voyageId);
  if (!voyage) {
    throw new Error('航次不存在');
  }
  if (voyage.status !== 'crew_verified') {
    throw new Error(
      `当前航次状态为"${voyage.status}"，必须完成船员核验后才能放行出港`,
    );
  }
  if (isWeatherWarningActive()) {
    const alert = getActiveWeatherAlert();
    throw new Error(`当前气象预警期间(${alert?.title})，禁止放行出港！`);
  }
  const user = getUserById(departedBy);
  return departVoyage(voyageId, departedBy, user?.name || '未知值班员');
}

export function returnVoyageService(voyageId: string, returnedBy: string): boolean {
  const voyage = getVoyageById(voyageId);
  if (!voyage) {
    throw new Error('航次不存在');
  }
  if (voyage.status !== 'departed') {
    throw new Error(
      `当前航次状态为"${voyage.status}"，只有已出港的航次才能登记返港`,
    );
  }
  const user = getUserById(returnedBy);
  return returnVoyage(voyageId, returnedBy, user?.name || '未知值班员');
}

export function closeVoyageService(voyageId: string, closedBy: string): boolean {
  const voyage = getVoyageById(voyageId);
  if (!voyage) {
    throw new Error('航次不存在');
  }
  if (voyage.status !== 'returned') {
    throw new Error(
      `当前航次状态为"${voyage.status}"，只有已返港的航次才能关闭`,
    );
  }
  const user = getUserById(closedBy);
  return closeVoyage(voyageId, closedBy, user?.name || '未知监管员');
}
