import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { listVoyages, verifyCrew } from '../api';
import type { Voyage, CrewMember, CrewVerification } from '../types';
import StatusBadge from '../components/StatusBadge';
import { formatDateTime, maskIdNumber } from '../utils';

export default function CrewVerification() {
  const { currentUser } = useUser();
  const [voyages, setVoyages] = useState<Voyage[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [crewList, setCrewList] = useState<CrewMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [detailCache, setDetailCache] = useState<
    Record<string, CrewMember[]>
  >({});

  useEffect(() => {
    const load = async () => {
      try {
        const list = await listVoyages();
        setVoyages(list);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const pendingVoyages = voyages.filter(
    (v) => v.status === 'planned' || v.status === 'crew_verified',
  );

  const openVoyage = async (id: string) => {
    setSelectedId(id);
    if (detailCache[id]) {
      setCrewList(detailCache[id].map((c) => ({ ...c })));
      return;
    }
    try {
      const { getVoyageDetail } = await import('../api');
      const detail = await getVoyageDetail(id);
      setDetailCache((c) => ({ ...c, [id]: detail.crew }));
      setCrewList(detail.crew.map((c) => ({ ...c })));
    } catch (e) {
      console.error(e);
    }
  };

  const toggleCrew = (crewId: string) => {
    setCrewList((list) =>
      list.map((c) =>
        c.id === crewId ? { ...c, isVerified: !c.isVerified } : c,
      ),
    );
  };

  const verifyAll = () => {
    setCrewList((list) => list.map((c) => ({ ...c, isVerified: true })));
  };

  const selectedVoyage = voyages.find((v) => v.id === selectedId);
  const verifiedCount = crewList.filter((c) => c.isVerified).length;
  const allVerified = verifiedCount === crewList.length && crewList.length > 0;

  const handleVerify = async () => {
    if (!selectedId || !currentUser) return;
    if (!allVerified) {
      alert('请先确认全部船员名单');
      return;
    }
    setSubmitting(true);
    try {
      const verifications: CrewVerification[] = crewList.map((c) => ({
        crewId: c.id,
        isVerified: c.isVerified,
      }));
      await verifyCrew(selectedId, currentUser.id, verifications);
      setVoyages((vs) =>
        vs.map((v) =>
          v.id === selectedId
            ? { ...v, status: 'crew_verified', crewVerifiedAt: new Date().toISOString() }
            : v,
        ),
      );
      alert('✅ 船员核验通过，航次已可放行');
    } catch (e: any) {
      alert(e?.response?.data?.error || e.message || '核验失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">船员核验</h2>
          <p className="mt-1 text-sm text-slate-500">
            待核验航次共 {pendingVoyages.filter((v) => v.status === 'planned').length} 个
          </p>
        </div>

        <div className="card max-h-[70vh] overflow-auto">
          {loading ? (
            <div className="card-body text-center text-slate-400">加载中...</div>
          ) : pendingVoyages.length === 0 ? (
            <div className="card-body text-center text-slate-400">暂无待核验航次</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {pendingVoyages.map((v) => (
                <button
                  key={v.id}
                  className={`w-full text-left px-5 py-4 hover:bg-slate-50 transition-colors ${
                    selectedId === v.id ? 'bg-sea-50' : ''
                  }`}
                  onClick={() => openVoyage(v.id)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-slate-800">
                      {v.vesselName}
                    </span>
                    <StatusBadge status={v.status} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>🚢 {v.vesselNumber}</span>
                    <span>👤 {v.captainName}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    📅 {formatDateTime(v.departureTime)} · 📍 {v.destination}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="lg:col-span-2">
        {!selectedVoyage ? (
          <div className="card h-full flex items-center justify-center min-h-[500px]">
            <div className="text-center py-12">
              <div className="text-6xl mb-4">👥</div>
              <p className="text-slate-500">请在左侧选择一个航次进行船员核验</p>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">
                  船员名单核验
                </h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  {selectedVoyage.vesselName}（{selectedVoyage.vesselNumber}）
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-600">
                  已确认 <span className="font-bold text-sea-600">{verifiedCount}</span> / {crewList.length}
                </span>
                {selectedVoyage.status === 'planned' && (
                  <button className="btn-secondary text-xs py-1.5" onClick={verifyAll}>
                    ✅ 全部确认
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                  <th style={{ width: 60 }}>确认</th>
                    <th>姓名</th>
                    <th>身份证号</th>
                    <th>职务</th>
                    <th>联系电话</th>
                    <th>核验状态</th>
                  </tr>
                </thead>
                <tbody>
                  {crewList.map((c) => (
                    <tr key={c.id} className={c.isVerified ? 'bg-emerald-50/50' : ''}>
                      <td>
                        <input
                          type="checkbox"
                          checked={c.isVerified}
                          disabled={selectedVoyage.status !== 'planned'}
                          onChange={() => toggleCrew(c.id)}
                          className="w-4 h-4 rounded border-slate-300 text-sea-600 focus:ring-sea-500"
                        />
                      </td>
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

            {selectedVoyage.crewVerifiedAt && (
              <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 text-sm text-slate-600 flex items-center justify-between">
                <div>
                  <span className="text-emerald-600 font-medium">✅ 已于 {formatDateTime(selectedVoyage.crewVerifiedAt)} 核验通过</span>
                </div>
                <Link
                  to={`/voyages/${selectedVoyage.id}`}
                  className="text-sea-600 hover:text-sea-700 text-sm font-medium"
                >
                  查看航次详情 →
                </Link>
              </div>
            )}

            {selectedVoyage.status === 'planned' && (
              <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  ⚠️ 必须确认全部 <span className="font-medium">每一位</span>船员后才能提交核验
                </p>
                <button
                  className="btn-primary"
                  onClick={handleVerify}
                  disabled={!allVerified || submitting}
                >
                  {submitting ? '提交中...' : '✅ 确认核验'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
