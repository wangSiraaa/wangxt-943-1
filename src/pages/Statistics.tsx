import { useState, useEffect, useCallback } from "react";
import {
  Ship,
  Anchor,
  Navigation,
  AlertTriangle,
  FileWarning,
  FileX,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { useDataStore } from "@/store/dataStore";
import { cn } from "@/lib/utils";

interface Overview {
  totalShips: number;
  inPortShips: number;
  outPortShips: number;
  activeVoyages: number;
  activeAlerts: number;
  certAbnormal: number;
}

const PIE_COLORS = ["#2D8A56", "#1E6091", "#E8672C", "#D93025", "#6B7280"];

const CHART_BG = "#0A1628";
const GRID_COLOR = "#1E3048";
const LABEL_COLOR = "#9CA3AF";

export default function Statistics() {
  const { statistics, compliance, trends, fetchStatistics, fetchCompliance, fetchTrends } = useDataStore();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [pieData, setPieData] = useState<{ name: string; value: number }[]>([]);
  const [days, setDays] = useState(7);

  const load = useCallback(async () => {
    await Promise.all([fetchStatistics(), fetchCompliance(), fetchTrends()]);
  }, [fetchStatistics, fetchCompliance, fetchTrends]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!statistics) return;
    if (!overview) {
      setOverview({
        totalShips: statistics.ships.total,
        inPortShips: statistics.ships.inPort,
        outPortShips: statistics.ships.atSea,
        activeVoyages: statistics.voyages.active,
        activeAlerts: statistics.alerts.unresolved,
        certAbnormal: statistics.certificates.expired + statistics.certificates.expiringSoon,
      });
    }
    if (pieData.length === 0) {
      setPieData([
        { name: "在港", value: statistics.ships.inPort },
        { name: "出海", value: statistics.ships.atSea },
        { name: "维护", value: statistics.ships.maintenance },
      ]);
    }
  }, [statistics, overview, pieData.length]);

  const cards = overview
    ? [
        { label: "总船舶", value: overview.totalShips, icon: Ship, color: "text-nautical-light" },
        { label: "在港", value: overview.inPortShips, icon: Anchor, color: "text-port" },
        { label: "出港", value: overview.outPortShips, icon: Navigation, color: "text-nautical-light" },
        { label: "活跃航次", value: overview.activeVoyages, icon: Ship, color: "text-nautical-light" },
        { label: "预警", value: overview.activeAlerts, icon: AlertTriangle, color: "text-warning" },
        { label: "证书异常", value: overview.certAbnormal, icon: FileWarning, color: "text-danger" },
      ]
    : [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-100">统计看板</h1>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="bg-navy-light border border-navy-lighter rounded-xl p-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">{c.label}</span>
              <c.icon className={cn("w-4 h-4", c.color)} />
            </div>
            <div className="text-2xl font-bold text-gray-100 mt-1">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-navy-light border border-navy-lighter rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-300">进出港趋势</h3>
            <div className="flex gap-1">
              {[7, 30, 90].map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className={cn(
                    "px-2.5 py-1 text-xs rounded-lg transition-colors",
                    days === d
                      ? "bg-nautical text-white"
                      : "bg-navy-lighter text-gray-400 hover:text-gray-200"
                  )}
                >
                  {d}天
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trends ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
              <XAxis dataKey="date" tick={{ fill: LABEL_COLOR, fontSize: 12 }} />
              <YAxis tick={{ fill: LABEL_COLOR, fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0F2035",
                  border: "1px solid #162D4A",
                  borderRadius: 8,
                  color: "#E5E7EB",
                }}
              />
              <Legend wrapperStyle={{ color: LABEL_COLOR }} />
              <Line
                type="monotone"
                dataKey="departures"
                name="出港"
                stroke="#1E6091"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="returns"
                name="返港"
                stroke="#2D8A56"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-navy-light border border-navy-lighter rounded-xl p-5">
          <h3 className="text-sm font-medium text-gray-300 mb-4">船舶状态分布</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                outerRadius={90}
                dataKey="value"
                label={({ name, value }) => `${name} ${value}`}
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0F2035",
                  border: "1px solid #162D4A",
                  borderRadius: 8,
                  color: "#E5E7EB",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-navy-light border border-navy-lighter rounded-xl p-5">
          <h3 className="text-sm font-medium text-gray-300 mb-4">合规分析</h3>
          {compliance && (
            <div className="grid grid-cols-3 gap-4">
              {[
                {
                  label: "驳回率",
                  value: compliance.rejectionRate,
                  icon: FileX,
                  color: "text-danger",
                  bg: "bg-danger/10",
                },
                {
                  label: "撤销率",
                  value: compliance.revocationRate,
                  icon: FileWarning,
                  color: "text-warning",
                  bg: "bg-warning/10",
                },
                {
                  label: "异常率",
                  value: compliance.abnormalRate,
                  icon: AlertTriangle,
                  color: "text-warning-light",
                  bg: "bg-warning/10",
                },
              ].map((m) => (
                <div
                  key={m.label}
                  className={cn("rounded-xl p-4 text-center", m.bg)}
                >
                  <m.icon className={cn("w-6 h-6 mx-auto mb-2", m.color)} />
                  <div className={cn("text-2xl font-bold", m.color)}>
                    {m.value}%
                  </div>
                  <div className="text-xs text-gray-400 mt-1">{m.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-navy-light border border-navy-lighter rounded-xl p-5">
          <h3 className="text-sm font-medium text-gray-300 mb-4">拒绝原因分布</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={compliance?.rejectionReasons ?? []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} horizontal={false} />
              <XAxis type="number" tick={{ fill: LABEL_COLOR, fontSize: 12 }} />
              <YAxis
                type="category"
                dataKey="reason"
                tick={{ fill: LABEL_COLOR, fontSize: 12 }}
                width={80}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0F2035",
                  border: "1px solid #162D4A",
                  borderRadius: 8,
                  color: "#E5E7EB",
                }}
              />
              <Bar dataKey="count" name="次数" fill="#E8672C" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
