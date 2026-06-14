import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Save, ArrowLeft, AlertTriangle } from "lucide-react";
import { useDataStore } from "@/store/dataStore";
import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";

const ROLE_CAPTAIN = "captain";

interface FormData {
  shipId: string;
  departureTime: string;
  expectedReturnTime: string;
  route: string;
  routeRiskLevel: "low" | "medium" | "high";
  dangerGoodsDeclared: number;
  dangerGoodsDetail: string;
  fuelRemaining: number;
  berthId: string;
  crewIds: string[];
}

const initialForm: FormData = {
  shipId: "",
  departureTime: "",
  expectedReturnTime: "",
  route: "",
  routeRiskLevel: "low",
  dangerGoodsDeclared: 0,
  dangerGoodsDetail: "",
  fuelRemaining: 80,
  berthId: "",
  crewIds: [],
};

const riskOptions: { value: FormData["routeRiskLevel"]; label: string; color: string }[] = [
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

  const filteredCrew = form.shipId
    ? crew.filter((c) => c.shipId === form.shipId)
    : crew;

  const availableBerths = berths.filter((b) => b.status === "available");

  const update = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === "shipId") {
      setForm((prev) => ({ ...prev, crewIds: [] }));
    }
  };

  const toggleCrew = (crewId: string) => {
    setForm((prev) => ({
      ...prev,
      crewIds: prev.crewIds.includes(crewId)
        ? prev.crewIds.filter((id) => id !== crewId)
        : [...prev.crewIds, crewId],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.shipId || !form.departureTime || !form.expectedReturnTime) {
      setError("请填写必填字段：船舶、计划出港时间、预计返港时间");
      return;
    }

    if (form.dangerGoodsDeclared && !form.dangerGoodsDetail) {
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
                  value={form.shipId}
                  onChange={(e) => update("shipId", e.target.value)}
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
                  value={form.departureTime}
                  onChange={(e) => update("departureTime", e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>
                  预计返港时间 <span className="text-danger">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={form.expectedReturnTime}
                  onChange={(e) => update("expectedReturnTime", e.target.value)}
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
                    form.routeRiskLevel === opt.value
                      ? "bg-navy-lighter border-nautical"
                      : "bg-navy border-navy-lighter hover:border-navy-lighter/80"
                  )}
                >
                  <input
                    type="radio"
                    name="riskLevel"
                    value={opt.value}
                    checked={form.routeRiskLevel === opt.value}
                    onChange={() => update("routeRiskLevel", opt.value)}
                    className="sr-only"
                  />
                  <span
                    className={cn(
                      "w-3 h-3 rounded-full border-2",
                      form.routeRiskLevel === opt.value
                        ? `${opt.color} border-current`
                        : "border-gray-500"
                    )}
                  />
                  <span
                    className={cn(
                      "text-sm",
                      form.routeRiskLevel === opt.value
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
                    form.dangerGoodsDeclared
                      ? "bg-warning border-warning"
                      : "border-gray-500"
                  )}
                >
                  {form.dangerGoodsDeclared > 0 && (
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
                  checked={!!form.dangerGoodsDeclared}
                  onChange={(e) =>
                    update("dangerGoodsDeclared", e.target.checked ? 1 : 0)
                  }
                  className="sr-only"
                />
                <span className="text-sm text-gray-300">
                  携带危险品出港
                </span>
              </label>
              {form.dangerGoodsDeclared > 0 && (
                <textarea
                  value={form.dangerGoodsDetail}
                  onChange={(e) =>
                    update("dangerGoodsDetail", e.target.value)
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
                    value={form.fuelRemaining}
                  onChange={(e) =>
                    update("fuelRemaining", Number(e.target.value))
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
                  value={form.berthId}
                  onChange={(e) => update("berthId", e.target.value)}
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
                      form.crewIds.includes(c.id)
                        ? "bg-navy-lighter border-nautical"
                        : "bg-navy border-navy-lighter hover:border-navy-lighter/80"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={form.crewIds.includes(c.id)}
                      onChange={() => toggleCrew(c.id)}
                      className="sr-only"
                    />
                    <div
                      className={cn(
                        "w-4 h-4 rounded border flex items-center justify-center",
                        form.crewIds.includes(c.id)
                          ? "bg-nautical border-nautical"
                          : "border-gray-500"
                      )}
                    >
                      {form.crewIds.includes(c.id) && (
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
                {form.shipId
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
