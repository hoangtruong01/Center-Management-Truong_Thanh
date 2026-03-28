"use client";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Class } from "@/lib/stores/classes-store";
import { getSubjectColor } from "@/lib/constants/subjects";

interface ClassDetailModalProps {
  classData: Class;
  canDeleteOccurrence?: boolean;
  selectedOccurrenceDate?: string;
  selectedOccurrenceTimeRange?: string;
  onDeleteOccurrence?: (reason: string) => Promise<void>;
  onClose: () => void;
}

const DAYS_OF_WEEK_NAMES = [
  "Chủ nhật",
  "Thứ 2",
  "Thứ 3",
  "Thứ 4",
  "Thứ 5",
  "Thứ 6",
  "Thứ 7",
];

const STATUS_CONFIG = {
  active: {
    label: "Đang học",
    color: "bg-green-100 text-green-800 border-green-200",
    icon: "✅",
  },
  inactive: {
    label: "Tạm ngưng",
    color: "bg-yellow-100 text-yellow-800 border-yellow-200",
    icon: "⏸️",
  },
  completed: {
    label: "Đã hoàn thành",
    color: "bg-blue-100 text-blue-800 border-blue-200",
    icon: "🎓",
  },
};

export default function ClassDetailModal({
  classData,
  canDeleteOccurrence = false,
  selectedOccurrenceDate,
  selectedOccurrenceTimeRange,
  onDeleteOccurrence,
  onClose,
}: ClassDetailModalProps) {
  const [showDeleteOccurrenceForm, setShowDeleteOccurrenceForm] =
    useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [isDeletingOccurrence, setIsDeletingOccurrence] = useState(false);

  // Get teacher name
  const teacherName = useMemo(() => {
    if (classData.teacher?.name) return classData.teacher.name;
    if (typeof classData.teacherId === "object" && classData.teacherId?.name) {
      return classData.teacherId.name;
    }
    return "Chưa phân công";
  }, [classData]);

  // Get branch name
  const branchName = useMemo(() => {
    if (classData.branch?.name) return classData.branch.name;
    if (typeof classData.branchId === "object" && classData.branchId?.name) {
      return classData.branchId.name;
    }
    return "Chưa xác định";
  }, [classData]);

  // Get status config
  const statusConfig = STATUS_CONFIG[classData.status] || STATUS_CONFIG.active;

  // Get subject color
  const subjectColorClass = classData.subject
    ? getSubjectColor(classData.subject)
    : "bg-gray-100 text-gray-800";

  const handleCancelDeleteOccurrence = () => {
    setShowDeleteOccurrenceForm(false);
    setDeleteReason("");
  };

  const handleConfirmDeleteOccurrence = async () => {
    if (!onDeleteOccurrence) return;
    if (!deleteReason.trim()) return;

    setIsDeletingOccurrence(true);
    try {
      await onDeleteOccurrence(deleteReason.trim());
      setShowDeleteOccurrenceForm(false);
      setDeleteReason("");
    } finally {
      setIsDeletingOccurrence(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl p-0 bg-white shadow-2xl border-0 max-h-[90vh] overflow-hidden">
        {/* Header with gradient */}
        <div className="bg-linear-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-xl font-bold mb-1">{classData.name}</h3>
              {classData.subject && (
                <span
                  className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${subjectColorClass}`}
                >
                  📖 {classData.subject}
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Status Badge */}
          <div className="mb-6">
            <span
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium border ${statusConfig.color}`}
            >
              {statusConfig.icon} {statusConfig.label}
            </span>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Teacher */}
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="text-xs text-gray-500 mb-1">👨‍🏫 Giáo viên</div>
              <div className="font-semibold text-gray-900">{teacherName}</div>
            </div>

            {/* Branch */}
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="text-xs text-gray-500 mb-1">🏫 Cơ sở</div>
              <div className="font-semibold text-gray-900">{branchName}</div>
            </div>

            {/* Grade */}
            {classData.grade && (
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="text-xs text-gray-500 mb-1">🎓 Khối lớp</div>
                <div className="font-semibold text-gray-900">
                  {classData.grade}
                </div>
              </div>
            )}

            {/* Students */}
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="text-xs text-gray-500 mb-1">👥 Sĩ số</div>
              <div className="font-semibold text-gray-900">
                {classData.studentIds?.length || 0} /{" "}
                {classData.maxStudents || 30} học sinh
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{
                    width: `${Math.min(
                      ((classData.studentIds?.length || 0) /
                        (classData.maxStudents || 30)) *
                        100,
                      100,
                    )}%`,
                  }}
                ></div>
              </div>
            </div>
          </div>

          {/* Schedule Section */}
          {classData.schedule && classData.schedule.length > 0 && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                📅 Lịch học cố định
              </h4>
              <div className="space-y-2">
                {classData.schedule.map((sch, index) => (
                  <div
                    key={index}
                    className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center text-sm font-bold">
                        {DAYS_OF_WEEK_NAMES[sch.dayOfWeek].charAt(0)}
                        {sch.dayOfWeek === 0 ? "N" : sch.dayOfWeek}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">
                          {DAYS_OF_WEEK_NAMES[sch.dayOfWeek]}
                        </div>
                        <div className="text-sm text-gray-600">
                          🕐 {sch.startTime} - {sch.endTime}
                          {sch.room && (
                            <span className="ml-2">📍 {sch.room}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {canDeleteOccurrence &&
            selectedOccurrenceDate &&
            onDeleteOccurrence && (
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  🗑️ Xóa buổi học trong ngày
                </h4>
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <p className="text-sm text-red-800">
                    Ngày:{" "}
                    {new Date(selectedOccurrenceDate).toLocaleDateString(
                      "vi-VN",
                    )}
                    {selectedOccurrenceTimeRange
                      ? ` - ${selectedOccurrenceTimeRange}`
                      : ""}
                  </p>
                  <p className="mt-1 text-xs text-red-700">
                    Thao tác này chỉ xóa buổi của ngày đã chọn trên thời khóa
                    biểu, không ảnh hưởng lịch cố định cả tuần.
                  </p>

                  {!showDeleteOccurrenceForm ? (
                    <Button
                      size="sm"
                      className="mt-3 bg-red-600 hover:bg-red-700 text-white"
                      onClick={() => setShowDeleteOccurrenceForm(true)}
                    >
                      Xóa buổi ngày này
                    </Button>
                  ) : (
                    <div className="mt-3">
                      <label className="block text-xs font-medium text-red-700 mb-1">
                        Lý do xóa buổi học{" "}
                        <span className="text-red-600">*</span>
                      </label>
                      <textarea
                        value={deleteReason}
                        onChange={(e) => setDeleteReason(e.target.value)}
                        className="w-full rounded-md border border-red-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                        rows={2}
                        placeholder="Nhập lý do xóa buổi học trong ngày..."
                      />
                      <div className="mt-2 flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCancelDeleteOccurrence}
                          disabled={isDeletingOccurrence}
                        >
                          Hủy
                        </Button>
                        <Button
                          size="sm"
                          className="bg-red-600 hover:bg-red-700 text-white"
                          onClick={handleConfirmDeleteOccurrence}
                          disabled={
                            isDeletingOccurrence || !deleteReason.trim()
                          }
                        >
                          {isDeletingOccurrence
                            ? "Đang xóa..."
                            : "Xác nhận xóa"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

          {/* Description */}
          {classData.description && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                📝 Mô tả
              </h4>
              <p className="text-gray-600 text-sm bg-gray-50 rounded-lg p-4">
                {classData.description}
              </p>
            </div>
          )}

          {/* Date Range */}
          {(classData.startDate || classData.endDate) && (
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                📆 Thời gian học
              </h4>
              <div className="flex items-center gap-3 text-sm text-gray-600">
                {classData.startDate && (
                  <span className="bg-green-50 text-green-700 px-3 py-1 rounded-lg">
                    Bắt đầu:{" "}
                    {new Date(classData.startDate).toLocaleDateString("vi-VN")}
                  </span>
                )}
                {classData.endDate && (
                  <span className="bg-red-50 text-red-700 px-3 py-1 rounded-lg">
                    Kết thúc:{" "}
                    {new Date(classData.endDate).toLocaleDateString("vi-VN")}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Students List Preview */}
          {classData.students && classData.students.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                👥 Danh sách học sinh ({classData.students.length})
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-[200px] overflow-y-auto">
                {classData.students.slice(0, 9).map((student) => (
                  <div
                    key={student._id}
                    className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2"
                  >
                    <div className="w-8 h-8 rounded-full bg-linear-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-xs font-bold">
                      {student.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm text-gray-700 truncate flex-1">
                      {student.name}
                    </span>
                  </div>
                ))}
                {classData.students.length > 9 && (
                  <div className="flex items-center justify-center bg-gray-100 rounded-lg px-3 py-2 text-sm text-gray-500">
                    +{classData.students.length - 9} học sinh khác
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 bg-gray-50">
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose} className="rounded-xl">
              Đóng
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
