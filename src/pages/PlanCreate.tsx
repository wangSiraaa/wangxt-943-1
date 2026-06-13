import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Save, ArrowLeft, AlertTriangle } from "lucide-react";
import { useDataStore } from "@/store/dataStore";
import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";

const ROLE_CAPTAIN = "captain";

interface FormData {
  ship_id: string;
  departure_time: string;
  expected_return_time: string;
  route: string;
  route_risk_level: "low" | "medium" | "high";
  danger_goods_declared: number;
  danger_goods_detail: string;
  fuel_remaining: number;
  berth_id: string;
  crew_ids: string[];
}

const initialForm: FormData = {
  ship_id: "",
  departure_time: "",
  expected_return_time: "",
  route: "",
  route_risk_level: "low",
  danger_goods_declared: 0,
  danger_goods_detail: "",
  fuel_remaining: 80,
  berth_id: "",
  crew_ids: [],
};

const riskOptions: { value: FormData["route_risk_level"]; label: string; color: string }[] = [
  { value: "low", label: "低风险", color: "text-port" },
  { value: "medium", label: "中风险", color: "text-warning" },
  { value: "high", label: "高风险", color: "text-danger" },
];

const inputClass =
  "w-full bg-navy border border-navy-lighter rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-nautical transition-colors";

const labelClass = "block text-sm font-medium text-gray-300 mb-1.5";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-gray-200 border-b border-navy-lighter pb-2 mb-4">
      {children}
    </h3>
  );
}

