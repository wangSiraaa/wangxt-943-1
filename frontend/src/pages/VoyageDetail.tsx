import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import {
  getVoyageDetail,
  departVoyage,
  returnVoyage,
  closeVoyage,
} from '../api';
import type {
  Voyage,
  CrewMember,
  AuditLog,
} from '../types';
import {
  STATUS_LABELS,
  AUDIT_ACTION_LABELS,
  ROLE_LABELS,
} from '../types';
import StatusBadge from '../components/StatusBadge';
import { formatDateTime, maskIdNumber } from '../utils';

export default function VoyageDetail() {
  const { id } = useParams<{ id: string }>();
  const { currentUser } = useUser();
  const [loading, setLoading] = useState(true);
  const [voyage, setVoyage] = useState<Voyage | null>(null);
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        const detail = await getVoyageDetail(id);
        setVoyage(detail.voyage);
        setCrew(detail.crew);
        setLogs(detail.auditLogs);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const isWatchkeeper = currentUser?.role === 'watchkeeper';
  const isSupervisor = currentUser?.role === 'supervisor';
  const isCaptain = currentUser?.role === 'captain';

  const doAction = async (
    action: 'depart' | 'return' | 'close',
  ) => {
    if (!voyage || !currentUser || !id) return;
    setActionLoading(true);
    try {
      if (action === 'depart') {
        await departVoyage(id, currentUser.id);
        const detail = await getVoyageDetail(id);
        setVoyage(detail.voyage);
        setLogs(detail.auditLogs);
        alert('✅ 放行成功');
      } else if (action === 'return') {
        await returnVoyage(id, currentUser.id);
        const detail = await getVoyageDetail(id);
        setVoyage(detail.voyage);
        setLogs(detail.auditLogs);
        alert('✅ 返港登记成功');
      } else if (action === 'close') {
        await closeVoyage(id, currentUser.id);
        const detail = await getVoyageDetail(id);
        setVoyage(detail.voyage);
        setLogs(detail.auditLogs);
        alert('✅ 航次已关闭');
      }
    } catch (e: any) {
      alert(e?.response?.data?.error || e.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div className="card-body text-center py-20 text-slate-400">加载中...</div>
      </div>
    );
  }

  if (!voyage) {
    return (
      <div className="card">
        <div className="card-body text-center py-16">
          <div className="text-5xl mb-4">❓</div>
          <p className="text-slate-500 mb-4">航次不存在</p>
          <Link to="/dashboard" className="btn-primary">
            返回首页
          </Link>
        </div>
      </div>
    );
  }

  const timeline = [
    {
      label: '创建航次',
      time: voyage.createdAt,
      by: voyage.captainName,
      done: true,
      icon: '📝',
      color: 'bg-sea-500',
    },
    {
      label: '船员核验',
      time: voyage.crewVerifiedAt,
      by: null,
      done: !!voyage.crewVerifiedAt,
      icon: '✅',
      color: 'bg-blue-500',
    },
    {
      label: '放行出港',
      time: voyage.departedAt,
      by: null,
      done: !!voyage.departedAt,
      icon: '🚢',
      color: 'bg-indigo-500',
    },
    {
      label: '返港登记',
      time: voyage.returnedAt,
      by: null,
      done: !!voyage.returnedAt,
      icon: '🏠',
      color: 'bg-purple-500',
    },
    {
      label: '航次关闭',
      time: voyage.closedAt,
      by: null,
      done: !!voyage.closedAt,
      icon: '📦',
      color: 'bg-slate-500',
    },
  ];

  const infoPairs: Array<[string, string]> = [
    ['船舶名称', voyage.vesselName],
    ['船舶编号', voyage.vesselNumber],
    ['船长', voyage.captainName],
    ['出海目的', voyage.purpose],
    ['作业目的地', voyage.destination],
    ['计划出港', formatDateTime(voyage.departureTime)],
    ['预计返港', formatDateTime(voyage.expectedReturnTime)],
    ['实际出港', formatDateTime(voyage.actualDepartureTime)],
    ['实际返港', formatDateTime(voyage.actualReturnTime)],
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            to={isCaptain ? '/plans' : '/dashboard'}
            className="text-sm text-slate-500 hover:text-sea-600 mb-2 inline-flex items-center gap-1"
          >
            ← 返回
          </Link>
          <div className="flex items-center gap-3 mt-1">
            <h2 className="text-2xl font-bold text-slate-800">
              {voyage.vesselName}
            </h2>
            <StatusBadge status={voyage.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            航次编号：
            <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">
              {voyage.id}
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          {isWatchkeeper && voyage.status === 'crew_verified' && (
            <button
              className="btn-success"
              onClick={() => doAction('depart')}
              disabled={actionLoading}
            >
              🚢 放行出港
            </button>
          )}
          {isWatchkeeper && voyage.status === 'departed' && (
            <button
              className="btn-primary"
              onClick={() => doAction('return')}
              disabled={actionLoading}
            >
              🏠 登记返港
            </button>
          )}
          {isSupervisor && voyage.status === 'returned' && (
            <button
              className="btn-secondary"
              onClick={() => doAction('close')}
              disabled={actionLoading}
            >
              📦 关闭航次
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold text-slate-800">
                航次基本信息
              </h3>
            </div>
            <div className="card-body">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                {infoPairs.map(([k, v]) => (
                  <div key={k} className="flex gap-4">
                  <span className="w-24 text-sm text-slate-500 shrink-0">{k}</span>
                  <span className="text-sm font-medium text-slate-800">{v}</span>
                </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800">船员名单</h3>
              {voyage.crewVerifiedAt && (
                <span className="status-badge bg-emerald-100 text-emerald-700">
                  ✅ 已核验
                </span>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>姓名</th>
                    <th>身份证号</th>
                    <th>职务</th>
                    <th>联系电话</th>
                    <th>核验状态</th>
                  </tr>
                </thead>
                <tbody>
                  {crew.map((c) => (
                    <tr key={c.id}>
                      <td className="font-medium">{c.name}</td>
                      <td className="font-mono text-xs text-slate-600">
                        {maskIdNumber(c.idNumber)}
                      </td>
                      <td>
                        <span className="inline-flex px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs">
                          {c.position}
                        </span>
                      </td>
                      <td className="font-mono text-xs">{c.phone}</td>
                      <td>
                        {c.isVerified ? (
                          <span className="status-badge bg-emerald-100 text-emerald-800">
                            ✅ 已确认
                          </span>
                        ) : (
                          <span className="status-badge bg-slate-100 text-slate-500">
                            ⏳ 待确认
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold text-slate-800">
              航次生命周期
              </h3>
            </div>
            <div className="card-body">
              <ol className="relative border-l-2 border-slate-200 ml-3 space-y-6">
                {timeline.map((t, i) => (
                  <li key={t.label} className="ml-6">
                    <span
                      className={`absolute -left-[11px] flex items-center justify-center w-5 h-5 rounded-full ring-4 ring-white ${
                        t.done ? t.color : 'bg-slate-300'
                      }`}
                    >
                      <span className="text-[10px]">{t.done ? t.icon : ''}</span>
                    </span>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3">
                      <h4
                        className={`font-semibold ${
                          t.done ? 'text-slate-800' : 'text-slate-400'
                        }`}
                      >
                        {t.label}
                      </h4>
                      {t.done && (
                        <div className="text-xs text-slate-500 flex items-center gap-2 mt-1 sm:mt-0">
                          <span>{formatDateTime(t.time)}</span>
                          {t.by && <span>· {t.by}</span>}
                          {i === 1 && voyage.crewVerifiedBy && (
                            <span>· 核验人</span>
                          )}
                          {i === 2 && voyage.departedBy && (
                            <span>· 放行人</span>
                          )}
                          {i === 3 && voyage.returnedBy && (
                            <span>· 登记人</span>
                          )}
                          {i === 4 && voyage.closedBy && (
                            <span>· 关闭人</span>
                          )}
                        </div>
                      )}
                    </div>
                    {!t.done && (
                      <p className="text-xs text-slate-400 mt-1">
                        等待处理中...
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold text-slate-800">操作审计日志</h3>
            </div>
            <div className="divide-y divide-slate-100 max-h-[500px] overflow-auto">
              {logs.length === 0 ? (
                <div className="px-6 py-10 text-center text-slate-400 text-sm">
                  暂无操作记录
                </div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="px-6 py-3">
                    <div className="flex items-center justify-between">
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
                    <p className="text-xs text-slate-600 mt-1">
                      {log.details}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {log.operatorName} ·{' '}
                      {formatDateTime(log.createdAt)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card bg-gradient-to-br from-sea-50 to-blue-50 border-sea-200">
            <div className="card-body">
              <h4 className="font-semibold text-sea-800 mb-2">💡 提示</h4>
              <ul className="text-xs text-sea-700 space-y-1.5 leading-relaxed">
                <li>• 所有操作都会记录审计日志</li>
                <li>• 船员核验通过后才能放行</li>
                <li>• 气象预警期间禁止出港</li>
                <li>• 返港后监管员才可关闭航次</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
