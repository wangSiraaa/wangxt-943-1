import { create } from "zustand";
import { apiRequest } from "@/lib/utils";

export interface Ship {
  id: string;
  name: string;
  type: string;
  tonnage: number;
  length: number;
  status: string;
  currentVoyageId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Plan {
  id: string;
  shipId: string;
  captainId: string;
  voyageId: string | null;
  status: string;
  departureTime: string;
  expectedReturnTime: string;
  route: string;
  routeRiskLevel: string;
  dangerGoodsDeclared: number;
  dangerGoodsDetail: string | null;
  fuelRemaining: number;
  berthId: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  crewIds?: string[];
  emergencyControlId?: string | null;
  lastStatusChangeReason?: string | null;
  changeRequestId?: string | null;
  shipName?: string;
}

export interface Voyage {
  id: string;
  planId: string;
  shipId: string;
  status: string;
  departureTime: string;
  expectedReturnTime: string;
  actualReturnTime: string | null;
  returnDeviation: string | null;
  closeReason: string | null;
  closedBy: string | null;
  closedAt: string | null;
  createdAt: string;
  emergencyControlId?: string | null;
  lastStatusChangeReason?: string | null;
  changeRequestId?: string | null;
  shipName?: string;
}

export interface AlertItem {
  id: string;
  type: string;
  level: string;
  title: string;
  message: string;
  relatedVoyageId: string | null;
  relatedShipId: string | null;
  isResolved: boolean;
  createdAt: string;
}

export interface CrewMember {
  id: string;
  name: string;
  role: string;
  qualificationType: string;
  qualificationExpireDate: string;
  isBlacklisted: boolean;
  shipId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Berth {
  id: string;
  name: string;
  capacity: number;
  occupied: number;
  status: string;
}

export interface WeatherInfo {
  temperature: number;
  windSpeed: number;
  windDirection: string;
  condition: string;
  waveHeight: number;
  visibility: number;
  warning: boolean;
  warningDetails: AlertItem[];
  updatedAt: string;
}

export interface StatisticsOverview {
  ships: { total: number; inPort: number; atSea: number; maintenance: number };
  plans: { total: number; draft: number; submitted: number; reviewing: number; inspecting: number; released: number; rejected: number; revoked: number; withdrawn: number };
  voyages: { total: number; active: number; returning: number; abnormalReturn: number; closed: number };
  alerts: { total: number; unresolved: number; critical: number; warning: number; info: number };
  berths: { total: number; available: number; occupied: number; reserved: number; maintenance: number };
  certificates: { total: number; valid: number; expiringSoon: number; expired: number };
}

export interface ComplianceStats {
  totalPlans: number;
  rejectedCount: number;
  revokedCount: number;
  abnormalCount: number;
  rejectionRate: number;
  revocationRate: number;
  abnormalRate: number;
  rejectionReasons: { reason: string; count: number }[];
}

export interface TrendData {
  date: string;
  departures: number;
  returns: number;
}

export interface EmergencyControl {
  id: string;
  controlType: string;
  title: string;
  description: string | null;
  affectedArea: string | null;
  startTime: string;
  endTime: string;
  riskLevel: string;
  status: string;
  createdBy: string;
  createdByName?: string;
  endedBy: string | null;
  endedByName?: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
  affectedPlans?: Plan[];
  affectedVoyages?: Voyage[];
  statusLogs?: StatusChangeLog[];
  affectedPlansCount?: number;
}

export interface VoyageChangeRequest {
  id: string;
  planId: string;
  voyageId: string | null;
  requestType: 'route_change' | 'crew_change' | 'early_return';
  oldValue: string | null;
  newValue: string;
  changeReason: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  requestedBy: string;
  requestedByName?: string;
  reviewedBy: string | null;
  reviewedByName?: string | null;
  reviewComment: string | null;
  reviewedAt: string | null;
  requiresRecheck: number;
  recheckCertificate: number;
  recheckBerth: number;
  recheckWeather: number;
  recheckInspection: number;
  shipName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StatusChangeLog {
  id: string;
  planId: string | null;
  voyageId: string | null;
  oldStatus: string;
  newStatus: string;
  changeType: string;
  reason: string;
  operatorId: string;
  operatorName?: string;
  operatorRole: string;
  emergencyControlId: string | null;
  controlTitle?: string;
  metadata: string | null;
  createdAt: string;
}

export interface RiskAggregation {
  critical: Plan[];
  warning: Plan[];
  info: Plan[];
  activeControls: EmergencyControl[];
  pendingChangeRequests: VoyageChangeRequest[];
  summary: {
    totalAffected: number;
    criticalCount: number;
    warningCount: number;
    infoCount: number;
    activeControlsCount: number;
    pendingChangeRequestsCount: number;
  };
}

interface DataState {
  ships: Ship[];
  plans: Plan[];
  voyages: Voyage[];
  alerts: AlertItem[];
  crew: CrewMember[];
  berths: Berth[];
  weather: WeatherInfo | null;
  statistics: StatisticsOverview | null;
  compliance: ComplianceStats | null;
  trends: TrendData[];
  emergencyControls: EmergencyControl[];
  activeEmergencyControls: EmergencyControl[];
  changeRequests: VoyageChangeRequest[];
  riskAggregation: RiskAggregation | null;
  statusLogs: StatusChangeLog[];
  isLoading: boolean;
  fetchShips: () => Promise<void>;
  fetchPlans: () => Promise<void>;
  fetchVoyages: () => Promise<void>;
  fetchAlerts: () => Promise<void>;
  fetchCrew: () => Promise<void>;
  fetchBerths: () => Promise<void>;
  fetchWeather: () => Promise<void>;
  fetchStatistics: () => Promise<void>;
  fetchCompliance: () => Promise<void>;
  fetchTrends: () => Promise<void>;
  fetchEmergencyControls: () => Promise<void>;
  fetchActiveEmergencyControls: () => Promise<void>;
  createEmergencyControl: (data: Record<string, unknown>) => Promise<EmergencyControl | null>;
  endEmergencyControl: (id: string, reason: string) => Promise<boolean>;
  fetchChangeRequests: () => Promise<void>;
  fetchRiskAggregation: () => Promise<void>;
  fetchStatusChangeLogs: (planId: string) => Promise<StatusChangeLog[]>;
}

export const useDataStore = create<DataState>((set) => ({
  ships: [],
  plans: [],
  voyages: [],
  alerts: [],
  crew: [],
  berths: [],
  weather: null,
  statistics: null,
  compliance: null,
  trends: [],
  emergencyControls: [],
  activeEmergencyControls: [],
  changeRequests: [],
  riskAggregation: null,
  statusLogs: [],
  isLoading: false,

  fetchShips: async () => {
    try {
      const ships = await apiRequest<Ship[]>("/api/ships");
      set({ ships });
    } catch { console.error("获取船舶数据失败"); }
  },

  fetchPlans: async () => {
    try {
      const plans = await apiRequest<Plan[]>("/api/plans");
      set({ plans });
    } catch { console.error("获取计划数据失败"); }
  },

  fetchVoyages: async () => {
    try {
      const voyages = await apiRequest<Voyage[]>("/api/voyages");
      set({ voyages });
    } catch { console.error("获取航次数据失败"); }
  },

  fetchAlerts: async () => {
    try {
      const alerts = await apiRequest<AlertItem[]>("/api/alerts");
      set({ alerts });
    } catch { console.error("获取告警数据失败"); }
  },

  fetchCrew: async () => {
    try {
      const crew = await apiRequest<CrewMember[]>("/api/crew");
      set({ crew });
    } catch { console.error("获取船员数据失败"); }
  },

  fetchBerths: async () => {
    try {
      const berths = await apiRequest<Berth[]>("/api/berths");
      set({ berths });
    } catch { console.error("获取泊位数据失败"); }
  },

  fetchWeather: async () => {
    try {
      const weather = await apiRequest<WeatherInfo>("/api/alerts/weather");
      set({ weather });
    } catch { console.error("获取天气数据失败"); }
  },

  fetchStatistics: async () => {
    try {
      const statistics = await apiRequest<StatisticsOverview>("/api/statistics/overview");
      set({ statistics });
    } catch { console.error("获取统计数据失败"); }
  },

  fetchCompliance: async () => {
    try {
      const compliance = await apiRequest<ComplianceStats>("/api/statistics/compliance");
      set({ compliance });
    } catch { console.error("获取合规数据失败"); }
  },

  fetchTrends: async () => {
    try {
      const trends = await apiRequest<TrendData[]>("/api/statistics/trends");
      set({ trends });
    } catch { console.error("获取趋势数据失败"); }
  },

  fetchEmergencyControls: async () => {
    try {
      const emergencyControls = await apiRequest<EmergencyControl[]>("/api/emergency");
      set({ emergencyControls });
    } catch { console.error("获取应急管控数据失败"); }
  },

  fetchActiveEmergencyControls: async () => {
    try {
      const activeEmergencyControls = await apiRequest<EmergencyControl[]>("/api/emergency/active");
      set({ activeEmergencyControls });
    } catch { console.error("获取活跃应急管控失败"); }
  },

  createEmergencyControl: async (data: Record<string, unknown>) => {
    try {
      const body = {
        controlType: data.controlType,
        title: data.title,
        description: data.description,
        affectedArea: data.affectedArea,
        startTime: data.startTime,
        endTime: data.endTime,
        riskLevel: data.riskLevel,
        autoProcess: true,
      };
      const result = await apiRequest<EmergencyControl>("/api/emergency", {
        method: "POST",
        body: JSON.stringify(body),
      });
      return result;
    } catch (e) {
      console.error("创建应急管控失败", e);
      return null;
    }
  },

  endEmergencyControl: async (id: string, reason: string) => {
    try {
      await apiRequest(`/api/emergency/${id}/end`, {
        method: "POST",
        body: JSON.stringify({ endReason: reason }),
      });
      return true;
    } catch (e) {
      console.error("结束应急管控失败", e);
      return false;
    }
  },

  fetchChangeRequests: async () => {
    try {
      const changeRequests = await apiRequest<VoyageChangeRequest[]>("/api/change-requests?status=pending");
      set({ changeRequests });
    } catch { console.error("获取变更申请数据失败"); }
  },

  fetchRiskAggregation: async () => {
    try {
      const riskAggregation = await apiRequest<RiskAggregation>("/api/emergency/risk-aggregation");
      set({ riskAggregation });
    } catch { console.error("获取风险聚合数据失败"); }
  },

  fetchStatusChangeLogs: async (planId: string) => {
    try {
      const logs = await apiRequest<StatusChangeLog[]>(`/api/emergency/status-logs/${planId}`);
      set({ statusLogs: logs });
      return logs;
    } catch {
      console.error("获取状态变更日志失败");
      return [];
    }
  },
}));
