"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useIncidentsStore,
  INCIDENT_TYPE_LABELS,
  INCIDENT_STATUS_LABELS,
  INCIDENT_STATUS_COLORS,
  INCIDENT_PLATFORM_LABELS,
  type Incident,
  type IncidentStatus,
} from "@/lib/stores/incidents-store";
import { notificationService } from "@/lib/services/notificationService.service";

interface IncidentDetailModalProps {
  incident: Incident;
  onClose: () => void;
  onUpdate: () => void;
}

function IncidentDetailModal({
  incident,
  onClose,
  onUpdate,
}: IncidentDetailModalProps) {
  const { updateIncident, isLoading } = useIncidentsStore();
  const [status, setStatus] = useState<IncidentStatus>(incident.status);
  const [adminNote, setAdminNote] = useState(incident.adminNote || "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleUpdate = async () => {
    setError(null);
    setSuccess(null);

    if (status !== "pending" && !adminNote.trim()) {
      setError("Vui lòng nhập ghi chú phản hồi cho người báo cáo.");
      return;
    }

    try {
      await updateIncident(incident._id, { status, adminNote });

      if (status !== "pending") {
        const reporterId =
          typeof incident.reporterId === "object"
            ? incident.reporterId._id
            : incident.reporterId;

        if (reporterId) {
          let title = "[Phản hồi sự cố]";
          let type: "info" | "success" | "error" = "info";
          let body = "";

          switch (status) {
            case "resolved":
              title = "[Phản hồi sự cố] Đã giải quyết";
              body = `Phản hồi: ${adminNote}`;
              type = "success";
              break;
            case "rejected":
              title = "[Phản hồi sự cố] Từ chối";
              body = `Phản hồi: ${adminNote}`;
              type = "error";
              break;
            case "in_progress":
              title = "[Phản hồi sự cố] Đang xử lý";
              body = `Phản hồi: ${adminNote}`;
              type = "info";
              break;
          }

          await notificationService
            .send({
              userId: reporterId,
              title,
              body,
              type,
            })
            .catch((err) =>
              console.error("Lỗi gửi thông báo cho người báo cáo:", err),
            );
        }
      }

      setSuccess("Cập nhật và gửi thông báo thành công!");
      onUpdate();
      setTimeout(() => {
        setSuccess(null);
      }, 2000);
    } catch (err: unknown) {
      setError((err as Error).message || "Có lỗi xảy ra");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-linear-to-r from-orange-500 to-red-500 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white text-lg">
                🐛
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Chi tiết sự cố</h2>
                <p className="text-orange-100 text-sm">
                  ID: {incident._id.slice(-8)}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)] space-y-4">
          {/* Reporter Info */}
          <div className="bg-gray-50 rounded-xl p-4">
            <h4 className="font-medium text-gray-700 text-sm mb-2">
              Thông tin người báo cáo
            </h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-500">Họ tên:</span>{" "}
                <span className="font-medium">{incident.reporterName}</span>
              </div>
              <div>
                <span className="text-gray-500">Email:</span>{" "}
                <span className="font-medium">{incident.reporterEmail}</span>
              </div>
              {incident.reporterPhone && (
                <div>
                  <span className="text-gray-500">SĐT:</span>{" "}
                  <span className="font-medium">{incident.reporterPhone}</span>
                </div>
              )}
              <div>
                <span className="text-gray-500">Vai trò:</span>{" "}
                <span className="font-medium capitalize">
                  {incident.reporterRole === "student"
                    ? "Học sinh"
                    : incident.reporterRole === "teacher"
                      ? "Giáo viên"
                      : incident.reporterRole === "parent"
                        ? "Phụ huynh"
                        : incident.reporterRole}
                </span>
              </div>
            </div>
          </div>

          {/* Incident Info */}
          <div className="bg-blue-50 rounded-xl p-4">
            <h4 className="font-medium text-blue-700 text-sm mb-2">
              Thông tin sự cố
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Loại:</span>
                <span className="font-medium">
                  {INCIDENT_TYPE_LABELS[incident.type]}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Nền tảng:</span>
                <span className="font-medium">
                  {INCIDENT_PLATFORM_LABELS[incident.platform]}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">Ngày gửi:</span>
                <span className="font-medium">
                  {new Date(incident.createdAt).toLocaleString("vi-VN")}
                </span>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mô tả sự cố
            </label>
            <div className="p-3 bg-gray-100 rounded-xl text-sm text-gray-700 whitespace-pre-wrap">
              {incident.description}
            </div>
          </div>

          {/* Status Update */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Trạng thái
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as IncidentStatus)}
              className="nice-select w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="pending">Chờ xử lý</option>
              <option value="in_progress">Đang xử lý</option>
              <option value="resolved">Đã giải quyết</option>
              <option value="rejected">Từ chối</option>
            </select>
          </div>

          {/* Admin Note */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ghi chú Admin
            </label>
            <textarea
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="Ghi chú phản hồi cho người báo cáo..."
              rows={3}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
            />
          </div>

          {/* Resolved Info */}
          {incident.resolvedAt && incident.resolvedBy && (
            <div className="bg-green-50 rounded-xl p-3 text-sm">
              <span className="text-green-700">
                ✅ Đã giải quyết bởi{" "}
                {typeof incident.resolvedBy === "object"
                  ? incident.resolvedBy.name
                  : "Admin"}{" "}
                vào {new Date(incident.resolvedAt).toLocaleString("vi-VN")}
              </span>
            </div>
          )}

          {/* Messages */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
              ❌ {error}
            </div>
          )}
          {success && (
            <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm">
              ✅ {success}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex gap-3">
          <Button
            onClick={handleUpdate}
            disabled={isLoading}
            className="flex-1 bg-linear-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 rounded-xl"
          >
            {isLoading ? "Đang cập nhật..." : "💾 Lưu thay đổi"}
          </Button>
          <Button
            variant="outline"
            onClick={onClose}
            className="flex-1 rounded-xl"
          >
            Đóng
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function IncidentsManager() {
  const {
    incidents,
    statistics,
    fetchIncidents,
    fetchStatistics,
    deleteIncident,
    isLoading,
  } = useIncidentsStore();

  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(
    null,
  );
  const [filterStatus, setFilterStatus] = useState<IncidentStatus | "">("");
  const [filterType, setFilterType] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchIncidents();
    fetchStatistics();
  }, [fetchIncidents, fetchStatistics]);

  const handleRefresh = () => {
    fetchIncidents({
      status: filterStatus || undefined,
      type: filterType || undefined,
    });
    fetchStatistics();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bạn có chắc muốn xóa sự cố này?")) return;
    try {
      await deleteIncident(id);
      handleRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  // Filter incidents
  const filteredIncidents = incidents.filter((incident) => {
    if (filterStatus && incident.status !== filterStatus) return false;
    if (filterType && incident.type !== filterType) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        incident.reporterName.toLowerCase().includes(query) ||
        incident.reporterEmail.toLowerCase().includes(query) ||
        incident.description.toLowerCase().includes(query)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Statistics */}
      {statistics && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="p-4 bg-linear-to-br from-gray-50 to-gray-100">
            <p className="text-sm text-gray-500">Tổng cộng</p>
            <p className="text-2xl font-bold text-gray-900">
              {statistics.total}
            </p>
          </Card>
          <Card className="p-4 bg-linear-to-br from-yellow-50 to-yellow-100">
            <p className="text-sm text-yellow-600">Chờ xử lý</p>
            <p className="text-2xl font-bold text-yellow-700">
              {statistics.pending}
            </p>
          </Card>
          <Card className="p-4 bg-linear-to-br from-blue-50 to-blue-100">
            <p className="text-sm text-blue-600">Đang xử lý</p>
            <p className="text-2xl font-bold text-blue-700">
              {statistics.inProgress}
            </p>
          </Card>
          <Card className="p-4 bg-linear-to-br from-green-50 to-green-100">
            <p className="text-sm text-green-600">Đã giải quyết</p>
            <p className="text-2xl font-bold text-green-700">
              {statistics.resolved}
            </p>
          </Card>
          <Card className="p-4 bg-linear-to-br from-red-50 to-red-100">
            <p className="text-sm text-red-600">Từ chối</p>
            <p className="text-2xl font-bold text-red-700">
              {statistics.rejected}
            </p>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Tìm kiếm theo tên, email, mô tả..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as IncidentStatus)}
            className="nice-select rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-45"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="pending">Chờ xử lý</option>
            <option value="in_progress">Đang xử lý</option>
            <option value="resolved">Đã giải quyết</option>
            <option value="rejected">Từ chối</option>
          </select>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="nice-select rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-45"
          >
            <option value="">Tất cả loại</option>
            {Object.entries(INCIDENT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <Button
            onClick={handleRefresh}
            className="rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-200"
          >
            🔄 Làm mới
          </Button>
        </div>
      </Card>

      {/* Incidents List */}
      <Card className="p-4">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          🐛 Danh sách sự cố ({filteredIncidents.length})
        </h3>

        {isLoading ? (
          <div className="text-center py-8 text-gray-500">
            <span className="animate-spin inline-block mr-2">⏳</span>
            Đang tải...
          </div>
        ) : filteredIncidents.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <span className="text-4xl block mb-2">✅</span>
            <p>Không có sự cố nào</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredIncidents.map((incident) => (
              <div
                key={incident._id}
                className="border border-gray-200 rounded-xl p-4 hover:border-orange-200 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${INCIDENT_STATUS_COLORS[incident.status]
                          }`}
                      >
                        {INCIDENT_STATUS_LABELS[incident.status]}
                      </span>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                        {INCIDENT_TYPE_LABELS[incident.type]}
                      </span>
                      <span className="text-xs text-gray-400">
                        {INCIDENT_PLATFORM_LABELS[incident.platform]}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 line-clamp-2 mb-2">
                      {incident.description}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>👤 {incident.reporterName}</span>
                      <span>📧 {incident.reporterEmail}</span>
                      <span>
                        🕐{" "}
                        {new Date(incident.createdAt).toLocaleDateString(
                          "vi-VN",
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-lg"
                      onClick={() => setSelectedIncident(incident)}
                    >
                      👁️ Xem
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-lg text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => handleDelete(incident._id)}
                    >
                      🗑️
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Detail Modal */}
      {selectedIncident && (
        <IncidentDetailModal
          incident={selectedIncident}
          onClose={() => setSelectedIncident(null)}
          onUpdate={handleRefresh}
        />
      )}
    </div>
  );
}