export default function PlanCreate() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { ships, berths, crew, fetchShips, fetchBerths, fetchCrew } =
    useDataStore();
  const [form, setForm] = useState<FormData>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchShips();
    fetchBerths();
    fetchCrew();
  }, [fetchShips, fetchBerths, fetchCrew]);

  if (user?.role !== ROLE_CAPTAIN) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <AlertTriangle className="w-10 h-10 text-warning" />
        <p className="text-gray-400">仅船长角色可创建出港计划</p>
        <button
          onClick={() => navigate("/plans")}
          className="text-sm text-nautical-light hover:underline"
        >
          返回列表
        </button>
      </div>
    );
  }

  const filteredCrew = form.ship_id
    ? crew.filter((c) => c.ship_id === form.ship_id)
    : crew;

  const availableBerths = berths.filter((b) => b.status === "available");

  const update = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === "ship_id") {
      setForm((prev) => ({ ...prev, crew_ids: [] }));
    }
  };

  const toggleCrew = (crewId: string) => {
    setForm((prev) => ({
      ...prev,
      crew_ids: prev.crew_ids.includes(crewId)
        ? prev.crew_ids.filter((id) => id !== crewId)
        : [...prev.crew_ids, crewId],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.ship_id || !form.departure_time || !form.expected_return_time) {
      setError("请填写必填字段：船舶、计划出港时间、预计返港时间");
      return;
    }

    if (form.danger_goods_declared && !form.danger_goods_detail) {
      setError("请填写危险品申报详情");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "创建失败");
      }
      const data = await res.json();
      navigate(`/plans/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate("/plans")}
            className="p-1.5 rounded-lg hover:bg-navy-lighter text-gray-400 hover:text-gray-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-gray-100">
              创建出港计划
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              填写出港计划信息并提交审批
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-danger/10 border border-danger/30 text-danger-light rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <section className="bg-navy-light border border-navy-lighter rounded-xl p-5">
            <SectionTitle>基本信息</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>
                  船舶 <span className="text-danger">*</span>
                </label>
                <select
                  value={form.ship_id}
                  onChange={(e) => update("ship_id", e.target.value)}
                  className={inputClass}
                >
                  <option value="">选择船舶</option>
                  {ships.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.type})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>
                  计划出港时间 <span className="text-danger">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={form.departure_time}
                  onChange={(e) => update("departure_time", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>
                  预计返港时间 <span className="text-danger">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={form.expected_return_time}
                  onChange={(e) => update("expected_return_time", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>航线描述</label>
                <input
                  type="text"
                  value={form.route}
                  onChange={(e) =>
                    update("route", e.target.value)
                  }
                  placeholder="例：A港 → B港 → C港"
                  className={inputClass}
                />
              </div>
            </div>
          </section>

          <section className="bg-navy-light border border-navy-lighter rounded-xl p-5">
            <SectionTitle>航线风险</SectionTitle>
            <div className="flex gap-4">
              {riskOptions.map((opt) => (
                <label
                  key={opt.value}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer transition-colors",
                    form.route_risk_level === opt.value
                      ? "bg-navy-lighter border-nautical"
                      : "bg-navy border-navy-lighter hover:border-navy-lighter/80"
                  )}
                >
                  <input
                    type="radio"
                    name="riskLevel"
                    value={opt.value}
                    checked={form.route_risk_level === opt.value}
                    onChange={() => update("route_risk_level", opt.value)}
                    className="sr-only"
                  />
                  <span
                    className={cn(
                      "w-3 h-3 rounded-full border-2",
                      form.route_risk_level === opt.value
                        ? `${opt.color} border-current`
                        : "border-gray-500"
                    )}
                  />
                  <span
                    className={cn(
                      "text-sm",
                      form.route_risk_level === opt.value
                        ? opt.color
                        : "text-gray-400"
                    )}
                  >
                    {opt.label}
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section className="bg-navy-light border border-navy-lighter rounded-xl p-5">
            <SectionTitle>危险品申报</SectionTitle>
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <div
                  className={cn(
                    "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                    form.danger_goods_declared
                      ? "bg-warning border-warning"
                      : "border-gray-500"
                  )}
                >
                  {form.danger_goods_declared > 0 && (
                    <svg
                      className="w-3 h-3 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>
                <input
                  type="checkbox"
                  checked={!!form.danger_goods_declared}
                  onChange={(e) =>
                    update("danger_goods_declared", e.target.checked ? 1 : 0)
                  }
                  className="sr-only"
                />
                <span className="text-sm text-gray-300">
                  携带危险品出港
                </span>
              </label>
              {form.danger_goods_declared > 0 && (
                <textarea
                  value={form.danger_goods_detail}
                  onChange={(e) =>
                    update("danger_goods_detail", e.target.value)
                  }
                  placeholder="请详细描述危险品种类、数量及防护措施"
                  rows={3}
                  className={cn(inputClass, "resize-none")}
                />
              )}
            </div>
          </section>

          <section className="bg-navy-light border border-navy-lighter rounded-xl p-5">
            <SectionTitle>燃油与泊位</SectionTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>燃油余量</label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={form.fuel_remaining}
                    onChange={(e) =>
                      update("fuel_remaining", Number(e.target.value))
                    }
                    className={cn(inputClass, "pr-8")}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                    %
                  </span>
                </div>
              </div>
              <div>
                <label className={labelClass}>泊位选择</label>
                <select
                  value={form.berth_id}
                  onChange={(e) => update("berth_id", e.target.value)}
                  className={inputClass}
                >
                  <option value="">选择泊位</option>
                  {availableBerths.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}号泊位
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section className="bg-navy-light border border-navy-lighter rounded-xl p-5">
            <SectionTitle>船员选择</SectionTitle>
            {filteredCrew.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {filteredCrew.map((c) => (
                  <label
                    key={c.id}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors",
                      form.crew_ids.includes(c.id)
                        ? "bg-navy-lighter border-nautical"
                        : "bg-navy border-navy-lighter hover:border-navy-lighter/80"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={form.crew_ids.includes(c.id)}
                      onChange={() => toggleCrew(c.id)}
                      className="sr-only"
                    />
                    <div
                      className={cn(
                        "w-4 h-4 rounded border flex items-center justify-center",
                        form.crew_ids.includes(c.id)
                          ? "bg-nautical border-nautical"
                          : "border-gray-500"
                      )}
                    >
                      {form.crew_ids.includes(c.id) && (
                        <svg
                          className="w-2.5 h-2.5 text-white"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </div>
                    <div>
                      <span className="text-sm text-gray-200">{c.name}</span>
                      <span className="text-xs text-gray-500 ml-1.5">
                        {c.role}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                {form.ship_id
                  ? "该船舶暂无船员记录"
                  : "请先选择船舶以加载船员列表"}
              </p>
            )}
          </section>

          <div className="flex justify-end gap-3 pb-4">
            <button
              type="button"
              onClick={() => navigate("/plans")}
              className="px-5 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-navy-lighter transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors",
                submitting
                  ? "bg-nautical/50 text-nautical-light/50 cursor-not-allowed"
                  : "bg-nautical text-white hover:bg-nautical-light"
              )}
            >
              <Save className="w-4 h-4" />
              {submitting ? "提交中..." : "提交计划"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
