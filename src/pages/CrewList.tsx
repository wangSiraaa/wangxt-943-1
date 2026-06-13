import { useState, useEffect, useCallback } from "react";
import { Search, UserPlus, ShieldBan, ShieldCheck, X } from "lucide-react";
import { useDataStore } from "@/store/dataStore";
import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";

interface CrewRow {
  id: string;
  name: string;
  role: string;
  qualification_type: string;
  qualification_expire_date: string;
  is_blacklisted: number;
  ship_id: string | null;
  ship_name: string;
}

const roleLabels: Record<string, string> = {
  captain: "船长",
  chief_mate: "大副",
  second_mate: "二副",
  engineer: "轮机长",
  sailor: "水手",
  cook: "厨师",
};

function isExpired(dateStr: string): boolean {
  return new Date(dateStr) < new Date();
}

function isExpiringSoon(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  return diff > 0 && diff <= 30 * 24 * 60 * 60 * 1000;
}

function expireColor(dateStr: string) {
  if (isExpired(dateStr)) return "text-danger";
  if (isExpiringSoon(dateStr)) return "text-warning";
  return "text-gray-300";
}

export default function CrewList() {
  const { crew, ships, fetchCrew, fetchShips } = useDataStore();
  const { user } = useAuthStore();
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<CrewRow[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    name: "",
    role: "sailor",
    qualification_type: "",
    qualification_expire_date: "",
    ship_id: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const canBlacklist = user?.role === "admin" || user?.role === "supervisor";

  const loadCrew = useCallback(async () => {
    await Promise.all([fetchCrew(), fetchShips()]);
  }, [fetchCrew, fetchShips]);

  useEffect(() => {
    loadCrew();
  }, [loadCrew]);

  useEffect(() => {
    const getShipName = (shipId: string | null) => {
      if (!shipId) return "";
      return ships.find((s) => s.id === shipId)?.name ?? "";
    };
    const mapped: CrewRow[] = crew.map((c) => ({
      id: c.id,
      name: c.name,
      role: c.role,
      qualification_type: c.qualification_type,
      qualification_expire_date: c.qualification_expire_date,
      is_blacklisted: c.is_blacklisted,
      ship_id: c.ship_id,
      ship_name: getShipName(c.ship_id),
    }));
    setRows(mapped);
  }, [crew, ships]);

  const filtered = rows.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase())
  );

  const toggleBlacklist = async (id: string, current: number) => {
    try {
      const res = await fetch(`/api/crew/${id}/blacklist`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_blacklisted: current ? 0 : 1 }),
      });
      if (!res.ok) throw new Error();
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, is_blacklisted: current ? 0 : 1 } : r))
      );
    } catch {
      console.error("黑名单操作失败");
    }
  };

  const handleAdd = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/crew", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      setShowModal(false);
      setForm({ name: "", role: "sailor", qualification_type: "", qualification_expire_date: "", ship_id: "" });
      await loadCrew();
    } catch {
      console.error("添加船员失败");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-100">船员管理</h1>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-nautical hover:bg-nautical-light text-white text-sm rounded-lg transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          添加船员
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索船员姓名..."
          className="w-full max-w-xs pl-10 pr-4 py-2 bg-navy-light border border-navy-lighter rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-nautical"
        />
      </div>

      <div className="bg-navy-light border border-navy-lighter rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy-lighter text-gray-400 text-left">
                <th className="px-4 py-3 font-medium">姓名</th>
                <th className="px-4 py-3 font-medium">职务</th>
                <th className="px-4 py-3 font-medium">资质类型</th>
                <th className="px-4 py-3 font-medium">资质到期日</th>
                <th className="px-4 py-3 font-medium">黑名单</th>
                <th className="px-4 py-3 font-medium">所属船舶</th>
                <th className="px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-navy-lighter/50 hover:bg-navy-lighter/30 transition-colors"
                >
                  <td className="px-4 py-3 text-gray-200">{r.name}</td>
                  <td className="px-4 py-3 text-gray-300">
                    {roleLabels[r.role] || r.role}
                  </td>
                  <td className="px-4 py-3 text-gray-300">{r.qualification_type || "-"}</td>
                  <td className={cn("px-4 py-3", expireColor(r.qualification_expire_date))}>
                    {r.qualification_expire_date || "-"}
                  </td>
                  <td className="px-4 py-3">
                    {r.is_blacklisted ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-danger/20 text-danger-light">
                        已列入
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-port/20 text-port-light">
                        正常
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-300">{r.ship_name || "-"}</td>
                  <td className="px-4 py-3">
                    {canBlacklist && (
                      <button
                        onClick={() => toggleBlacklist(r.id, r.is_blacklisted)}
                        className={cn(
                          "flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg transition-colors",
                          r.is_blacklisted
                            ? "bg-port/20 text-port-light hover:bg-port/30"
                            : "bg-danger/20 text-danger-light hover:bg-danger/30"
                        )}
                      >
                        {r.is_blacklisted ? (
                          <>
                            <ShieldCheck className="w-3.5 h-3.5" /> 移出
                          </>
                        ) : (
                          <>
                            <ShieldBan className="w-3.5 h-3.5" /> 加入
                          </>
                        )}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                    暂无船员数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-navy-light border border-navy-lighter rounded-xl w-full max-w-md p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-100">添加船员</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">姓名</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-navy border border-navy-lighter rounded-lg text-sm text-gray-200 focus:outline-none focus:border-nautical"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">职务</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                  className="w-full px-3 py-2 bg-navy border border-navy-lighter rounded-lg text-sm text-gray-200 focus:outline-none focus:border-nautical"
                >
                  <option value="captain">船长</option>
                  <option value="chief_mate">大副</option>
                  <option value="second_mate">二副</option>
                  <option value="engineer">轮机长</option>
                  <option value="sailor">水手</option>
                  <option value="cook">厨师</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">资质类型</label>
                <input
                  value={form.qualification_type}
                  onChange={(e) => setForm((f) => ({ ...f, qualification_type: e.target.value }))}
                  className="w-full px-3 py-2 bg-navy border border-navy-lighter rounded-lg text-sm text-gray-200 focus:outline-none focus:border-nautical"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">资质到期日</label>
                <input
                  type="date"
                  value={form.qualification_expire_date}
                  onChange={(e) => setForm((f) => ({ ...f, qualification_expire_date: e.target.value }))}
                  className="w-full px-3 py-2 bg-navy border border-navy-lighter rounded-lg text-sm text-gray-200 focus:outline-none focus:border-nautical"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">所属船舶ID</label>
                <input
                  value={form.ship_id}
                  onChange={(e) => setForm((f) => ({ ...f, ship_id: e.target.value }))}
                  className="w-full px-3 py-2 bg-navy border border-navy-lighter rounded-lg text-sm text-gray-200 focus:outline-none focus:border-nautical"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleAdd}
                disabled={submitting || !form.name}
                className="px-4 py-2 bg-nautical hover:bg-nautical-light text-white text-sm rounded-lg transition-colors disabled:opacity-50"
              >
                {submitting ? "提交中..." : "确认添加"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
