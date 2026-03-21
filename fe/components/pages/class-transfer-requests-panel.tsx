"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  useClassesStore,
  type ClassTransferRequest,
} from "@/lib/stores/classes-store";

interface ClassTransferRequestsPanelProps {
  onAfterDecision?: () => Promise<void> | void;
  onRequestsLoaded?: (requests: ClassTransferRequest[]) => void;
}

export default function ClassTransferRequestsPanel({
  onAfterDecision,
  onRequestsLoaded,
}: ClassTransferRequestsPanelProps) {
  const {
    fetchClassTransferRequests,
    approveClassTransferRequest,
    rejectClassTransferRequest,
    bulkApproveClassTransferRequests,
    bulkRejectClassTransferRequests,
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
  const [pageSize, setPageSize] = useState<10 | 20 | 50>(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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

  const prioritizedRequests = useMemo(() => {
    const SLA_HOURS = 24;
    return [...filteredRequests].sort((a, b) => {
      const aPending = a.status === "pending";
      const bPending = b.status === "pending";

      if (aPending !== bPending) {
        return aPending ? -1 : 1;
      }

      if (aPending && bPending) {
        const aCreated = new Date(
          a.createdAt || a.metadata?.requestedAt || 0,
        ).getTime();
        const bCreated = new Date(
          b.createdAt || b.metadata?.requestedAt || 0,
        ).getTime();
        const aDeadline = aCreated + SLA_HOURS * 60 * 60 * 1000;
        const bDeadline = bCreated + SLA_HOURS * 60 * 60 * 1000;
        const aOverdue = Date.now() > aDeadline;
        const bOverdue = Date.now() > bDeadline;

        if (aOverdue !== bOverdue) {
          return aOverdue ? -1 : 1;
        }

        return aCreated - bCreated;
      }

      const aUpdated = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const bUpdated = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return bUpdated - aUpdated;
    });
  }, [filteredRequests]);

  const paginated = useMemo(() => {
    const totalPages = Math.max(
      1,
      Math.ceil(prioritizedRequests.length / pageSize),
    );
    const safePage = Math.min(currentPage, totalPages);
    const start = (safePage - 1) * pageSize;
    const items = prioritizedRequests.slice(start, start + pageSize);

    return {
      items,
      totalPages,
      page: safePage,
      total: prioritizedRequests.length,
      start: prioritizedRequests.length === 0 ? 0 : start + 1,
      end: Math.min(start + pageSize, prioritizedRequests.length),
    };
  }, [prioritizedRequests, currentPage, pageSize]);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchClassTransferRequests();
      setRequests(data);
      onRequestsLoaded?.(data);
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

  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds([]);
  }, [statusFilter, searchQuery, pageSize]);

  useEffect(() => {
    if (currentPage > paginated.totalPages) {
      setCurrentPage(paginated.totalPages);
    }
  }, [currentPage, paginated.totalPages]);

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

  const pendingIdsOnPage = useMemo(
    () =>
      paginated.items.filter((r) => r.status === "pending").map((r) => r._id),
    [paginated.items],
  );

  const allPendingOnPageSelected =
    pendingIdsOnPage.length > 0 &&
    pendingIdsOnPage.every((id) => selectedIds.includes(id));

  const toggleSelectAllPendingOnPage = () => {
    if (allPendingOnPageSelected) {
      setSelectedIds((prev) =>
        prev.filter((id) => !pendingIdsOnPage.includes(id)),
      );
      return;
    }

    setSelectedIds((prev) =>
      Array.from(new Set([...prev, ...pendingIdsOnPage])),
    );
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Duyệt ${selectedIds.length} yêu cầu đã chọn?`)) return;

    try {
      const result = await bulkApproveClassTransferRequests(selectedIds);
      if (result.failed > 0) {
        setError(
          `Có ${result.failed}/${result.total} yêu cầu duyệt thất bại. Vui lòng kiểm tra lại.`,
        );
      }
      setSelectedIds([]);
      await reload();
      await onAfterDecision?.();
    } catch (err: unknown) {
      setError((err as Error).message || "Có lỗi khi duyệt hàng loạt");
    }
  };

  const handleBulkReject = async () => {
    if (selectedIds.length === 0) return;
    const reason =
      prompt("Nhập lý do từ chối cho các yêu cầu đã chọn (tuỳ chọn):") ||
      undefined;
    if (!confirm(`Từ chối ${selectedIds.length} yêu cầu đã chọn?`)) return;

    try {
      const result = await bulkRejectClassTransferRequests(selectedIds, reason);
      if (result.failed > 0) {
        setError(
          `Có ${result.failed}/${result.total} yêu cầu từ chối thất bại. Vui lòng kiểm tra lại.`,
        );
      }
      setSelectedIds([]);
      await reload();
      await onAfterDecision?.();
    } catch (err: unknown) {
      setError((err as Error).message || "Có lỗi khi từ chối hàng loạt");
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

        <select
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value) as 10 | 20 | 50)}
          className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm"
        >
          <option value={10}>10 / trang</option>
          <option value={20}>20 / trang</option>
          <option value={50}>50 / trang</option>
        </select>
      </div>

      <div className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-xs text-indigo-800">
        Tổng yêu cầu phù hợp: <strong>{paginated.total}</strong>
        {paginated.total > 0 && (
          <span>
            {" "}
            • Đang hiển thị <strong>{paginated.start}</strong>-
            <strong>{paginated.end}</strong>
          </span>
        )}
        {paginated.total > 80 && (
          <span className="ml-2 text-amber-700">
            ⚠️ Số lượng lớn, nên giữ bộ lọc “Chờ duyệt” và xử lý theo trang.
          </span>
        )}
      </div>

      {pendingIdsOnPage.length > 0 && (
        <div className="rounded-lg border border-indigo-200 bg-white px-3 py-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <label className="text-xs text-gray-700 flex items-center gap-2">
            <input
              type="checkbox"
              checked={allPendingOnPageSelected}
              onChange={toggleSelectAllPendingOnPage}
            />
            Chọn tất cả yêu cầu chờ duyệt trong trang ({pendingIdsOnPage.length}
            )
          </label>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleBulkApprove}
              disabled={selectedIds.length === 0 || isLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              Duyệt đã chọn ({selectedIds.length})
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleBulkReject}
              disabled={selectedIds.length === 0 || isLoading}
              className="border-red-300 text-red-700 hover:bg-red-50"
            >
              Từ chối đã chọn
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-600">Đang tải yêu cầu...</div>
      ) : prioritizedRequests.length === 0 ? (
        <div className="text-sm text-gray-600">
          Không có yêu cầu phù hợp với bộ lọc hiện tại.
        </div>
      ) : (
        <div className="space-y-2">
          {paginated.items.map((request) => (
            <div
              key={request._id}
              className="rounded-xl border border-indigo-200 bg-white px-3 py-3"
            >
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="text-sm text-gray-800">
                  {request.status === "pending" && (
                    <label className="inline-flex items-center gap-2 text-xs text-gray-600 mb-1">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(request._id)}
                        onChange={() => toggleSelectOne(request._id)}
                      />
                      Chọn xử lý hàng loạt
                    </label>
                  )}
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
                  {request.status === "pending" && (
                    <p className="text-xs mt-1 text-amber-700">
                      Ưu tiên: xếp theo SLA 24h và yêu cầu cũ nhất lên đầu.
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

          {paginated.totalPages > 1 && (
            <div className="flex items-center justify-between rounded-lg border border-indigo-200 bg-white px-3 py-2">
              <p className="text-xs text-gray-600">
                Trang <strong>{paginated.page}</strong> /{" "}
                <strong>{paginated.totalPages}</strong>
              </p>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={paginated.page <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                >
                  Trước
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={paginated.page >= paginated.totalPages}
                  onClick={() =>
                    setCurrentPage((p) => Math.min(paginated.totalPages, p + 1))
                  }
                >
                  Sau
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
