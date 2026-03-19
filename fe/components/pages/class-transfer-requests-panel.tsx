"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  useClassesStore,
  type ClassTransferRequest,
} from "@/lib/stores/classes-store";

interface ClassTransferRequestsPanelProps {
  onAfterDecision?: () => Promise<void> | void;
}

export default function ClassTransferRequestsPanel({
  onAfterDecision,
}: ClassTransferRequestsPanelProps) {
  const {
    fetchClassTransferRequests,
    approveClassTransferRequest,
    rejectClassTransferRequest,
    isLoading,
  } = useClassesStore();

  const [requests, setRequests] = useState<ClassTransferRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "approved" | "rejected"
  >("pending");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredRequests = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return requests.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) {
        return false;
      }

      if (!q) return true;

      const studentName = item.metadata?.studentName?.toLowerCase() || "";
      const fromClass = item.metadata?.fromClassName?.toLowerCase() || "";
      const toClass = item.metadata?.toClassName?.toLowerCase() || "";

      return (
        studentName.includes(q) || fromClass.includes(q) || toClass.includes(q)
      );
    });
  }, [requests, searchQuery, statusFilter]);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchClassTransferRequests();
      setRequests(data);
    } catch (err: unknown) {
      setError(
        (err as Error).message || "Không tải được danh sách yêu cầu chuyển lớp",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApprove = async (requestId: string) => {
    if (!confirm("Duyệt yêu cầu chuyển lớp này?")) {
      return;
    }

    try {
      await approveClassTransferRequest(requestId);
      await reload();
      await onAfterDecision?.();
    } catch (err: unknown) {
      setError((err as Error).message || "Có lỗi khi duyệt yêu cầu");
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      await rejectClassTransferRequest(requestId, rejectReason || undefined);
      setRejectingId(null);
      setRejectReason("");
      await reload();
      await onAfterDecision?.();
    } catch (err: unknown) {
      setError((err as Error).message || "Có lỗi khi từ chối yêu cầu");
    }
  };

  return (
    <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-indigo-900">
            Duyệt yêu cầu chuyển lớp
          </p>
          <p className="text-xs text-indigo-700">
            Admin cần duyệt trước khi hệ thống chuyển học sinh sang lớp mới.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={reload}
          disabled={loading || isLoading}
          className="rounded-lg"
        >
          Làm mới
        </Button>
      </div>

      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(
              e.target.value as "all" | "pending" | "approved" | "rejected",
            )
          }
          className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm"
        >
          <option value="pending">Chờ duyệt</option>
          <option value="approved">Đã duyệt</option>
          <option value="rejected">Đã từ chối</option>
          <option value="all">Tất cả</option>
        </select>

        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm"
          placeholder="Tìm theo học sinh hoặc lớp"
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-600">Đang tải yêu cầu...</div>
      ) : filteredRequests.length === 0 ? (
        <div className="text-sm text-gray-600">
          Không có yêu cầu phù hợp với bộ lọc hiện tại.
        </div>
      ) : (
        <div className="space-y-2">
          {filteredRequests.map((request) => (
            <div
              key={request._id}
              className="rounded-xl border border-indigo-200 bg-white px-3 py-3"
            >
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="text-sm text-gray-800">
                  <p className="font-semibold">
                    {request.metadata?.studentName || "Học sinh"}
                  </p>
                  <p>
                    {request.metadata?.fromClassName || "Lớp nguồn"} →{" "}
                    {request.metadata?.toClassName || "Lớp đích"}
                  </p>
                  <p className="text-xs text-indigo-700 mt-1">
                    Trạng thái:{" "}
                    {request.status === "pending"
                      ? "Chờ duyệt"
                      : request.status === "approved"
                        ? "Đã duyệt"
                        : "Đã từ chối"}
                  </p>
                  {request.metadata?.reason && (
                    <p className="text-xs text-gray-500 mt-1">
                      Lý do: {request.metadata.reason}
                    </p>
                  )}
                  {request.metadata?.rejectReason && (
                    <p className="text-xs text-red-600 mt-1">
                      Lý do từ chối: {request.metadata.rejectReason}
                    </p>
                  )}
                </div>

                {request.status === "pending" && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleApprove(request._id)}
                      disabled={isLoading}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      Duyệt
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setRejectingId(request._id);
                        setRejectReason("");
                      }}
                      disabled={isLoading}
                      className="border-red-300 text-red-700 hover:bg-red-50"
                    >
                      Từ chối
                    </Button>
                  </div>
                )}
              </div>

              {request.metadata?.auditLogs &&
                request.metadata.auditLogs.length > 0 && (
                  <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-2">
                    <p className="text-xs font-semibold text-gray-700 mb-1">
                      Lịch sử xử lý
                    </p>
                    <div className="space-y-1">
                      {request.metadata.auditLogs.map((log, idx) => (
                        <p
                          key={`${request._id}-${idx}`}
                          className="text-xs text-gray-600"
                        >
                          • {new Date(log.at).toLocaleString("vi-VN")}:{" "}
                          {log.action}
                          {log.note ? ` - ${log.note}` : ""}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

              {request.status === "pending" && rejectingId === request._id && (
                <div className="mt-3 space-y-2">
                  <textarea
                    rows={2}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="Nhập lý do từ chối (tuỳ chọn)"
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setRejectingId(null);
                        setRejectReason("");
                      }}
                    >
                      Hủy
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleReject(request._id)}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Xác nhận từ chối
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
