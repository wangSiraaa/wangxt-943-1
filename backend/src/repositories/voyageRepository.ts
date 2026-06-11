import { getDb, generateId, saveDb } from '../database';
import type {
  Voyage,
  CrewMember,
  CrewVerification,
  AuditLog,
  AuditAction,
  UserRole,
} from '../types';

export function createVoyage(req: {
  vesselName: string;
  vesselNumber: string;
  captainId: string;
  captainName: string;
  departureTime: string;
  expectedReturnTime: string;
  purpose: string;
  destination: string;
  crew: Array<{
    name: string;
    idNumber: string;
    position: string;
    phone: string;
  }>;
}): Voyage {
  const db = getDb();
  const voyageId = generateId();
  const now = new Date().toISOString();
  const voyage: Voyage = {
    id: voyageId,
    vesselName: req.vesselName,
    vesselNumber: req.vesselNumber,
    captainId: req.captainId,
    captainName: req.captainName,
    departureTime: req.departureTime,
    expectedReturnTime: req.expectedReturnTime,
    actualDepartureTime: null,
    actualReturnTime: null,
    purpose: req.purpose,
    destination: req.destination,
    status: 'planned',
    crewVerifiedAt: null,
    crewVerifiedBy: null,
    departedAt: null,
    departedBy: null,
    returnedAt: null,
    returnedBy: null,
    closedAt: null,
    closedBy: null,
    notes: null,
    createdAt: now,
    updatedAt: now,
  };
  const crewList: CrewMember[] = req.crew.map((c) => ({
    id: generateId(),
    voyageId,
    name: c.name,
    idNumber: c.idNumber,
    position: c.position,
    phone: c.phone,
    isVerified: false,
    verifiedAt: null,
  }));
  db.voyages.push(voyage);
  db.crewMembers.push(...crewList);
  addAuditLog({
    voyageId,
    action: 'create_voyage',
    operatorId: req.captainId,
    operatorName: req.captainName,
    operatorRole: 'captain',
    details: `创建航次计划：${req.vesselName}（${req.vesselNumber}）`,
  });
  saveDb(db);
  return voyage;
}

export function getVoyageById(id: string): Voyage | null {
  const db = getDb();
  return db.voyages.find((v) => v.id === id) || null;
}

export function getVoyagesByStatus(status?: string): Voyage[] {
  const db = getDb();
  let list = [...db.voyages];
  if (status) list = list.filter((v) => v.status === status);
  return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getVoyagesByCaptain(captainId: string): Voyage[] {
  const db = getDb();
  return db.voyages
    .filter((v) => v.captainId === captainId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getCrewByVoyage(voyageId: string): CrewMember[] {
  const db = getDb();
  return db.crewMembers
    .filter((c) => c.voyageId === voyageId)
    .sort((a, b) => a.name.localeCompare(b.name, 'zh'));
}

export function verifyCrew(
  voyageId: string,
  verifiedBy: string,
  verifiedByName: string,
  crewVerifications: CrewVerification[],
): boolean {
  const db = getDb();
  const now = new Date().toISOString();
  for (const cv of crewVerifications) {
    const crew = db.crewMembers.find(
      (c) => c.id === cv.crewId && c.voyageId === voyageId,
    );
    if (crew) {
      crew.isVerified = cv.isVerified;
      crew.verifiedAt = cv.isVerified ? now : null;
    }
  }
  const voyage = db.voyages.find((v) => v.id === voyageId);
  if (voyage) {
    voyage.status = 'crew_verified';
    voyage.crewVerifiedAt = now;
    voyage.crewVerifiedBy = verifiedBy;
    voyage.updatedAt = now;
  }
  addAuditLog({
    voyageId,
    action: 'verify_crew',
    operatorId: verifiedBy,
    operatorName: verifiedByName,
    operatorRole: 'watchkeeper',
    details: `核验船员名单，共 ${crewVerifications.length} 人`,
  });
  saveDb(db);
  return true;
}

export function departVoyage(
  voyageId: string,
  departedBy: string,
  departedByName: string,
): boolean {
  const db = getDb();
  const now = new Date().toISOString();
  const voyage = db.voyages.find(
    (v) => v.id === voyageId && v.status === 'crew_verified',
  );
  if (!voyage) return false;
  voyage.status = 'departed';
  voyage.actualDepartureTime = now;
  voyage.departedAt = now;
  voyage.departedBy = departedBy;
  voyage.updatedAt = now;
  addAuditLog({
    voyageId,
    action: 'depart_voyage',
    operatorId: departedBy,
    operatorName: departedByName,
    operatorRole: 'watchkeeper',
    details: `放行出港：${voyage.vesselName}`,
  });
  saveDb(db);
  return true;
}

export function returnVoyage(
  voyageId: string,
  returnedBy: string,
  returnedByName: string,
): boolean {
  const db = getDb();
  const now = new Date().toISOString();
  const voyage = db.voyages.find(
    (v) => v.id === voyageId && v.status === 'departed',
  );
  if (!voyage) return false;
  voyage.status = 'returned';
  voyage.actualReturnTime = now;
  voyage.returnedAt = now;
  voyage.returnedBy = returnedBy;
  voyage.updatedAt = now;
  addAuditLog({
    voyageId,
    action: 'return_voyage',
    operatorId: returnedBy,
    operatorName: returnedByName,
    operatorRole: 'watchkeeper',
    details: `登记返港：${voyage.vesselName}`,
  });
  saveDb(db);
  return true;
}

export function closeVoyage(
  voyageId: string,
  closedBy: string,
  closedByName: string,
): boolean {
  const db = getDb();
  const now = new Date().toISOString();
  const voyage = db.voyages.find(
    (v) => v.id === voyageId && v.status === 'returned',
  );
  if (!voyage) return false;
  voyage.status = 'closed';
  voyage.closedAt = now;
  voyage.closedBy = closedBy;
  voyage.updatedAt = now;
  addAuditLog({
    voyageId,
    action: 'close_voyage',
    operatorId: closedBy,
    operatorName: closedByName,
    operatorRole: 'supervisor',
    details: `关闭航次：${voyage.vesselName}`,
  });
  saveDb(db);
  return true;
}

export function getAuditLogsByVoyage(voyageId: string): AuditLog[] {
  const db = getDb();
  return db.auditLogs
    .filter((l) => l.voyageId === voyageId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function getAllAuditLogs(): AuditLog[] {
  const db = getDb();
  return [...db.auditLogs].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

function addAuditLog(entry: {
  voyageId: string | null;
  action: AuditAction;
  operatorId: string;
  operatorName: string;
  operatorRole: UserRole;
  details: string;
}): void {
  const db = getDb();
  const log: AuditLog = {
    id: generateId(),
    voyageId: entry.voyageId,
    action: entry.action,
    operatorId: entry.operatorId,
    operatorName: entry.operatorName,
    operatorRole: entry.operatorRole,
    details: entry.details,
    createdAt: new Date().toISOString(),
  };
  db.auditLogs.push(log);
}
