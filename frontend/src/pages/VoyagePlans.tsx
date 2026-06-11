import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { listVoyages, createVoyage, getActiveWeatherAlert } from '../api';
import type { Voyage, CrewInput } from '../types';
import StatusBadge from '../components/StatusBadge';
import { formatDateTime, toInputDateTime } from '../utils';

type FormState = {
  vesselName: string;
  vesselNumber: string;
  departureTime: string;
  expectedReturnTime: string;
  purpose: string;
  destination: string;
  crew: CrewInput[];
};

const EMPTY_CREW: CrewInput = {
  name: '',
  idNumber: '',
  position: '',
  phone: '',
};

const PURPOSE_OPTIONS = [
  '渔业捕捞',
  '水产养殖',
  '物资补给',
  '搜救作业',
  '海洋科考',
  '其他',
];

export default function VoyagePlans() {
  const { currentUser } = useUser();
  const navigate = useNavigate();
  const [voyages, setVoyages] = useState<Voyage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [weatherWarning, setWeatherWarning] = useState(false);
  const [form, setForm] = useState<FormState>(() => {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    return {
      vesselName: '',
      vesselNumber: '',
      departureTime: toInputDateTime(new Date(now.getTime() + 60 * 60 * 1000)),
      expectedReturnTime: toInputDateTime(tomorrow),
      purpose: '渔业捕捞',
      destination: '',
      crew: [{ ...EMPTY_CREW, position: '船长' }],
    };
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isCaptain = currentUser?.role === 'captain';

  useEffect(() => {
    const load = async () => {
      try {
        let list: Voyage[];
        if (isCaptain) {
          list = await listVoyages(undefined, currentUser.id);
        } else {
          list = await listVoyages();
        }
        setVoyages(list);
        const alert = await getActiveWeatherAlert();
        setWeatherWarning(alert?.level !== 'normal' && alert?.level !== undefined);
      } finally {
        setLoading(false);
      }
    };
    if (currentUser) load();
  }, [currentUser, isCaptain]);

  const addCrew = () => {
    setForm((f) => ({ ...f, crew: [...f.crew, { ...EMPTY_CREW }] }));
  };

  const removeCrew = (idx: number) => {
    setForm((f) => ({
      ...f,
      crew: f.crew.length > 1 ? f.crew.filter((_, i) => i !== idx) : f.crew,
    }));
  };

  const updateCrew = (idx: number, key: keyof CrewInput, value: string) => {
    setForm((f) => ({
      ...f,
      crew: f.crew.map((c, i) => (i === idx ? { ...c, [key]: value } : c)),
    }));
  };

  const validateForm = (): string => {
    if (!form.vesselName.trim()) return '船名不能为空';
    if (!form.vesselNumber.trim()) return '船舶编号不能为空';
    if (!form.departureTime) return '出港时间不能为空';
    if (!form.expectedReturnTime) return '预计返港时间不能为空';
    if (new Date(form.expectedReturnTime) <= new Date(form.departureTime)) {
      return '预计返港时间必须晚于出港时间';
    }
    if (!form.purpose.trim()) return '出海目的不能为空';
    if (!form.destination.trim()) return '目的地不能为空';
    for (let i = 0; i < form.crew.length; i++) {
      const c = form.crew[i];
      if (!c.name.trim()) return `第${i + 1}位船员姓名不能为空`;
      if (!c.idNumber.trim()) return `第${i + 1}位船员身份证号不能为空`;
      if (c.idNumber.length < 15) return `第${i + 1}位船员身份证号格式不正确`;
      if (!c.position.trim()) return `第${i + 1}位船员职务不能为空`;
      if (!c.phone.trim()) return `第${i + 1}位船员联系电话不能为空`;
    }
    return '';
  };

  const handleSubmit = async () => {
    const err = validateForm();
    if (err) {
      setFormError(err);
      return;
    }
    if (!currentUser) return;
    setFormError('');
    setSubmitting(true);
    try {
      const voyage = await createVoyage({
        ...form,
        captainId: currentUser.id,
        captainName: currentUser.name,
      });
      setVoyages((v) => [voyage, ...v]);
      setShowForm(false);
      setForm({
        vesselName: '',
        vesselNumber: '',
        departureTime: toInputDateTime(
          new Date(Date.now() + 60 * 60 * 1000),
        ),
        expectedReturnTime: toInputDateTime(
          new Date(Date.now() + 25 * 60 * 60 * 1000),
        ),
        purpose: '渔业捕捞',
        destination: '',
        crew: [{ ...EMPTY_CREW, position: '船长' }],
      });
    } catch (e: any) {
      setFormError(
        e?.response?.data?.error || e.message || '提交失败，请重试',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">
            {isCaptain ? '出港计划管理' : '航次管理'}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {isCaptain
              ? '提交新的出港计划并查看航次状态'
              : '查看所有航次，处理放行和返港登记'}
          </p>
        </div>
        {isCaptain && (
          <button
            className="btn-primary"
            onClick={() => setShowForm(true)}
            disabled={weatherWarning}
          >
            ➕ 提交出港计划
          </button>
        )}
      </div>

      {weatherWarning && isCaptain && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          🚨 当前处于气象预警期间，暂不接受出港计划提交。请等待预警解除后再操作。
        </div>
      )}

      {showForm && (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-800">
              📝 提交新出港计划
            </h3>
            <button
              className="text-slate-400 hover:text-slate-600 text-xl"
              onClick={() => setShowForm(false)}
            >
              ×
            </button>
          </div>
          <div className="card-body space-y-5">
            {formError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-sm text-red-600">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">船舶名称 <span className="text-red-500">*</span></label>
                <input
                  className="input"
                  placeholder="例如：辽渔888号"
                  value={form.vesselName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, vesselName: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="label">船舶编号 <span className="text-red-500">*</span></label>
                <input
                  className="input font-mono"
                  placeholder="例如：LY-2024-00888"
                  value={form.vesselNumber}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, vesselNumber: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="label">计划出港时间 <span className="text-red-500">*</span></label>
                <input
                  type="datetime-local"
                  className="input"
                  value={form.departureTime}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, departureTime: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="label">预计返港时间 <span className="text-red-500">*</span></label>
                <input
                  type="datetime-local"
                  className="input"
                  value={form.expectedReturnTime}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, expectedReturnTime: e.target.value }))
                  }
                />
              </div>
              <div>
                <label className="label">出海目的 <span className="text-red-500">*</span></label>
                <select
                  className="input"
                  value={form.purpose}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, purpose: e.target.value }))
                  }
                >
                  {PURPOSE_OPTIONS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">作业目的地 <span className="text-red-500">*</span></label>
                <input
                  className="input"
                  placeholder="例如：黄海88海区"
                  value={form.destination}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, destination: e.target.value }))
                  }
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="label mb-0">船员名单 <span className="text-red-500">*</span></label>
                <button
                  type="button"
                  onClick={addCrew}
                  className="btn-secondary text-xs py-1.5"
                >
                  ➕ 添加船员
                </button>
              </div>
              <div className="space-y-3">
                {form.crew.map((c, idx) => (
                  <div
                    key={idx}
                    className="p-4 border border-slate-200 rounded-lg bg-slate-50/50"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold text-slate-700">
                        船员 {idx + 1}
                      </span>
                      {form.crew.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeCrew(idx)}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          删除
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <div>
                        <label className="label text-xs">姓名</label>
                        <input
                          className="input text-sm"
                          placeholder="姓名"
                          value={c.name}
                          onChange={(e) => updateCrew(idx, 'name', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="label text-xs">身份证号</label>
                        <input
                          className="input text-sm font-mono"
                          placeholder="18位身份证号"
                          value={c.idNumber}
                          onChange={(e) =>
                            updateCrew(idx, 'idNumber', e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <label className="label text-xs">职务</label>
                        <select
                          className="input text-sm"
                          value={c.position}
                          onChange={(e) =>
                            updateCrew(idx, 'position', e.target.value)
                          }
                        >
                          {['船长', '大副', '二副', '轮机长', '水手', '渔捞长', '厨师'].map(
                            (p) => (
                              <option key={p} value={p}>{p}</option>
                            ),
                          )}
                        </select>
                      </div>
                      <div>
                        <label className="label text-xs">联系电话</label>
                        <input
                          className="input text-sm"
                          placeholder="手机号"
                          value={c.phone}
                          onChange={(e) => updateCrew(idx, 'phone', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                className="btn-secondary"
                onClick={() => setShowForm(false)}
              >
                取消
              </button>
              <button
                className="btn-primary"
                onClick={handleSubmit}
                disabled={submitting || weatherWarning}
              >
                {submitting ? '提交中...' : '✅ 提交出港计划'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-slate-800">
            {isCaptain ? '我的航次' : '全部航次'}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>船舶名称</th>
                <th>船舶编号</th>
                {!isCaptain && <th>船长</th>}
                <th>计划出港</th>
                <th>目的地</th>
                <th>实际出港</th>
                <th>实际返港</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-slate-400">
                    加载中...
                  </td>
                </tr>
              ) : voyages.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-slate-400">
                    暂无航次记录
                  </td>
                </tr>
              ) : (
                voyages.map((v) => (
                  <tr key={v.id}>
                    <td className="font-medium">{v.vesselName}</td>
                    <td className="font-mono text-xs text-slate-600">{v.vesselNumber}</td>
                    {!isCaptain && <td>{v.captainName}</td>}
                    <td>{formatDateTime(v.departureTime)}</td>
                    <td className="text-slate-600">{v.destination}</td>
                    <td>{formatDateTime(v.actualDepartureTime)}</td>
                    <td>{formatDateTime(v.actualReturnTime)}</td>
                    <td>
                      <StatusBadge status={v.status} />
                    </td>
                    <td>
                      <div className="flex gap-3">
                        <Link
                          to={`/voyages/${v.id}`}
                          className="text-sea-600 hover:text-sea-700 text-sm font-medium"
                        >
                          详情
                        </Link>
                        {!isCaptain && v.status === 'departed' && (
                          <button
                            className="text-purple-600 hover:text-purple-700 text-sm font-medium"
                            onClick={async () => {
                              try {
                                const { returnVoyage } = await import('../api');
                                if (!currentUser) return;
                                await returnVoyage(v.id, currentUser.id);
                                setVoyages((vs) =>
                                  vs.map((vv) =>
                                    vv.id === v.id
                                      ? { ...vv, status: 'returned', actualReturnTime: new Date().toISOString() }
                                      : vv,
                                  ),
                                );
                                alert('返港登记成功');
                              } catch (e: any) {
                                alert(e?.response?.data?.error || e.message);
                              }
                            }}
                          >
                            🏠 返港
                          </button>
                        )}
                        {!isCaptain && v.status === 'crew_verified' && (
                          <button
                            className="text-emerald-600 hover:text-emerald-700 text-sm font-medium"
                            onClick={async () => {
                              try {
                                const { departVoyage } = await import('../api');
                                if (!currentUser) return;
                                await departVoyage(v.id, currentUser.id);
                                setVoyages((vs) =>
                                  vs.map((vv) =>
                                    vv.id === v.id
                                      ? { ...vv, status: 'departed', actualDepartureTime: new Date().toISOString() }
                                      : vv,
                                  ),
                                );
                                alert('放行成功');
                              } catch (e: any) {
                                alert(e?.response?.data?.error || e.message);
                              }
                            }}
                          >
                            🚢 放行
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
