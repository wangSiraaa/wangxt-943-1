export type VoyageStatus =
  | 'planned'
  | 'crew_verified'
  | 'departed'
  | 'returned'
  | 'closed';

export type UserRole = 'captain' | 'watchkeeper' | 'supervisor';

export type WeatherAlertLevel = 'normal' | 'yellow' | 'orange' | 'red';

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

export type AuditAction =
  | 'create_voyage'
  | 'verify_crew'
  | 'depart_voyage'
  | 'return_voyage'
  | 'close_voyage'
  | 'update_weather_alert';

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

export interface Database {
  voyages: Voyage[];
  crewMembers: CrewMember[];
  weatherAlerts: WeatherAlert[];
  auditLogs: AuditLog[];
  users: User[];
}

export interface CrewVerification {
  crewId: string;
  isVerified: boolean;
}
