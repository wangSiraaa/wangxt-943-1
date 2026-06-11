import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { listVoyages } from '../api';
import type { Voyage } from '../types';
import { STATUS_LABELS } from '../types';
import StatusBadge from '../components/StatusBadge';
import { formatDateTime } from '../utils';

export default function Dashboard() {
  const { currentUser } = useUser();
  const [voyages, setVoyages] = useState<Voyage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        let list: Voyage[];
        if (currentUser?.role === 'captain') {
          list = await listVoyages(undefined, currentUser.id);
        } else {
          list = await listVoyages();
        }
        setVoyages(list);
      } finally {
        setLoading(false);
      }
    };
    if (currentUser) load();
  }, [currentUser]);

  const counts = {
    planned: voyages.filter((v) => v.status === 'planned').length,
    crew_verified: voyages.filter((v) => v.status === 'crew_verified').length,
    departed: voyages.filter((v) => v.status === 'departed').length,
    returned: voyages.filter((v) => v.status === 'returned').length,
    closed: voyages.filter((v) => v.status === 'closed').length,
  };

  const isCaptain = currentUser?.role === 'captain';
  const isWatchkeeper = currentUser?.role === 'watchkeeper';
  const isSupervisor = currentUser?.role === 'supervisor';

  const statCards = [
    {
      label: '待核验',
      value: counts.planned,
      color: 'bg-amber-50 text-amber-700 border-amber-200',
      icon: '📋',
    },
    {
      label: '核验通过',
      value: counts.crew_verified,
      color: 'bg-blue-50 text-blue-700 border-blue-200',
      icon: '✅',
    },
    {
      label: '海上航行中',
      value: counts.departed,
      color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      icon: '🚢',
    },
    {
      label: '待关闭',
      value: counts.returned,
      color: 'bg-purple-50 text-purple-700 border-purple-200',
      icon: '🏠',
    },
  ];

  const recentVoyages = voyages.slice(0, 6);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">
            欢迎回来，{currentUser?.name} 👋
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {isCaptain && '您可以在「出港计划」中提交新的出港申请，查看自己的航次状态。'}
            {isWatchkeeper &&
              '您可以在「航次管理」中处理放行和返港登记，在「船员核验」中核验船员名单。'}
            {isSupervisor &&
              '您可以在「监管总览」中查看所有航次的返港和关闭情况，关闭已返港的航次。'}
          </p>
        </div>
        <div className="flex gap-2">
          {isCaptain && (
            <Link to="/plans" className="btn-primary">
              ➕ 提交出港计划
            </Link>
          )}
          {isWatchkeeper && (
            <Link to="/verify" className="btn-primary">
              🔍 去核验船员
            </Link>
          )}
          {isSupervisor && (
            <Link to="/supervisor" className="btn-primary">
              🔍 查看监管总览
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((c) => (
          <div
            key={c.label}
            className={`card ${c.color} border-l-4`}
            style={{
              borderLeftColor:
                c.label === '待核验'
                  ? '#f59e0b'
                  : c.label === '核验通过'
                    ? '#3b82f6'
                    : c.label === '海上航行中'
                      ? '#6366f1'
                      : '#a855f7',
            }}
          >
            <div className="card-body flex items-center justify-between">
              <div>
                <p className="text-sm font-medium opacity-80">{c.label}</p>
                <p className="text-3xl font-bold mt-2">{c.value}</p>
                <p className="text-xs mt-2 opacity-70">个航次</p>
              </div>
              <div className="text-5xl opacity-70">{c.icon}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800">最近航次</h3>
          <Link
            to={isCaptain ? '/plans' : '/verify'}
            className="text-sm text-sea-600 hover:text-sea-700 font-medium"
          >
            查看全部 →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>船舶名称</th>
                <th>船舶编号</th>
                <th>船长</th>
                <th>计划出港</th>
                <th>目的地</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400">
                    加载中...
                  </td>
                </tr>
              ) : recentVoyages.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400">
                    暂无航次记录
                  </td>
                </tr>
              ) : (
                recentVoyages.map((v) => (
                  <tr key={v.id}>
                    <td className="font-medium">{v.vesselName}</td>
                    <td className="text-slate-600 font-mono text-xs">
                      {v.vesselNumber}
                    </td>
                    <td>{v.captainName}</td>
                    <td>{formatDateTime(v.departureTime)}</td>
                    <td className="text-slate-600">{v.destination}</td>
                    <td>
                      <StatusBadge status={v.status} />
                    </td>
                    <td>
                      <Link
                        to={`/voyages/${v.id}`}
                        className="text-sea-600 hover:text-sea-700 text-sm font-medium"
                      >
                        详情
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-slate-800">
              📖 操作指南
            </h3>
          </div>
          <div className="card-body space-y-3 text-sm text-slate-600">
            {isCaptain && (
              <>
                <div className="flex gap-2">
                  <span className="text-amber-500 font-bold">1.</span>
                  <span>
                    在「出港计划」中填写船舶信息、船员名单并提交计划
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="text-amber-500 font-bold">2.</span>
                  <span>等待港口值班员核验船员名单后放行出港</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-amber-500 font-bold">3.</span>
                  <span>作业完成返港后，由值班员登记返港信息</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-amber-500 font-bold">⚠️</span>
                  <span className="text-red-600">
                    气象预警期间禁止提交出港计划！
                  </span>
                </div>
              </>
            )}
            {isWatchkeeper && (
              <>
                <div className="flex gap-2">
                  <span className="text-blue-500 font-bold">1.</span>
                  <span>
                    在「船员核验」中逐一核对航次船员身份信息，确认后签字放行
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="text-blue-500 font-bold">2.</span>
                  <span>
                    在「航次管理」中对核验通过的航次执行放行或返港登记
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="text-blue-500 font-bold">3.</span>
                  <span>每一步操作都会记录审计日志，保留操作痕迹</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-blue-500 font-bold">⚠️</span>
                  <span className="text-red-600">
                    船员名单全部确认才能放行，预警期间禁止出港！
                  </span>
                </div>
              </>
            )}
            {isSupervisor && (
              <>
                <div className="flex gap-2">
                  <span className="text-purple-500 font-bold">1.</span>
                  <span>在「监管总览」中查看所有航次的返港与关闭情况</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-purple-500 font-bold">2.</span>
                  <span>
                    对已返港的航次进行确认关闭，完成航次生命周期
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="text-purple-500 font-bold">3.</span>
                  <span>所有航次操作均有审计日志可追溯</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-purple-500 font-bold">⚠️</span>
                  <span className="text-red-600">
                    只有已返港的航次才能关闭！
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-slate-800">
              🔄 航次生命周期
            </h3>
          </div>
          <div className="card-body">
            <div className="flex items-center justify-between gap-1 flex-wrap">
              {[
                ['planned', '待核验', '📋'],
                ['crew_verified', '核验通过', '✅'],
                ['departed', '已出港', '🚢'],
                ['returned', '已返港', '🏠'],
                ['closed', '已关闭', '📦'],
              ].map(([key, label, icon], i, arr) => (
                <div key={key} className="flex items-center">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-12 h-12 rounded-full bg-slate-100 border-2 border-slate-300 flex items-center justify-center text-2xl">
                      {icon}
                    </div>
                    <span className="text-xs text-slate-600 font-medium">
                      {label}
                    </span>
                  </div>
                  {i < arr.length - 1 && (
                    <div className="w-6 sm:w-10 h-0.5 bg-slate-300 -mt-5 mx-0.5"></div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
