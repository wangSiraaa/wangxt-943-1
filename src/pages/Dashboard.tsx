import { useEffect, useState, useRef, useCallback } from "react";
import {
  Anchor,
  Ship,
  ClipboardCheck,
  AlertTriangle,
  Cloud,
  Wind,
  Eye,
  Waves,
  Thermometer,
  Compass,
  RefreshCw,
  FileText,
  ShieldAlert,
  ShieldCheck,
  Siren,
  ArrowRight,
} from "lucide-react";
import { useDataStore, type AlertItem, type RiskAggregation } from "@/store/dataStore";
import { useNavigate } from "react-router-dom";
import AlertBanner from "@/components/AlertBanner";
import StatusBadge from "@/components/StatusBadge";
import { cn } from "@/lib/utils";

function useCountUp(target: number, duration = 1200) {
  const [count, setCount] = useState(0);
  const ref = useRef({ target: -1, raf: 0 });

  useEffect(() => {
    if (target === ref.current.target) return;
    ref.current.target = target;
    const startTime = Date.now();

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(target * eased));
      if (progress < 1) {
        ref.current.raf = requestAnimationFrame(tick);
      }
    };

    ref.current.raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(ref.current.raf);
  }, [target, duration]);

  return count;
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  delay,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
  delay: number;
}) {
  const animated = useCountUp(value);

  return (
    <div
      className="bg-navy-light border border-navy-lighter rounded-xl p-5 animate-fade-in"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "backwards" }}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-400">{label}</span>
        <Icon className={cn("w-5 h-5", color)} />
      </div>
      <div className="text-3xl font-bold text-gray-100 mt-2 tabular-nums">
        {animated}
      </div>
    </div>
  );
}

const berthStatusColor: Record<string, string> = {
  available: "bg-port/30 border-port text-port",
  occupied: "bg-nautical/30 border-nautical text-nautical-light",
  maintenance: "bg-warning/30 border-warning text-warning",
};

const berthStatusLabel: Record<string, string> = {
  available: "空闲",
  occupied: "占用",
  maintenance: "维护",
};

