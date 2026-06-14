import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldAlert,
  AlertTriangle,
  Search,
  Filter,
  Plus,
  Clock,
  User,
  MapPin,
  AlertOctagon,
  Ban,
  Navigation2,
  X,
  Check,
} from "lucide-react";
import {
  EmergencyControl,
  useDataStore,
} from "@/store/dataStore";
import { useAuthStore } from "@/store/authStore";
import { cn } from "@/lib/utils";

const controlTypeLabels: Record<string, string> = {
  temporary_ban: "临时禁航",
  search_rescue: "搜救演练",
  area_avoidance: "海域避让",
};

const controlTypeIcons: Record<string, React.ElementType> = {
  temporary_ban: Ban,
  search_rescue: Navigation2,
  area_avoidance: MapPin,
};

const statusLabels: Record<string, string> = {
  active: "进行中",
  ended: "已结束",
  cancelled: "已取消",
};

const statusColors: Record<string, string> = {
  active: "bg-warning/20 text-warning border-warning/30",
  ended: "bg-success/20 text-success border-success/30",
  cancelled: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

const riskLevelColors: Record<string, string> = {
  critical: "bg-critical/20 text-critical border-critical/30",
  high: "bg-danger/20 text-danger border-danger/30",
  medium: "bg-warning/20 text-warning border-warning/30",
  low: "bg-success/20 text-success border-success/30",
};

const riskLevelLabels: Record<string, string> = {
  critical: "紧急",
  high: "高",
  medium: "中",
  low: "低",
};

export default function EmergencyControlPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    emergencyControls,
    fetchEmergencyControls,
    fetchActiveEmergencyControls,
    createEmergencyControl,
    endEmergencyControl,
    isLoading,
  } = useDataStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState({
    control_type: "temporary_ban" as "temporary_ban" | "search_rescue" | "area_avoidance",
    title: "",
    description: "",
    affected_area: "",
    start_time: "",
    end_time: "",
    risk_level: "medium" as "low" | "medium" | "high" | "critical",
  });

  useEffect(() => {
    fetchEmergencyControls();
    fetchActiveEmergencyControls();
  }, []);

  const canCreate = user?.role === "supervisor" || user?.role === "admin";

  const filteredControls = emergencyControls
    .filter((c) => filterStatus === "all" || c.status === filterStatus)
    .filter((c) =>
      searchQuery
        ? c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.affectedArea?.toLowerCase().includes(searchQuery.toLowerCase())
        : true
    )
    .sort((a, b) => {
      if (a.status === "active" && b.status !== "active") return -1;
      if (a.status !== "active" && b.status === "active") return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const activeControls = filteredControls.filter((c) => c.status === "active");
  const endedControls = filteredControls.filter((c) => c.status !== "active");

  const handleCreate = async () => {
    if (!formData.title || !formData.start_time || !formData.end_time) {
      alert("请填写完整信息");
      return;
    }

    const result = await createEmergencyControl({
      ...formData,
      created_by: user!.id,
    });

    if (result) {
      setShowCreateModal(false);
      setFormData({
        control_type: "temporary_ban",
        title: "",
        description: "",
        affected_area: "",
        start_time: "",
        end_time: "",
        risk_level: "medium",
      });
      fetchEmergencyControls();
      fetchActiveEmergencyControls();
    }
  };

  const handleEnd = async (id: string) => {
    if (confirm("确认结束该应急管控？")) {
      const success = await endEmergencyControl(id, "监管员手动结束");
      if (success) {
        fetchEmergencyControls();
        fetchActiveEmergencyControls();
      }
    }
  };

  const ControlCard = ({ control }: { control: EmergencyControl }) => {
    const TypeIcon = controlTypeIcons[control.controlType];
    return (
      <div
        className="bg-navy-light rounded-xl border border-navy-lighter p-5 cursor-pointer hover:border-nautical/50 transition-all group"
        onClick={() => navigate(`/emergency/${control.id}`)}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center",
                riskLevelColors[control.riskLevel]
              )}
            >
              <TypeIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-white group-hover:text-nautical transition-colors">
                {control.title}
              </h3>
              <p className="text-sm text-gray-400">
                {controlTypeLabels[control.controlType]}
              </p>
            </div>
          </div>
          <span
            className={cn(
              "px-2.5 py-1 text-xs font-medium rounded-full border",
              statusColors[control.status]
            )}
          >
            {statusLabels[control.status]}
          </span>
        </div>

        <p className="text-sm text-gray-400 mb-4 line-clamp-2">
          {control.description}
        </p>

        {control.affectedArea && (
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-3">
            <MapPin className="w-4 h-4 text-nautical-light" />
            <span>{control.affectedArea}</span>
          </div>
        )}

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4 text-gray-500">
            <div className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              <span>
                {new Date(control.startTime).toLocaleDateString("zh-CN")}
              </span>
            </div>
            {control.affectedPlansCount !== undefined && (
              <div className="flex items-center gap-1">
                <AlertOctagon className="w-4 h-4 text-warning" />
                <span>影响 {control.affectedPlansCount} 个计划</span>
              </div>
            )}
          </div>
          <span
            className={cn(
              "px-2 py-0.5 text-xs rounded border",
              riskLevelColors[control.riskLevel]
            )}
          >
            {riskLevelLabels[control.riskLevel]}
          </span>
        </div>

        {control.status === "active" && canCreate && (
          <div className="mt-4 pt-4 border-t border-navy-lighter">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleEnd(control.id);
              }}
              className="w-full py-2 text-sm text-danger hover:bg-danger/10 rounded-lg transition-colors"
            >
              结束管控
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">应急管控</h1>
          <p className="text-gray-400 mt-1">发布临时禁航、搜救演练或重点海域避让</p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-nautical hover:bg-nautical/80 text-white rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>发布管控</span>
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[280px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="搜索管控名称或影响区域..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-navy-light border border-navy-lighter rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-nautical"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-400" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2.5 bg-navy-light border border-navy-lighter rounded-lg text-white focus:outline-none focus:border-nautical"
          >
            <option value="all">全部状态</option>
            <option value="active">进行中</option>
            <option value="ended">已结束</option>
            <option value="cancelled">已取消</option>
          </select>
        </div>
      </div>

      {activeControls.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-warning" />
            <h2 className="text-lg font-semibold text-white">进行中的管控</h2>
            <span className="px-2 py-0.5 text-xs bg-warning/20 text-warning rounded-full">
              {activeControls.length}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeControls.map((control) => (
              <ControlCard key={control.id} control={control} />
            ))}
          </div>
        </div>
      )}

      {endedControls.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">历史管控</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {endedControls.map((control) => (
              <ControlCard key={control.id} control={control} />
            ))}
          </div>
        </div>
      )}

      {filteredControls.length === 0 && (
        <div className="text-center py-16">
          <ShieldAlert className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">暂无应急管控记录</p>
          {canCreate && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 text-nautical hover:text-nautical-light transition-colors"
            >
              发布第一条管控
            </button>
          )}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-navy rounded-2xl border border-navy-lighter w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-navy-lighter">
              <h2 className="text-xl font-semibold text-white">发布应急管控</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 hover:bg-navy-lighter rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  管控类型
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(controlTypeLabels) as Array<keyof typeof controlTypeLabels>).map(
                    (type) => {
                      const Icon = controlTypeIcons[type];
                      const isSelected = formData.control_type === type;
                      return (
                        <button
                          key={type}
                          onClick={() =>
                            setFormData({ ...formData, control_type: type as "temporary_ban" | "search_rescue" | "area_avoidance" })
                          }
                          className={cn(
                            "flex flex-col items-center gap-2 p-4 rounded-xl border transition-all",
                            isSelected
                              ? "border-nautical bg-nautical/20 text-white"
                              : "border-navy-lighter text-gray-400 hover:border-gray-600"
                          )}
                        >
                          <Icon className="w-6 h-6" />
                          <span className="text-sm">
                            {controlTypeLabels[type]}
                          </span>
                        </button>
                      );
                    }
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  管控标题 *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="输入管控标题"
                  className="w-full px-4 py-2.5 bg-navy-light border border-navy-lighter rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-nautical"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  详细说明
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="输入管控详细说明"
                  rows={3}
                  className="w-full px-4 py-2.5 bg-navy-light border border-navy-lighter rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-nautical resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  影响区域
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="text"
                    value={formData.affected_area}
                    onChange={(e) =>
                      setFormData({ ...formData, affected_area: e.target.value })
                    }
                    placeholder="如：北纬30°-32°，东经120°-123°"
                    className="w-full pl-10 pr-4 py-2.5 bg-navy-light border border-navy-lighter rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-nautical"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    开始时间 *
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.start_time}
                    onChange={(e) =>
                      setFormData({ ...formData, start_time: e.target.value })
                    }
                    className="w-full px-4 py-2.5 bg-navy-light border border-navy-lighter rounded-lg text-white focus:outline-none focus:border-nautical"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    结束时间 *
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.end_time}
                    onChange={(e) =>
                      setFormData({ ...formData, end_time: e.target.value })
                    }
                    className="w-full px-4 py-2.5 bg-navy-light border border-navy-lighter rounded-lg text-white focus:outline-none focus:border-nautical"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  风险等级
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(Object.keys(riskLevelLabels) as Array<keyof typeof riskLevelLabels>).map(
                    (level) => (
                      <button
                        key={level}
                        onClick={() =>
                          setFormData({ ...formData, risk_level: level as "low" | "medium" | "high" | "critical" })
                        }
                        className={cn(
                          "py-2 text-sm rounded-lg border transition-all",
                          formData.risk_level === level
                            ? riskLevelColors[level]
                            : "border-navy-lighter text-gray-400 hover:border-gray-600"
                        )}
                      >
                        {riskLevelLabels[level]}
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-3 p-6 border-t border-navy-lighter">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-2.5 text-gray-400 hover:bg-navy-lighter rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                className="flex-1 py-2.5 bg-nautical hover:bg-nautical/80 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                发布管控
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
