import { create } from "zustand";
import { apiRequest } from "@/lib/utils";

export interface Ship {
  id: string;
  name: string;
  type: string;
  tonnage: number;
  length: number;
  status: string;
  current_voyage_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Plan {
  id: string;
  ship_id: string;
  captain_id: string;
  voyage_id: string | null;
  status: string;
  departure_time: string;
  expected_return_time: string;
  route: string;
  route_risk_level: string;
  danger_goods_declared: number;
  danger_goods_detail: string | null;
  fuel_remaining: number;
  berth_id: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  crew_ids?: string[];
}

export interface Voyage {
  id: string;
  plan_id: string;
  ship_id: string;
  status: string;
  departure_time: string;
  expected_return_time: string;
  actual_return_time: string | null;
  return_deviation: string | null;
  close_reason: string | null;
  closed_by: string | null;
  closed_at: string | null;
  created_at: string;
}

export interface AlertItem {
  id: string;
  type: string;
  level: string;
  title: string;
  message: string;
  related_voyage_id: string | null;
  related_ship_id: string | null;
  is_resolved: number;
  created_at: string;
}

export interface CrewMember {
  id: string;
  name: string;
  role: string;
  qualification_type: string;
  qualification_expire_date: string;
  is_blacklisted: number;
  ship_id: string | null;
  created_at: string;
  updated_at: string;
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
}));
