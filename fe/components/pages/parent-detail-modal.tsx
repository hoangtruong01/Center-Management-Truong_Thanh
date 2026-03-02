"use client";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useUsersStore } from "@/lib/stores/users-store";
import type { User } from "@/lib/stores/auth-store";

interface ParentDetailModalProps {
  parent: User;
  isOpen: boolean;
  onClose: () => void;
}

export default function ParentDetailModal({
  parent,
  isOpen,
  onClose,
}: ParentDetailModalProps) {
  const { fetchParentChildren } = useUsersStore();
  const [children, setChildren] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadChildren = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      console.log("Fetching children for parent:", parent._id, parent);
      const childrenData = await fetchParentChildren(parent._id!);
      console.log("Children data received:", childrenData);
      setChildren(childrenData);
    } catch (err: unknown) {
      console.error("Error loading children:", err);
      setError((err as Error).message || "Lỗi khi tải thông tin con");
    } finally {
      setLoading(false);
    }
  }, [parent, fetchParentChildren]);

  useEffect(() => {
    if (isOpen && parent._id) {
      loadChildren();
    }
  }, [isOpen, parent._id, loadChildren]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-linear-to-r from-purple-600 to-indigo-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center text-3xl">
                👨‍👩‍👧‍👦
              </div>
              <div>
                <h2 className="text-xl font-bold">{parent.name}</h2>
                <p className="text-purple-200 text-sm">{parent.email}</p>
                {parent.phone && (
                  <p className="text-purple-200 text-sm">📞 {parent.phone}</p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/70 hover:text-white text-2xl transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Parent Info */}
          <Card className="p-4 mb-6 bg-gray-50">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span>📋</span> Thông tin phụ huynh
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Mã phụ huynh</p>
                <p className="font-medium text-gray-900">
                  {(parent as unknown as Record<string, string>).parentCode ||
                    "Chưa có"}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Trạng thái</p>
                <Badge
                  variant={parent.status === "active" ? "success" : "warning"}
                >
                  {parent.status === "active" ? "Hoạt động" : parent.status}
                </Badge>
              </div>
              <div>
                <p className="text-gray-500">Email con</p>
                <p className="font-medium text-gray-900">
                  {(parent as unknown as Record<string, string>).childEmail ||
                    "Chưa liên kết"}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Ngày tạo</p>
                <p className="font-medium text-gray-900">
                  {parent.createdAt
                    ? new Date(parent.createdAt).toLocaleDateString("vi-VN")
                    : "N/A"}
                </p>
              </div>
            </div>

            {/* Children Summary */}
            {!loading && children.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-gray-500 text-sm mb-2">
                  Tên con ({children.length}{" "}
                  {children.length > 1 ? "người" : "người"})
                </p>
                <div className="flex flex-wrap gap-2">
                  {children.map((child, index) => (
                    <Badge
                      key={child._id}
                      variant="info"
                      className="text-sm py-1 px-3"
                    >
                      {index + 1}. {child.name}
                      {(child as unknown as Record<string, string>)
                        .studentCode && (
                        <span className="ml-1 text-xs opacity-75">
                          (
                          {
                            (child as unknown as Record<string, string>)
                              .studentCode
                          }
                          )
                        </span>
                      )}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Children Info */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span>👧</span> Thông tin con
              <Badge variant="info">{children.length} con</Badge>
            </h3>

            {loading ? (
              <div className="text-center py-8 text-gray-500">
                <span className="animate-spin inline-block mr-2">⏳</span>
                Đang tải thông tin...
              </div>
            ) : error ? (
              <Card className="p-6 text-center bg-red-50 border-red-200">
                <span className="text-4xl mb-2 block">❌</span>
                <p className="text-red-700 font-medium">Lỗi khi tải dữ liệu</p>
                <p className="text-red-600 text-sm mt-1">{error}</p>
                <Button
                  variant="outline"
                  className="mt-3"
                  onClick={loadChildren}
                >
                  Thử lại
                </Button>
              </Card>
            ) : children.length === 0 ? (
              <Card className="p-6 text-center bg-amber-50 border-amber-200">
                <span className="text-4xl mb-2 block">🔗</span>
                <p className="text-amber-700 font-medium">
                  Chưa tìm thấy học sinh liên kết
                </p>
                <p className="text-amber-600 text-sm mt-1">
                  Hệ thống tìm kiếm theo các tiêu chí:
                </p>
                <ul className="text-amber-600 text-xs mt-2 text-left max-w-md mx-auto space-y-1">
                  <li>• Email con (childEmail) của phụ huynh</li>
                  <li>• SĐT phụ huynh trùng với SĐT phụ huynh của học sinh</li>
                  <li>• Tên phụ huynh trùng với tên phụ huynh của học sinh</li>
                  <li>• Mã phụ huynh (PH) trùng với mã học sinh (HS)</li>
                </ul>
                <p className="text-amber-500 text-xs mt-3 italic">
                  Để liên kết, hãy cập nhật email con cho phụ huynh hoặc thêm
                  thông tin phụ huynh cho học sinh
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {children.map((child) => (
                  <Card
                    key={child._id}
                    className="p-4 hover:shadow-md transition-shadow border-l-4 border-l-blue-500"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-linear-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-white text-xl">
                          {child.name?.charAt(0) || "👧"}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">
                            {child.name}
                          </p>
                          <p className="text-sm text-gray-600">{child.email}</p>
                          {child.phone && (
                            <p className="text-sm text-gray-500">
                              📞 {child.phone}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge
                          variant={
                            child.status === "active" ? "success" : "warning"
                          }
                        >
                          {child.status === "active"
                            ? "Đang học"
                            : child.status}
                        </Badge>
                        {(child as unknown as Record<string, string>)
                          .studentCode && (
                          <p className="text-xs text-gray-500 mt-1">
                            {
                              (child as unknown as Record<string, string>)
                                .studentCode
                            }
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Ngày sinh</p>
                        <p className="font-medium text-gray-900">
                          {child.dateOfBirth
                            ? new Date(child.dateOfBirth).toLocaleDateString(
                                "vi-VN",
                              )
                            : "Chưa có"}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Giới tính</p>
                        <p className="font-medium text-gray-900">
                          {(child as unknown as Record<string, string>)
                            .gender === "male"
                            ? "Nam"
                            : (child as unknown as Record<string, string>)
                                  .gender === "female"
                              ? "Nữ"
                              : "Chưa có"}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Chi nhánh</p>
                        <p className="font-medium text-gray-900">
                          {(child as unknown as Record<string, string>)
                            .branchId || "Chưa phân"}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Đóng
          </Button>
        </div>
      </div>
    </div>
  );
}
