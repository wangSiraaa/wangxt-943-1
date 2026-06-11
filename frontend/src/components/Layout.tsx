import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import WeatherBanner from './WeatherBanner';
import { ROLE_LABELS } from '../types';

export default function Layout() {
  const { currentUser, users, switchUser, loading } = useUser();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-500 animate-pulse">系统加载中...</div>
      </div>
    );
  }

  const isCaptain = currentUser?.role === 'captain';
  const isWatchkeeper = currentUser?.role === 'watchkeeper';
  const isSupervisor = currentUser?.role === 'supervisor';

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <header className="bg-gradient-to-r from-sea-700 via-sea-600 to-sea-500 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-3xl">⚓</div>
            <div>
              <h1 className="text-xl font-bold tracking-wide">
                渔港进出港登记系统
              </h1>
              <p className="text-xs text-sea-100 opacity-90">
                Fishing Port Entry / Exit Registration
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-white/10 rounded-lg px-4 py-2 backdrop-blur-sm">
              <span className="text-sea-100 text-sm">当前身份：</span>
              <select
                value={currentUser?.id || ''}
                onChange={(e) => switchUser(e.target.value)}
                className="bg-white/95 text-slate-800 text-sm rounded px-3 py-1.5 outline-none font-medium min-w-[180px]"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}（{ROLE_LABELS[u.role]}）
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <WeatherBanner />
        <nav className="max-w-7xl mx-auto px-6 pb-3 flex items-center gap-2 text-sm">
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `px-4 py-2 rounded-lg transition-colors ${
                isActive
                  ? 'bg-white text-sea-700 font-semibold shadow-sm'
                  : 'text-white/90 hover:bg-white/10'
              }`
            }
          >
            📊 工作台
          </NavLink>
          <NavLink
            to="/plans"
            className={({ isActive }) =>
              `px-4 py-2 rounded-lg transition-colors ${
                isActive
                  ? 'bg-white text-sea-700 font-semibold shadow-sm'
                  : 'text-white/90 hover:bg-white/10'
              } ${!isCaptain ? '' : ''}`
            }
          >
            📝 {isCaptain ? '出港计划' : '航次管理'}
          </NavLink>
          {isWatchkeeper && (
            <NavLink
              to="/verify"
              className={({ isActive }) =>
                `px-4 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-white text-sea-700 font-semibold shadow-sm'
                    : 'text-white/90 hover:bg-white/10'
                }`
              }
            >
              ✅ 船员核验
            </NavLink>
          )}
          {isSupervisor && (
            <NavLink
              to="/supervisor"
              className={({ isActive }) =>
                `px-4 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-white text-sea-700 font-semibold shadow-sm'
                    : 'text-white/90 hover:bg-white/10'
                }`
              }
            >
              🔍 监管总览
            </NavLink>
          )}
          {location.pathname.startsWith('/voyages/') && (
            <span className="px-4 py-2 text-white/70">› 航次详情</span>
          )}
        </nav>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-6">
        <Outlet />
      </main>

      <footer className="bg-white border-t border-slate-200 py-4">
        <div className="max-w-7xl mx-auto px-6 text-center text-sm text-slate-500">
          © 2026 渔港进出港登记系统 · 保障海上作业安全 · {currentUser && (
            <span className="text-sea-600">
              操作人：{currentUser.name}（{ROLE_LABELS[currentUser.role]}）
            </span>
          )}
        </div>
      </footer>
    </div>
  );
}
