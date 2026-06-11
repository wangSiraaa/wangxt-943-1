import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { listVoyages, closeVoyage, listAuditLogs } from '../api';
import type { Voyage, AuditLog } from '../types';
import {
  STATUS_LABELS,
  ROLE_LABELS,
  AUDIT_ACTION_LABELS,
} from '../types';
import StatusBadge from '../components/StatusBadge';
import { formatDateTime } from '../utils';

export default function SupervisorOverview() {
  const { currentUser } = useUser();
  const [voyages, setVoyages] = useState<Voyage[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'returned' | 'departed' | 'all'>('returned');
  const [closingId, setClosingId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [vs, ls] = await Promise.all([
          listVoyages(),
          listAuditLogs(),
        ]);
        setVoyages(vs);
        setLogs(ls);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const doClose = async (v: Voyage) => {
    if (!currentUser) return;
    if (!confirm(`确定关闭「${v.vesselName}」航次吗？`)) return;
    setClosingId(v.id);
    try {
      await closeVoyage(v.id, currentUser.id);
      setVoyages((vs) =>
        vs.map((vv) =>
          vv.id === v.id
            ? { ...vv, status: 'closed', closedAt: new Date().toISOString() }
            : vv,
        ),
      );
      alert('✅ 航次已关闭');
    } catch (e: any) {
      alert(e?.response?.data?.error || e.message);
    } finally {
      setClosingId(null);
    }
  };

  const filteredVoyages =
    tab === 'returned'
      ? voyages.filter((v) => v.status === 'returned' || v.status === 'closed')
      : tab === 'departed'
        ? voyages.filter((v) => v.status === 'departed')
        : voyages;

  const stats = {
    total: voyages.length,
    departed: voyages.filter((v) => v.status === 'departed').length,
    returned: voyages.filter((v) => v.status === 'returned').length,
    closed: voyages.filter((v) => v.status === 'closed').length,
  };

  const overdueDeparted = voyages.filter(
    (v) =>
      v.status === 'departed' &&
      v.expectedReturnTime &&
      new Date(v.expectedReturnTime) < new Date(),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">监管总览</h2>
          <p className="mt-1 text-sm text-slate-500">
            监管员视角：查看航次返港与关闭情况，执行航次关闭操作
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card bg-gradient-to-br from-sea-50 to-sea-100 border-sea-200">
          <div className="card-body">
            <p className="text-sm text-sea-700 opacity-80">航次总数</p>
            <p className="text-3xl font-bold text-sea-800 mt-2">
              {stats.total}
            </p>
          </div>
        </div>
        <div className="card bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200">
          <div className="card-body">
            <p className="text-sm text-indigo-700 opacity-80">海上航行中</p>
            <p className="text-3xl font-bold text-indigo-800 mt-2">
              {stats.departed}
            </p>
            {overdueDeparted.length > 0 && (
              <p className="text-xs text-red-600 mt-1 font-medium">
                ⚠️ {overdueDeparted.length} 个超期未返
              </p>
            )}
          </div>
        </div>
        <div className="card bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <div className="card-body">
            <p className="text-sm text-amber-700 opacity-80">待关闭</p>
            <p className="text-3xl font-bold text-amber-800 mt-2">
              {stats.returned}
            </p>
          </div>
        </div>
        <div className="card bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
          <div className="card-body">
            <p className="text-sm text-emerald-700 opacity-80">已关闭</p>
            <p className="text-3xl font-bold text-emerald-800 mt-2">
              {stats.closed}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card">
          <div className="card-header flex items-center justify-between flex-wrap gap-3">
            <h3 className="text-lg font-semibold text-slate-800">
              航次状态监控
            </h3>
            <div className="flex bg-slate-100 rounded-lg p-1">
              {[
                ['returned', '待关闭'],
                ['departed', '航行中'],
                ['all', '全部'],
              ].map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setTab(k as any)}
                  className={`px-4 py-1.5 rounded-md text-sm transition-colors ${
                    tab === k
                      ? 'bg-white shadow-sm text-sea-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>船舶</th>
                  <th>船长</th>
                  <th>计划出港</th>
                  <th>预计返港</th>
                  <th>实际出港</th>
                  <th>实际返港</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-slate-400">
                      加载中...
                    </td>
                  </tr>
                ) : filteredVoyages.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-slate-400">
                      暂无{tab === 'returned' ? '待关闭或已关闭' : tab === 'departed' ? '航行中' : ''}航次
                    </td>
                  </tr>
                ) : (
                  filteredVoyages.map((v) => {
                    const isOverdue =
                      v.status === 'departed' &&
                      v.expectedReturnTime &&
                      new Date(v.expectedReturnTime) < new Date();
                    return (
                      <tr key={v.id} className={isOverdue ? 'bg-red-50/50' : ''}>
                        <td>
                          <div className="font-medium">{v.vesselName}</div>
                          <div className="text-xs text-slate-500 font-mono">
                            {v.vesselNumber}
                          </div>
                        </td>
                        <td>{v.captainName}</td>
                        <td className="whitespace-nowrap text-xs">
                          {formatDateTime(v.departureTime)}
                        </td>
                        <td className="whitespace-nowrap text-xs">
                          {formatDateTime(v.expectedReturnTime)}
                          {isOverdue && (
                            <div className="text-red-600 mt-0.5 font-medium">
                              ⚠️ 已超期
                            </div>
                          )}
                        </td>
                        <td className="whitespace-nowrap text-xs">
                          {formatDateTime(v.actualDepartureTime)}
                        </td>
                        <td className="whitespace-nowrap text-xs">
                          {formatDateTime(v.actualReturnTime)}
                        </td>
                        <td>
                          <StatusBadge status={v.status} />
                        </td>
                        <td className="whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Link
                              to={`/voyages/${v.id}`}
                              className="text-sea-600 hover:text-sea-700 text-sm font-medium"
                            >
                              详情
                            </Link>
                            {v.status === 'returned' && (
                              <button
                                onClick={() => doClose(v)}
                                disabled={closingId === v.id}
                                className="text-xs bg-slate-800 text-white px-2.5 py-1 rounded hover:bg-slate-900 transition-colors disabled:opacity-50"
                              >
                                {closingId === v.id ? '...' : '关闭'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-slate-800">
              全局审计日志
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              所有航次操作记录（最近20条）
            </p>
          </div>
          <div className="divide-y divide-slate-100 max-h-[600px] overflow-auto">
            {logs.slice(0, 20).map((log) => (
              <div key={log.id} className="px-5 py-3 hover:bg-slate-50">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-800">
                        {AUDIT_ACTION_LABELS[log.action]}
                      </span>
                      <span
                        className={`status-badge text-[10px] ${
                          log.operatorRole === 'captain'
                            ? 'bg-amber-100 text-amber-700'
                            : log.operatorRole === 'watchkeeper'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-purple-100 text-purple-700'
                        }`}
                      >
                        {ROLE_LABELS[log.operatorRole]}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {log.details}
                    </p>
                    {log.voyageId && (
                      <Link
                        to={`/voyages/${log.voyageId}`}
                        className="text-[11px] text-sea-600 hover:text-sea-700 mt-0.5 inline-block"
                      >
                        查看航次 →
                      </Link>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">
                    {formatDateTime(log.createdAt)}
                  </span>
                </div>
              </div>
            ))}
            {logs.length === 0 && !loading && (
              <div className="px-6 py-10 text-center text-slate-400 text-sm">
                暂无审计记录
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
