import { useState, useEffect, useCallback } from "react";
import {
  AlertTriangle,
  CloudSun,
  Wind,
  Eye,
  Thermometer,
  CheckCircle,
  ExternalLink,
} from "lucide-react";
import { useDataStore, type AlertItem, type WeatherInfo } from "@/store/dataStore";
import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface AlertExt extends AlertItem {
  shipName?: string;
}

const tabs = [
  { key: "all", label: "全部" },
  { key: "weather", label: "气象" },
  { key: "overtime", label: "返港超时" },
  { key: "cert_expired", label: "证书过期" },
  { key: "route_risk", label: "航线风险" },
  { key: "abnormal_release", label: "异常放行" },
];

const levelStyle: Record<string, string> = {
  critical: "bg-danger/20 text-danger-light border-danger/40",
  warning: "bg-warning/20 text-warning-light border-warning/40",
  info: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
};

const levelLabel: Record<string, string> = {
  critical: "严重",
  warning: "警告",
  info: "提示",
};

export default function AlertCenter() {
  const { alerts, weather, ships, fetchAlerts, fetchWeather, fetchShips } = useDataStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [alertData, setAlertData] = useState<AlertExt[]>([]);
  const [activeTab, setActiveTab] = useState("all");
  const [weatherData, setWeatherData] = useState<WeatherInfo | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);

  const canResolve = user?.role === "admin" || user?.role === "supervisor";

  const load = useCallback(async () => {
    await Promise.all([fetchAlerts(), fetchWeather(), fetchShips()]);
  }, [fetchAlerts, fetchWeather, fetchShips]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const getShipName = (shipId: string | null) => {
      if (!shipId) return undefined;
      return ships.find((s) => s.id === shipId)?.name;
    };
    const mapped: AlertExt[] = alerts.map((a) => ({
      ...a,
      shipName: getShipName(a.related_ship_id),
    }));
    setAlertData(mapped);
  }, [alerts, ships]);

  useEffect(() => {
    setWeatherData(weather);
  }, [weather]);

  const filtered =
    activeTab === "all"
      ? alertData
      : alertData.filter((a) => a.type === activeTab);

  const unresolvedCount = alertData.filter((a) => !a.is_resolved).length;

  const handleResolve = async (id: string) => {
    setResolving(id);
    try {
      const res = await fetch(`/api/alerts/${id}/resolve`, { method: "PUT" });
      if (!res.ok) throw new Error();
      setAlertData((prev) =>
        prev.map((a) => (a.id === id ? { ...a, is_resolved: 1 } : a))
      );
    } catch {
      console.error("处理预警失败");
    } finally {
      setResolving(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-100">预警中心</h1>
        {unresolvedCount > 0 && (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-danger/20 text-danger-light text-sm rounded-full">
            <AlertTriangle className="w-4 h-4" />
            {unresolvedCount} 条未处理
          </span>
        )}
      </div>

      {weatherData && (
        <div className="bg-navy-light border border-navy-lighter rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <CloudSun className="w-5 h-5 text-nautical-light" />
            <h3 className="text-sm font-medium text-gray-300">当前气象</h3>
            {(weatherData.windSpeed ?? 0) > 10 && (
              <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-warning/20 text-warning-light">
                大风预警
              </span>
            )}
            {(weatherData.visibility ?? 999) < 2 && (
              <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-danger/20 text-danger-light">
                低能见度
              </span>
            )}
          </div>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div className="flex flex-col items-center gap-1">
              <Thermometer className="w-4 h-4 text-gray-500" />
              <span className="text-lg font-semibold text-gray-100">
                {weatherData.temperature}°C
              </span>
              <span className="text-xs text-gray-500">温度</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Wind className="w-4 h-4 text-gray-500" />
              <span className="text-lg font-semibold text-gray-100">
                {weatherData.windSpeed}m/s
              </span>
              <span className="text-xs text-gray-500">
                风速 {weatherData.windDirection}
              </span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Eye className="w-4 h-4 text-gray-500" />
              <span className="text-lg font-semibold text-gray-100">
                {weatherData.visibility}km
              </span>
              <span className="text-xs text-gray-500">能见度</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <CloudSun className="w-4 h-4 text-gray-500" />
              <span className="text-lg font-semibold text-gray-100">
                {weatherData.waveHeight}m
              </span>
              <span className="text-xs text-gray-500">浪高</span>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={cn(
              "px-4 py-1.5 text-sm rounded-lg whitespace-nowrap transition-colors",
              activeTab === t.key
                ? "bg-nautical text-white"
                : "bg-navy-lighter text-gray-400 hover:text-gray-200"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((a) => (
          <div
            key={a.id}
            className={cn(
              "bg-navy-light border rounded-xl p-4 transition-opacity",
              a.is_resolved ? "border-navy-lighter opacity-60" : "border-navy-lighter"
            )}
          >
            <div className="flex items-start gap-3">
              <span
                className={cn(
                  "shrink-0 mt-0.5 px-2 py-0.5 text-xs font-medium rounded border",
                  levelStyle[a.level]
                )}
              >
                {levelLabel[a.level]}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium text-gray-200">{a.title}</h4>
                  {a.is_resolved ? (
                    <CheckCircle className="w-4 h-4 text-port shrink-0" />
                  ) : null}
                </div>
                <p className="text-sm text-gray-400 mt-1">{a.message}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                  <span>{a.created_at}</span>
                  {a.shipName && (
                    <button
                      onClick={() => navigate("/ships")}
                      className="flex items-center gap-1 text-nautical-light hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {a.shipName}
                    </button>
                  )}
                  {a.related_voyage_id && (
                    <button
                      onClick={() => navigate(`/voyages/${a.related_voyage_id}`)}
                      className="flex items-center gap-1 text-nautical-light hover:underline"
                    >
                      <ExternalLink className="w-3 h-3" />
                      查看航次
                    </button>
                  )}
                </div>
              </div>
              {canResolve && !a.is_resolved && (
                <button
                  onClick={() => handleResolve(a.id)}
                  disabled={resolving === a.id}
                  className="shrink-0 px-3 py-1.5 text-xs bg-port/20 text-port-light hover:bg-port/30 rounded-lg transition-colors disabled:opacity-50"
                >
                  {resolving === a.id ? "处理中..." : "标记已处理"}
                </button>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="py-16 text-center text-gray-500">暂无预警信息</div>
        )}
      </div>
    </div>
  );
}
