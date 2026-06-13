import { useState, useEffect, useCallback } from "react";
import { Anchor, Settings } from "lucide-react";
import { useDataStore } from "@/store/dataStore";
import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";

type BerthStatus = "available" | "occupied" | "reserved" | "maintenance";

interface BerthCard {
  id: string;
  name: string;
  status: BerthStatus;
  capacity: number;
  occupied: number;
}

const statusLabels: Record<BerthStatus, string> = {
  available: "空闲",
  occupied: "占用",
  reserved: "预留",
  maintenance: "维护",
};

const statusBorder: Record<BerthStatus, string> = {
  available: "border-port",
  occupied: "border-nautical",
  reserved: "border-warning",
  maintenance: "border-gray-600",
};

const statusBg: Record<BerthStatus, string> = {
  available: "bg-port/10",
  occupied: "bg-nautical/10",
  reserved: "bg-warning/10",
  maintenance: "bg-gray-600/10",
};

const statusDot: Record<BerthStatus, string> = {
  available: "bg-port",
  occupied: "bg-nautical-light",
  reserved: "bg-warning",
  maintenance: "bg-gray-500",
};

const statusOptions: BerthStatus[] = ["available", "occupied", "reserved", "maintenance"];

export default function BerthList() {
  const { berths, fetchBerths } = useDataStore();
  const { user } = useAuthStore();
  const [berthData, setBerthData] = useState<BerthCard[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<BerthStatus>("available");

  const canEdit = user?.role === "admin" || user?.role === "duty_officer";

  const load = useCallback(async () => {
    await fetchBerths();
  }, [fetchBerths]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const mapped: BerthCard[] = berths.map((b) => ({
      id: b.id,
      name: b.name,
      status: (b.status === "available" || b.status === "occupied" || b.status === "reserved" || b.status === "maintenance")
        ? (b.status as BerthStatus)
        : "available" as BerthStatus,
      capacity: b.capacity,
      occupied: b.occupied,
    }));
    if (mapped.length === 0) {
      setBerthData(
        Array.from({ length: 8 }, (_, i) => ({
          id: `B-${i + 1}`,
          name: `${i + 1}号泊位`,
          status: statusOptions[i % 4],
          capacity: i < 4 ? 10 : 5,
          occupied: i % 4 === 1 ? (i < 4 ? 7 : 3) : 0,
        }))
      );
    } else {
      setBerthData(mapped);
    }
  }, [berths]);

  const handleSave = async () => {
    if (!editId) return;
    try {
      const res = await fetch(`/api/berths/${editId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: editStatus }),
      });
      if (!res.ok) throw new Error();
      setBerthData((prev) =>
        prev.map((b) => (b.id === editId ? { ...b, status: editStatus } : b))
      );
      setEditId(null);
    } catch {
      console.error("更新泊位状态失败");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-100">泊位管理</h1>
        <div className="flex items-center gap-4 text-xs text-gray-400">
          {statusOptions.map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className={cn("w-2.5 h-2.5 rounded-full", statusDot[s])} />
              {statusLabels[s]}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {berthData.map((b) => {
          const pct = b.capacity > 0 ? Math.round((b.occupied / b.capacity) * 100) : 0;
          return (
            <div
              key={b.id}
              className={cn(
                "relative rounded-xl border-2 p-5 transition-colors",
                statusBorder[b.status],
                statusBg[b.status]
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Anchor className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-semibold text-gray-200">{b.name}</span>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                    b.status === "available"
                      ? "bg-port/20 text-port-light"
                      : b.status === "occupied"
                      ? "bg-nautical/20 text-nautical-light"
                      : b.status === "reserved"
                      ? "bg-warning/20 text-warning-light"
                      : "bg-gray-600/30 text-gray-400"
                  )}
                >
                  <span className={cn("w-1.5 h-1.5 rounded-full", statusDot[b.status])} />
                  {statusLabels[b.status]}
                </span>
              </div>

              <div className="mb-1 flex items-center justify-between text-xs text-gray-400">
                <span>容量</span>
                <span>
                  {b.occupied}/{b.capacity}
                </span>
              </div>
              <div className="h-2 bg-navy rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    pct > 80 ? "bg-danger" : pct > 50 ? "bg-warning" : "bg-port"
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>

              {b.occupied > 0 && (
                <p className="mt-2 text-xs text-gray-400">
                  占用：<span className="text-gray-300">{b.occupied}/{b.capacity}</span>
                </p>
              )}

              {canEdit && editId !== b.id && (
                <button
                  onClick={() => {
                    setEditId(b.id);
                    setEditStatus(b.status);
                  }}
                  className="absolute top-3 right-3 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  <Settings className="w-4 h-4" />
                </button>
              )}

              {editId === b.id && (
                <div className="mt-3 pt-3 border-t border-navy-lighter space-y-2">
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as BerthStatus)}
                    className="w-full px-2 py-1.5 bg-navy border border-navy-lighter rounded-lg text-xs text-gray-200 focus:outline-none focus:border-nautical"
                  >
                    {statusOptions.map((s) => (
                      <option key={s} value={s}>
                        {statusLabels[s]}
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSave}
                      className="flex-1 px-2 py-1 bg-nautical hover:bg-nautical-light text-white text-xs rounded-lg transition-colors"
                    >
                      保存
                    </button>
                    <button
                      onClick={() => setEditId(null)}
                      className="flex-1 px-2 py-1 bg-navy-lighter hover:bg-navy-light text-gray-300 text-xs rounded-lg transition-colors"
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