export default function Dashboard() {
  const {
    statistics,
    plans,
    ships,
    berths,
    weather,
    alerts,
    fetchStatistics,
    fetchPlans,
    fetchShips,
    fetchBerths,
    fetchWeather,
    fetchAlerts,
    fetchVoyages,
  } = useDataStore();
  const navigate = useNavigate();
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const refreshIntervalRef = useRef<number | null>(null);
  const [riskAggregation, setRiskAggregation] = useState<RiskAggregation | null>(null);

  const refreshAll = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        fetchStatistics(),
        fetchPlans(),
        fetchShips(),
        fetchBerths(),
        fetchWeather(),
        fetchAlerts(),
        fetchVoyages(),
      ]);
      const riskRes = await fetch("/api/emergency/risk-aggregation").then((r) =>
        r.json().catch(() => null)
      );
      if (riskRes?.success) {
        setRiskAggregation(riskRes.data);
      }
      setLastUpdated(new Date().toLocaleTimeString("zh-CN"));
    } finally {
      setIsRefreshing(false);
    }
  }, [fetchStatistics, fetchPlans, fetchShips, fetchBerths, fetchWeather, fetchAlerts, fetchVoyages]);

  useEffect(() => {
    refreshAll();
    refreshIntervalRef.current = window.setInterval(refreshAll, 30000);
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [refreshAll]);

  const recentPlans = plans.slice(0, 5);
  const unresolvedAlerts = alerts.filter((a) => !a.isResolved).slice(0, 5);
  const activeVoyages = ships.filter((s) => s.status === "at_sea");

  const getShipName = (shipId: string) => ships.find((s) => s.id === shipId)?.name ?? "-";

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-100">值班大屏</h1>
            <p className="text-sm text-gray-500 mt-1">渔港实时监控与数据概览</p>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-xs text-gray-500">
                最后更新: {lastUpdated}
              </span>
            )}
            <button
              onClick={refreshAll}
              disabled={isRefreshing}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy-lighter text-gray-300 text-xs hover:bg-navy-lighter/80 transition-colors",
                isRefreshing && "opacity-50 cursor-not-allowed"
              )}
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin")} />
              刷新
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={Anchor}
            label="在港船舶"
            value={statistics?.ships.inPort ?? 0}
            color="text-port"
            delay={0}
          />
          <StatCard
            icon={Ship}
            label="出港中"
            value={statistics?.ships.atSea ?? 0}
            color="text-nautical-light"
            delay={100}
          />
          <StatCard
            icon={ClipboardCheck}
            label="待审批"
            value={(statistics?.plans.submitted ?? 0) + (statistics?.plans.reviewing ?? 0)}
            color="text-warning"
            delay={200}
          />
          <StatCard
            icon={AlertTriangle}
            label="预警数"
            value={statistics?.alerts.unresolved ?? 0}
            color="text-danger"
            delay={300}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-navy-light border border-navy-lighter rounded-xl p-5">
            <h3 className="text-sm font-medium text-gray-300 mb-4">
              泊位占用
            </h3>
            <div className="grid grid-cols-4 gap-3">
              {berths.slice(0, 8).map((berth) => (
                <div
                  key={berth.id}
                  className={cn(
                    "flex flex-col items-center justify-center rounded-lg border p-3 transition-colors",
                    berthStatusColor[berth.status] ||
                      "bg-gray-700/30 border-gray-600 text-gray-400"
                  )}
                >
                  <span className="text-xs font-bold">{berth.name}</span>
                  <span className="text-[10px] mt-1 opacity-80">
                    {berthStatusLabel[berth.status]}
                  </span>
                  {berth.occupied > 0 && (
                    <span className="text-[10px] mt-0.5 opacity-60 truncate max-w-full">
                      占用 {berth.occupied}/{berth.capacity}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-navy-light border border-navy-lighter rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-300">海况天气</h3>
              {weather?.updatedAt && (
                <span className="text-[10px] text-gray-500">
                  更新于 {weather.updatedAt}
                </span>
              )}
            </div>
            {weather ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Cloud className="w-8 h-8 text-nautical-light" />
                  <div>
                    <div className="text-lg font-semibold text-gray-100">
                      {weather.condition}
                    </div>
                    <div className="text-xs text-gray-500">当前天气</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Thermometer className="w-4 h-4 text-warning" />
                    <span className="text-gray-400">温度</span>
                    <span className="text-gray-200 font-medium">
                      {weather.temperature}°C
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Wind className="w-4 h-4 text-nautical-light" />
                    <span className="text-gray-400">风速</span>
                    <span className="text-gray-200 font-medium">
                      {weather.windSpeed}m/s {weather.windDirection}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Eye className="w-4 h-4 text-port" />
                    <span className="text-gray-400">能见度</span>
                    <span className="text-gray-200 font-medium">
                      {weather.visibility}km
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Waves className="w-4 h-4 text-nautical" />
                    <span className="text-gray-400">浪高</span>
                    <span className="text-gray-200 font-medium">
                      {weather.waveHeight}m
                    </span>
                  </div>
                </div>
                {weather.windSpeed > 10 || weather.waveHeight > 2 ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/10 border border-warning/30 text-warning text-xs">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>海况预警：当前风浪较大，注意航行安全</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-port/10 border border-port/30 text-port text-xs">
                    <Compass className="w-4 h-4 shrink-0" />
                    <span>海况正常，适宜出港</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-sm text-gray-500">天气数据加载中...</div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-navy-light border border-navy-lighter rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-warning" />
                预警队列
              </h3>
              <button
                onClick={() => navigate("/alerts")}
                className="text-xs text-nautical-light hover:text-nautical-light/80 transition-colors"
              >
                预警中心 →
              </button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {unresolvedAlerts.length > 0 ? (
                unresolvedAlerts.map((alert) => (
                  <AlertCard key={alert.id} alert={alert} onClick={() => navigate("/alerts")} />
                ))
              ) : (
                <div className="text-center py-4 text-sm text-gray-500">
                  暂无活跃预警
                </div>
              )}
            </div>
          </div>

          <div className="bg-navy-light border border-navy-lighter rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                <Ship className="w-4 h-4 text-nautical-light" />
                出海船舶
              </h3>
              <button
                onClick={() => navigate("/voyages")}
                className="text-xs text-nautical-light hover:text-nautical-light/80 transition-colors"
              >
                航次管理 →
              </button>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {activeVoyages.length > 0 ? (
                activeVoyages.map((ship) => (
                  <div
                    key={ship.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-navy-lighter/30 hover:bg-navy-lighter/50 transition-colors cursor-pointer"
                    onClick={() => {
                      if (ship.currentVoyageId) {
                        navigate(`/voyages/${ship.currentVoyageId}`);
                      }
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-nautical-light animate-pulse" />
                      <span className="text-sm text-gray-200">{ship.name}</span>
                    </div>
                    <span className="text-xs text-gray-500">{ship.type}</span>
                  </div>
                ))
              ) : (
                <div className="text-center py-4 text-sm text-gray-500">
                  暂无出海船舶
                </div>
              )}
            </div>
          </div>
        </div>

        {riskAggregation && (riskAggregation.summary.totalAffected > 0 || riskAggregation.summary.activeControlsCount > 0) && (
          <div className="bg-navy-light border border-warning/30 rounded-xl p-5 animate-fade-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                <Siren className="w-4 h-4 text-warning" />
                应急管控 · 风险聚合
              </h3>
              <button
                onClick={() => navigate("/emergency")}
                className="text-xs text-nautical-light hover:text-nautical-light/80 transition-colors flex items-center gap-1"
              >
                管控中心 <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {riskAggregation.summary.activeControlsCount > 0 && (
              <div className="mb-4">
                <div className="text-xs text-warning mb-2">活跃管控</div>
                <div className="flex gap-2 flex-wrap">
                  {riskAggregation.activeControls.map((ctrl) => (
                    <div
                      key={ctrl.id}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs border cursor-pointer hover:opacity-80 transition-opacity",
                        ctrl.riskLevel === "critical"
                          ? "bg-danger/10 border-danger/30 text-danger-light"
                          : ctrl.riskLevel === "high"
                          ? "bg-warning/10 border-warning/30 text-warning"
                          : "bg-yellow-600/10 border-yellow-600/30 text-yellow-400"
                      )}
                      onClick={() => navigate(`/emergency/${ctrl.id}`)}
                    >
                      <span className="font-medium">{ctrl.controlType === "navigation_ban" ? "禁航" : ctrl.controlType === "search_drill" ? "搜救演练" : "海域避让"}</span>
                      <span className="ml-1 opacity-70">{ctrl.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-danger/10 border border-danger/20 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-danger">{riskAggregation.summary.criticalCount}</div>
                <div className="text-[10px] text-danger-light mt-0.5">高风险</div>
              </div>
              <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-warning">{riskAggregation.summary.warningCount}</div>
                <div className="text-[10px] text-warning-light mt-0.5">中风险</div>
              </div>
              <div className="bg-port/10 border border-port/20 rounded-lg p-3 text-center">
                <div className="text-xl font-bold text-port">{riskAggregation.summary.infoCount}</div>
                <div className="text-[10px] text-port mt-0.5">低风险</div>
              </div>
            </div>

            <div className="space-y-2 max-h-40 overflow-y-auto">
              {riskAggregation.critical.map((p: any) => (
                <RiskPlanRow key={p.id} plan={p} level="critical" navigate={navigate} />
              ))}
              {riskAggregation.warning.map((p: any) => (
                <RiskPlanRow key={p.id} plan={p} level="warning" navigate={navigate} />
              ))}
              {riskAggregation.info.map((p: any) => (
                <RiskPlanRow key={p.id} plan={p} level="info" navigate={navigate} />
              ))}
            </div>

            {riskAggregation.summary.pendingChangeRequestsCount > 0 && (
              <div className="mt-3 pt-3 border-t border-navy-lighter">
                <div className="text-xs text-gray-400 flex items-center gap-1">
                  <ClipboardCheck className="w-3 h-3" />
                  待审核变更申请: <span className="text-warning font-medium">{riskAggregation.summary.pendingChangeRequestsCount}</span> 条
                </div>
              </div>
            )}
          </div>
        )}

        <div className="bg-navy-light border border-navy-lighter rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <FileText className="w-4 h-4 text-port" />
              最近出港计划
            </h3>
            <button
              onClick={() => navigate("/plans")}
              className="text-xs text-nautical-light hover:text-nautical-light/80 transition-colors"
            >
              查看全部 →
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 border-b border-navy-lighter">
                  <th className="text-left py-2 font-medium">船舶</th>
                  <th className="text-left py-2 font-medium">状态</th>
                  <th className="text-left py-2 font-medium">计划出港</th>
                  <th className="text-left py-2 font-medium">航线</th>
                </tr>
              </thead>
              <tbody>
                {recentPlans.length > 0 ? (
                  recentPlans.map((plan) => (
                    <tr
                      key={plan.id}
                      className="border-b border-navy-lighter/50 hover:bg-navy-lighter/30 cursor-pointer transition-colors"
                      onClick={() => navigate(`/plans/${plan.id}`)}
                    >
                      <td className="py-2.5 text-gray-200">{getShipName(plan.shipId)}</td>
                      <td className="py-2.5">
                        <StatusBadge status={plan.status as never} />
                      </td>
                      <td className="py-2.5 text-gray-400">
                        {plan.departureTime}
                      </td>
                      <td className="py-2.5 text-gray-400">
                        {plan.route}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-8 text-center text-gray-500"
                    >
                      暂无计划数据
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <AlertBanner />
    </div>
  );
}

function AlertCard({ alert, onClick }: { alert: AlertItem; onClick: () => void }) {
  const levelStyles: Record<string, string> = {
    critical: "border-danger/30 bg-danger/10",
    warning: "border-warning/30 bg-warning/10",
    info: "border-yellow-600/30 bg-yellow-600/10",
  };

  const levelColors: Record<string, string> = {
    critical: "text-danger-light",
    warning: "text-warning-light",
    info: "text-yellow-400",
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-start gap-2 p-2 rounded-lg border transition-colors cursor-pointer hover:opacity-80",
        levelStyles[alert.level] || "border-gray-600 bg-gray-700/10"
      )}
    >
      <AlertTriangle className={cn("w-4 h-4 mt-0.5 shrink-0", levelColors[alert.level] || "text-gray-400")} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-gray-200 truncate">{alert.title}</div>
        <div className="text-[10px] text-gray-500 mt-0.5 line-clamp-1">{alert.message}</div>
      </div>
    </div>
  );
}

function RiskPlanRow({ plan, level, navigate }: { plan: any; level: string; navigate: (path: string) => void }) {
  const levelConfig: Record<string, { dot: string; border: string; bg: string }> = {
    critical: { dot: "bg-danger", border: "border-danger/20", bg: "bg-danger/5" },
    warning: { dot: "bg-warning", border: "border-warning/20", bg: "bg-warning/5" },
    info: { dot: "bg-port", border: "border-port/20", bg: "bg-port/5" },
  };
  const cfg = levelConfig[level] || levelConfig.info;

  return (
    <div
      className={cn("flex items-center justify-between p-2 rounded-lg border cursor-pointer hover:opacity-80 transition-opacity", cfg.border, cfg.bg)}
      onClick={() => {
        if (plan.voyageId) navigate(`/voyages/${plan.voyageId}`);
        else if (plan.id) navigate(`/plans/${plan.id}`);
      }}
    >
      <div className="flex items-center gap-2">
        <div className={cn("w-2 h-2 rounded-full", cfg.dot)} />
        <span className="text-xs text-gray-200">{plan.shipName || "未知船舶"}</span>
        <StatusBadge status={plan.status as never} />
      </div>
      <div className="flex items-center gap-2">
        {plan.lastStatusChangeReason && (
          <span className="text-[10px] text-gray-500 truncate max-w-32">
            {String(plan.lastStatusChangeReason).slice(0, 20)}...
          </span>
        )}
      </div>
    </div>
  );
}
