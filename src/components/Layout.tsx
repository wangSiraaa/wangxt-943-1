import { useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  Ship,
  Users,
  Anchor,
  AlertTriangle,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  LogOut,
  CloudSun,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useDataStore } from "@/store/dataStore";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "工作台" },
  { to: "/plans", icon: FileText, label: "进出港计划" },
  { to: "/ships", icon: Ship, label: "船舶管理" },
  { to: "/crew", icon: Users, label: "船员管理" },
  { to: "/berths", icon: Anchor, label: "泊位管理" },
  { to: "/alerts", icon: AlertTriangle, label: "告警中心" },
  { to: "/statistics", icon: BarChart3, label: "统计分析" },
];

const roleLabels: Record<string, string> = {
  admin: "管理员",
  captain: "船长",
  duty_officer: "值班员",
  supervisor: "监管员",
};

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuthStore();
  const { weather } = useDataStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen bg-navy overflow-hidden">
      <aside
        className={cn(
          "flex flex-col bg-navy-light border-r border-navy-lighter transition-all duration-300 shrink-0",
          collapsed ? "w-16" : "w-60"
        )}
      >
        <div className="flex items-center h-14 px-4 border-b border-navy-lighter">
          <Ship className="w-6 h-6 text-nautical-light shrink-0" />
          {!collapsed && (
            <span className="ml-3 text-sm font-semibold text-gray-100 whitespace-nowrap animate-fade-in">
              渔港进出港登记
            </span>
          )}
        </div>

        <nav className="flex-1 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center mx-2 px-3 py-2.5 rounded-lg text-sm transition-colors",
                  isActive
                    ? "bg-nautical text-white"
                    : "text-gray-400 hover:bg-navy-lighter hover:text-gray-200"
                )
              }
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {!collapsed && (
                <span className="ml-3 whitespace-nowrap animate-fade-in">
                  {item.label}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center h-10 border-t border-navy-lighter text-gray-500 hover:text-gray-300 transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </aside>

      <div className="flex flex-col flex-1 overflow-hidden">
        <header className="flex items-center justify-between h-14 px-6 bg-navy-light border-b border-navy-lighter shrink-0">
          <div className="flex items-center gap-3 text-sm text-gray-400">
            <CloudSun className="w-4 h-4" />
            {weather ? (
              <span>
                {weather.condition} {weather.temperature}°C 风速{weather.windSpeed}m/s
              </span>
            ) : (
              <span>天气加载中...</span>
            )}
          </div>

          <div className="flex items-center gap-4">
            {user && (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-300">{user.name}</span>
                  <span className="px-2 py-0.5 text-xs rounded bg-nautical/30 text-nautical-light">
                    {roleLabels[user.role] || user.role}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1 text-sm text-gray-500 hover:text-danger transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>退出</span>
                </button>
              </>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
