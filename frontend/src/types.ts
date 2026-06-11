export type VoyageStatus =
  | 'planned'
  | 'crew_verified'
  | 'departed'
  | 'returned'
  | 'closed';

export type UserRole = 'captain' | 'watchkeeper' | 'supervisor';

export type WeatherAlertLevel = 'normal' | 'yellow' | 'orange' | 'red';

export type AuditAction =
  | 'create_voyage'
  | 'verify_crew'
  | 'depart_voyage'
  | 'return_voyage'
  | 'close_voyage'
  | 'update_weather_alert';

export interface WeatherAlert {
  id: string;
  level: WeatherAlertLevel;
  title: string;
  description: string;
  effectiveFrom: string;
  effectiveTo: string;
  isActive: boolean;
  createdAt: string;
}

export interface CrewMember {
  id: string;
  voyageId: string;
  name: string;
  idNumber: string;
  position: string;
  phone: string;
  isVerified: boolean;
  verifiedAt: string | null;
}

export interface Voyage {
  id: string;
  vesselName: string;
  vesselNumber: string;
  captainId: string;
  captainName: string;
  departureTime: string;
  expectedReturnTime: string;
  actualDepartureTime: string | null;
  actualReturnTime: string | null;
  purpose: string;
  destination: string;
  status: VoyageStatus;
  crewVerifiedAt: string | null;
  crewVerifiedBy: string | null;
  departedAt: string | null;
  departedBy: string | null;
  returnedAt: string | null;
  returnedBy: string | null;
  closedAt: string | null;
  closedBy: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  voyageId: string | null;
  action: AuditAction;
  operatorId: string;
  operatorName: string;
  operatorRole: UserRole;
  details: string;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  phone?: string;
}

export interface CrewInput {
  name: string;
  idNumber: string;
  position: string;
  phone: string;
}

export interface CrewVerification {
  crewId: string;
  isVerified: boolean;
}

export interface CreateVoyageInput {
  vesselName: string;
  vesselNumber: string;
  captainId: string;
  captainName: string;
  departureTime: string;
  expectedReturnTime: string;
  purpose: string;
  destination: string;
  crew: CrewInput[];
}

export const STATUS_LABELS: Record<VoyageStatus, string> = {
  planned: '待核验',
  crew_verified: '核验通过',
  departed: '已出港',
  returned: '已返港',
  closed: '已关闭',
};

export const STATUS_COLORS: Record<VoyageStatus, string> = {
  planned: 'bg-amber-100 text-amber-800',
  crew_verified: 'bg-blue-100 text-blue-800',
  departed: 'bg-indigo-100 text-indigo-800',
  returned: 'bg-purple-100 text-purple-800',
  closed: 'bg-slate-100 text-slate-600',
};

export const WEATHER_LABELS: Record<WeatherAlertLevel, string> = {
  normal: '天气正常',
  yellow: '黄色预警',
  orange: '橙色预警',
  red: '红色预警',
};

export const WEATHER_COLORS: Record<WeatherAlertLevel, string> = {
  normal: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  yellow: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  orange: 'bg-orange-100 text-orange-800 border-orange-200',
  red: 'bg-red-100 text-red-800 border-red-200',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  captain: '船长',
  watchkeeper: '港口值班员',
  supervisor: '监管员',
};

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  create_voyage: '创建航次',
  verify_crew: '核验船员',
  depart_voyage: '放行出港',
  return_voyage: '登记返港',
  close_voyage: '关闭航次',
  update_weather_alert: '更新气象预警',
};
