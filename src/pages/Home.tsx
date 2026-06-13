import { useEffect } from "react";
import { Ship, Anchor, AlertTriangle, BarChart3 } from "lucide-react";
import { useDataStore } from "@/store/dataStore";
import { useAuthStore } from "@/store/authStore";
import AlertBanner from "@/components/AlertBanner";

export default function Home() {
  const { user } = useAuthStore();
  const { statistics, weather, fetchStatistics, fetchWeather, fetchAlerts } =
    useDataStore();

  useEffect(() => {
    fetchStatistics();
    fetchWeather();
    fetchAlerts();
  }, [fetchStatistics, fetchWeather, fetchAlerts]);

  const cards = [
    {
      label: "在港船舶",
      value: statistics?.ships.inPort ?? "-",
      icon: Anchor,
      color: "text-port",
    },
    {
      label: "出海船舶",
      value: statistics?.ships.atSea ?? "-",
      icon: Ship,
      color: "text-nautical-light",
    },
    {
      label: "待处理告警",
      value: statistics?.alerts.unresolved ?? "-",
      icon: AlertTriangle,
      color: "text-warning",
    },
    {
      label: "今日计划",
      value: statistics?.plans.total ?? "-",
      icon: BarChart3,
      color: "text-nautical-light",
    },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-gray-100">
            欢迎回来，{user?.name || "用户"}
          </h1>
          <p className="text-sm text-gray-500 mt-1">渔港进出港登记管理平台</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {cards.map((card) => (
            <div
              key={card.label}
              className="bg-navy-light border border-navy-lighter rounded-xl p-5 animate-fade-in"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">{card.label}</span>
                <card.icon className={`w-5 h-5 ${card.color}`} />
              </div>
              <div className="text-3xl font-bold text-gray-100 mt-2">
                {card.value}
              </div>
            </div>
          ))}
        </div>

        {weather && (
          <div className="bg-navy-light border border-navy-lighter rounded-xl p-5 mb-6 animate-fade-in">
            <h3 className="text-sm font-medium text-gray-300 mb-3">今日天气</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-lg font-semibold text-gray-100">
                  {weather.temperature}°C
                </div>
                <div className="text-xs text-gray-500">温度</div>
              </div>
              <div>
                <div className="text-lg font-semibold text-gray-100">
                  {weather.windSpeed}m/s
                </div>
                <div className="text-xs text-gray-500">
                  风速 {weather.windDirection}
                </div>
              </div>
              <div>
                <div className="text-lg font-semibold text-gray-100">
                  {weather.waveHeight}m
                </div>
                <div className="text-xs text-gray-500">浪高</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <AlertBanner />
    </div>
  );
}
