"use client";

import { useState, useEffect, useMemo } from "react";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useClassesStore, type Class } from "@/lib/stores/classes-store";
import { useUsersStore } from "@/lib/stores/users-store";

interface ClassStudentsModalProps {
  classData: Class;
  branchId?: string;
  onClose: () => void;
  onUpdate: () => void;
}

export default function ClassStudentsModal({
  classData,
  branchId,
  onClose,
  onUpdate,
}: ClassStudentsModalProps) {
  const {
    addStudentToClass,
    classes,
    fetchClasses,
    createClassTransferRequest,
    removeStudentFromClass,
    checkStudentScheduleConflicts,
    isLoading,
  } = useClassesStore();
  const { users, fetchUsers } = useUsersStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [addSearchQuery, setAddSearchQuery] = useState("");
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [showTransferPopup, setShowTransferPopup] = useState(false);
  const [transferStudent, setTransferStudent] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [targetClassId, setTargetClassId] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [transferConflictWarning, setTransferConflictWarning] = useState<
    string | null
  >(null);

  // Get current students in class
  const currentStudents = useMemo(
    () => classData.students || [],
    [classData.students],
  );
  const currentStudentIds = useMemo(
    () => classData.studentIds || [],
    [classData.studentIds],
  );

  // Normalize branchId - có thể là string hoặc object
  const normalizedBranchId = useMemo(() => {
    if (!branchId) return undefined;
    if (
      typeof branchId === "object" &&
      (branchId as unknown as Record<string, string>)._id
    ) {
      return (branchId as unknown as Record<string, string>)._id;
    }
    return branchId;
  }, [branchId]);

  // Get all students that are not in this class - filter by branchId
  const availableStudents = useMemo(() => {
    const students = users.filter((u) => {
      // Only students
      if (u.role !== "student") return false;
      // Only same branch if branchId is provided
      if (normalizedBranchId) {
        const userBranchId =
          typeof u.branchId === "object" &&
          (u.branchId as unknown as Record<string, string>)?._id
            ? (u.branchId as unknown as Record<string, string>)._id
            : u.branchId;
        if (userBranchId && userBranchId !== normalizedBranchId) return false;
      }
      // Not already in class
      if (currentStudentIds.includes(u._id)) return false;
      return true;
    });
    return students;
  }, [users, currentStudentIds, normalizedBranchId]);

  // Filter students by search query - current students list
  const filteredCurrentStudents = useMemo(() => {
    if (!searchQuery.trim()) return currentStudents;
    const query = searchQuery.toLowerCase();
    return currentStudents.filter(
      (s) =>
        s.name?.toLowerCase().includes(query) ||
        s.email?.toLowerCase().includes(query) ||
        (s as unknown as Record<string, string>).phone
          ?.toLowerCase()
          .includes(query) ||
        (s as unknown as Record<string, string>).studentCode
          ?.toLowerCase()
          .includes(query),
    );
  }, [currentStudents, searchQuery]);

  // Filter available students by advanced search (email, phone, studentCode, name)
  const filteredAvailableStudents = useMemo(() => {
    if (!addSearchQuery.trim()) return availableStudents.slice(0, 50); // Limit to 50 for performance
    const query = addSearchQuery.toLowerCase().trim();

    return availableStudents
      .filter((s) => {
        const name = (s.name || "").toLowerCase();
        const email = (s.email || "").toLowerCase();
        const phone = (
          (s as unknown as Record<string, string>).phone || ""
        ).toLowerCase();
        const studentCode = (
          (s as unknown as Record<string, string>).studentCode || ""
        ).toLowerCase();

        // Priority search: exact match first, then partial match
        return (
          email.includes(query) ||
          phone.includes(query) ||
          studentCode.includes(query) ||
          name.includes(query)
        );
      })
      .slice(0, 50);
  }, [availableStudents, addSearchQuery]);

  const availableTransferClasses = useMemo(() => {
    const currentClassId = classData._id;
    return classes.filter((c) => {
      if (c._id === currentClassId) return false;
      if (c.status !== "active") return false;

      if (normalizedBranchId) {
        const cBranchId =
          typeof c.branchId === "object" && c.branchId?._id
            ? c.branchId._id
            : c.branchId;
        if (cBranchId && cBranchId !== normalizedBranchId) return false;
      }
      return true;
    });
  }, [classes, classData._id, normalizedBranchId]);

  const selectedTargetClass = useMemo(
    () => availableTransferClasses.find((c) => c._id === targetClassId),
    [availableTransferClasses, targetClassId],
  );

  // Fetch users on mount - fetch students from the same branch
  useEffect(() => {
    // Fetch students - không filter theo branch để lấy tất cả students
    // Việc filter theo branch sẽ được thực hiện ở frontend
    let cancelled = false;
    fetchUsers({ role: "student" })
      .then(() => {
        if (!cancelled) setIsLoadingStudents(false);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setIsLoadingStudents(false);
      });

    fetchClasses().catch((err) => {
      console.error(err);
    });

    return () => {
      cancelled = true;
    };
  }, [fetchUsers, fetchClasses]);

  useEffect(() => {
    if (!showAddStudent || !selectedStudentId) {
      setConflictWarning(null);
      return;
    }

    let cancelled = false;
    checkStudentScheduleConflicts(classData._id, selectedStudentId)
      .then((result) => {
        if (cancelled) return;
        if (!result.hasConflict) {
          setConflictWarning(null);
          return;
        }

        const dayNames = [
          "Chủ nhật",
          "Thứ 2",
          "Thứ 3",
          "Thứ 4",
          "Thứ 5",
          "Thứ 6",
          "Thứ 7",
        ];
        const detailText = result.conflicts
          .map((item) => {
            const dayLabel =
              dayNames[item.dayOfWeek] || `Thứ ${item.dayOfWeek}`;
            const subjectPart = item.subject ? ` - ${item.subject}` : "";
            return `${item.className}${subjectPart} (${dayLabel} ${item.startTime}-${item.endTime})`;
          })
          .join("; ");

        setConflictWarning(
          `⚠️ Học sinh đang trùng lịch với lớp khác: ${detailText}. Vui lòng xem lại trước khi chuyển lớp.`,
        );
      })
      .catch(() => {
        if (!cancelled) setConflictWarning(null);
      });

    return () => {
      cancelled = true;
    };
  }, [
    checkStudentScheduleConflicts,
    classData._id,
    selectedStudentId,
    showAddStudent,
  ]);

  // Handle add student
  const handleAddStudent = async () => {
    if (!selectedStudentId) {
      setError("Vui lòng chọn học sinh");
      return;
    }

    setError(null);
    try {
      const conflict = await checkStudentScheduleConflicts(
        classData._id,
        selectedStudentId,
      );
      if (conflict.hasConflict) {
        const dayNames = [
          "Chủ nhật",
          "Thứ 2",
          "Thứ 3",
          "Thứ 4",
          "Thứ 5",
          "Thứ 6",
          "Thứ 7",
        ];
        const detailText = conflict.conflicts
          .map((item) => {
            const dayLabel =
              dayNames[item.dayOfWeek] || `Thứ ${item.dayOfWeek}`;
            const subjectPart = item.subject ? ` - ${item.subject}` : "";
            return `${item.className}${subjectPart} (${dayLabel} ${item.startTime}-${item.endTime})`;
          })
          .join("; ");
        setError(
          `Học sinh bị trùng lịch, vui lòng kiểm tra lại: ${detailText}`,
        );
        return;
      }

      await addStudentToClass(classData._id, selectedStudentId);
      setSuccessMessage("Đã thêm học sinh vào lớp!");
      setSelectedStudentId("");
      setConflictWarning(null);
      setShowAddStudent(false);
      onUpdate();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: unknown) {
      // Show the error message from backend (including schedule conflict)
      setError((err as Error).message || "Có lỗi khi thêm học sinh");
    }
  };

  const openTransferPopup = (studentId: string, studentName: string) => {
    setTransferStudent({ id: studentId, name: studentName });
    setTargetClassId("");
    setTransferReason("");
    setTransferConflictWarning(null);
    setError(null);
    setShowTransferPopup(true);
  };

  const closeTransferPopup = () => {
    setShowTransferPopup(false);
    setTransferStudent(null);
    setTargetClassId("");
    setTransferReason("");
    setTransferConflictWarning(null);
  };

  const handleCreateTransferRequest = async () => {
    if (!transferStudent) {
      setError("Không tìm thấy học sinh để chuyển lớp");
      return;
    }

    if (!targetClassId) {
      setError("Vui lòng chọn lớp đích");
      return;
    }

    setError(null);

    try {
      const conflict = await checkStudentScheduleConflicts(
        targetClassId,
        transferStudent.id,
        classData._id,
      );

      if (conflict.hasConflict) {
        const dayNames = [
          "Chủ nhật",
          "Thứ 2",
          "Thứ 3",
          "Thứ 4",
          "Thứ 5",
          "Thứ 6",
          "Thứ 7",
        ];
        const detailText = conflict.conflicts
          .map((item) => {
            const dayLabel = dayNames[item.dayOfWeek] || `Thứ ${item.dayOfWeek}`;
            const subjectPart = item.subject ? ` - ${item.subject}` : "";
            return `${item.className}${subjectPart} (${dayLabel} ${item.startTime}-${item.endTime})`;
          })
          .join("; ");

        setTransferConflictWarning(
          `Học sinh bị trùng lịch: ${detailText}. Vui lòng chọn lớp khác.`,
        );
        return;
      }

      await createClassTransferRequest({
        studentId: transferStudent.id,
        fromClassId: classData._id,
        toClassId: targetClassId,
        reason: transferReason.trim() || undefined,
      });

      setSuccessMessage(
        `Đã gửi yêu cầu chuyển lớp cho ${transferStudent.name}. Cần admin duyệt trước khi áp dụng.`,
      );
      closeTransferPopup();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: unknown) {
      setError((err as Error).message || "Có lỗi khi tạo yêu cầu chuyển lớp");
    }
  };

  useEffect(() => {
    if (!showTransferPopup || !transferStudent || !targetClassId) {
      setTransferConflictWarning(null);
      return;
    }

    let cancelled = false;
    checkStudentScheduleConflicts(targetClassId, transferStudent.id, classData._id)
      .then((result) => {
        if (cancelled) return;
        if (!result.hasConflict) {
          setTransferConflictWarning(null);
          return;
        }

        const dayNames = [
          "Chủ nhật",
          "Thứ 2",
          "Thứ 3",
          "Thứ 4",
          "Thứ 5",
          "Thứ 6",
          "Thứ 7",
        ];
        const detailText = result.conflicts
          .map((item) => {
            const dayLabel = dayNames[item.dayOfWeek] || `Thứ ${item.dayOfWeek}`;
            const subjectPart = item.subject ? ` - ${item.subject}` : "";
            return `${item.className}${subjectPart} (${dayLabel} ${item.startTime}-${item.endTime})`;
          })
          .join("; ");

        setTransferConflictWarning(
          `⚠️ Trùng lịch realtime: ${detailText}. Không thể gửi yêu cầu với lớp đích này.`,
        );
      })
      .catch(() => {
        if (!cancelled) setTransferConflictWarning(null);
      });

    return () => {
      cancelled = true;
    };
  }, [
    checkStudentScheduleConflicts,
    classData._id,
    showTransferPopup,
    targetClassId,
    transferStudent,
  ]);

  // Handle remove student
  const handleRemoveStudent = async (
    studentId: string,
    studentName: string,
  ) => {
    if (
      !confirm(
        `Bạn có chắc muốn xóa "${studentName}" khỏi lớp này?\n\nHọc sinh sẽ không còn xem được lịch học của lớp này.`,
      )
    ) {
      return;
    }

    setError(null);
    try {
      await removeStudentFromClass(classData._id, studentId);
      setSuccessMessage("Đã xóa học sinh khỏi lớp!");
      onUpdate();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: unknown) {
      setError((err as Error).message || "Có lỗi khi xóa học sinh");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-linear-to-r from-blue-600 to-indigo-600 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white text-lg">
                👥
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  Danh sách học sinh
                </h2>
                <p className="text-blue-100 text-sm">
                  {classData.name} • {currentStudentIds.length}/
                  {classData.maxStudents || 30} học sinh
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
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-160px)]">
          {/* Messages */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
              {error}
            </div>
          )}
          {successMessage && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm">
              ✅ {successMessage}
            </div>
          )}

          {/* Actions Bar */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="flex-1 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                🔍
              </span>
              <Input
                type="text"
                placeholder="Tìm kiếm học sinh..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 rounded-xl"
              />
            </div>
            <Button
              onClick={() => setShowAddStudent(!showAddStudent)}
              className="bg-linear-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-xl"
            >
              ➕ Thêm học sinh
            </Button>
          </div>

          {/* Add Student Form */}
          {showAddStudent && (
            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <h4 className="font-semibold text-blue-800 mb-3">
                Thêm học sinh vào lớp
              </h4>
              {isLoadingStudents ? (
                <div className="text-center py-4 text-gray-500">
                  <span className="animate-spin inline-block mr-2">⏳</span>
                  Đang tải danh sách học sinh...
                </div>
              ) : (
                <>
                  {/* Search Input for Adding Students */}
                  <div className="mb-3">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                        🔍
                      </span>
                      <Input
                        type="text"
                        placeholder="Tìm theo email, SĐT, mã học sinh, hoặc tên..."
                        value={addSearchQuery}
                        onChange={(e) => {
                          setAddSearchQuery(e.target.value);
                          setSelectedStudentId("");
                        }}
                        className="pl-9 rounded-xl text-sm"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      💡 Nhập email, số điện thoại, mã học sinh (VD: HS0001)
                      hoặc tên để tìm nhanh
                    </p>
                  </div>

                  {/* Student Selection */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="flex-1 min-w-0">
                      <select
                        value={selectedStudentId}
                        onChange={(e) => setSelectedStudentId(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 truncate"
                        style={{ maxWidth: "100%" }}
                      >
                        <option value="">
                          -- Chọn học sinh ({filteredAvailableStudents.length}/
                          {availableStudents.length} học sinh) --
                        </option>
                        {filteredAvailableStudents.map((student) => (
                          <option key={student._id} value={student._id}>
                            {(student as unknown as Record<string, string>)
                              .studentCode
                              ? `[${(student as unknown as Record<string, string>).studentCode}] `
                              : ""}
                            {student.name} • {student.email}
                            {(student as unknown as Record<string, string>)
                              .phone
                              ? ` • ${(student as unknown as Record<string, string>).phone}`
                              : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        onClick={handleAddStudent}
                        disabled={
                          isLoading ||
                          !selectedStudentId ||
                          Boolean(conflictWarning)
                        }
                        className="rounded-xl bg-blue-600 hover:bg-blue-700 whitespace-nowrap"
                      >
                        {isLoading ? "Đang thêm..." : "Thêm"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowAddStudent(false);
                          setSelectedStudentId("");
                          setAddSearchQuery("");
                          setError(null);
                        }}
                        className="rounded-xl whitespace-nowrap"
                      >
                        Hủy
                      </Button>
                    </div>
                  </div>

                  {conflictWarning && (
                    <div className="mt-3 p-3 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 text-sm">
                      {conflictWarning}
                    </div>
                  )}

                  {/* Quick Add - Show matching students as cards */}
                  {addSearchQuery &&
                    filteredAvailableStudents.length > 0 &&
                    filteredAvailableStudents.length <= 10 && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs font-medium text-gray-600">
                          Kết quả tìm kiếm ({filteredAvailableStudents.length}{" "}
                          học sinh):
                        </p>
                        <div className="grid gap-2 max-h-48 overflow-y-auto">
                          {filteredAvailableStudents.map((student) => (
                            <div
                              key={student._id}
                              className={`flex items-center gap-3 p-2 rounded-lg border transition-all ${
                                selectedStudentId === student._id
                                  ? "border-blue-500 bg-blue-50"
                                  : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                              }`}
                            >
                              <button
                                onClick={() =>
                                  setSelectedStudentId(student._id)
                                }
                                className="flex items-center gap-3 flex-1 min-w-0 text-left"
                              >
                                <div className="w-8 h-8 rounded-full bg-linear-to-br from-blue-100 to-indigo-100 flex items-center justify-center text-sm shrink-0">
                                  👨‍🎓
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm text-gray-900 truncate">
                                    {(
                                      student as unknown as Record<
                                        string,
                                        string
                                      >
                                    ).studentCode && (
                                      <span className="text-blue-600">
                                        [
                                        {
                                          (
                                            student as unknown as Record<
                                              string,
                                              string
                                            >
                                          ).studentCode
                                        }
                                        ]{" "}
                                      </span>
                                    )}
                                    {student.name}
                                  </p>
                                  <p className="text-xs text-gray-500 truncate">
                                    {student.email}
                                    {(
                                      student as unknown as Record<
                                        string,
                                        string
                                      >
                                    ).phone &&
                                      ` • ${(student as unknown as Record<string, string>).phone}`}
                                  </p>
                                </div>
                              </button>
                              {/* Quick Add Button */}
                              <Button
                                size="sm"
                                onClick={async () => {
                                  setSelectedStudentId(student._id);
                                  setError(null);
                                  try {
                                    const conflict =
                                      await checkStudentScheduleConflicts(
                                        classData._id,
                                        student._id,
                                      );
                                    if (conflict.hasConflict) {
                                      const dayNames = [
                                        "Chủ nhật",
                                        "Thứ 2",
                                        "Thứ 3",
                                        "Thứ 4",
                                        "Thứ 5",
                                        "Thứ 6",
                                        "Thứ 7",
                                      ];
                                      const detailText = conflict.conflicts
                                        .map((item) => {
                                          const dayLabel =
                                            dayNames[item.dayOfWeek] ||
                                            `Thứ ${item.dayOfWeek}`;
                                          const subjectPart = item.subject
                                            ? ` - ${item.subject}`
                                            : "";
                                          return `${item.className}${subjectPart} (${dayLabel} ${item.startTime}-${item.endTime})`;
                                        })
                                        .join("; ");
                                      setError(
                                        `Học sinh bị trùng lịch, vui lòng kiểm tra lại: ${detailText}`,
                                      );
                                      return;
                                    }

                                    await addStudentToClass(
                                      classData._id,
                                      student._id,
                                    );
                                    setSuccessMessage(
                                      `Đã thêm ${student.name} vào lớp!`,
                                    );
                                    setAddSearchQuery("");
                                    onUpdate();
                                    setTimeout(
                                      () => setSuccessMessage(null),
                                      3000,
                                    );
                                  } catch (err: unknown) {
                                    setError(
                                      (err as Error).message ||
                                        "Có lỗi khi thêm học sinh",
                                    );
                                  }
                                }}
                                disabled={isLoading}
                                className="rounded-lg bg-green-600 hover:bg-green-700 text-white px-3 py-1 text-xs shrink-0"
                              >
                                ➕ Thêm
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  {availableStudents.length === 0 && (
                    <p className="text-sm text-amber-600 mt-2">
                      ⚠️ Không còn học sinh nào có thể thêm vào lớp này. Hãy tạo
                      thêm tài khoản học sinh trong tab Tài khoản.
                    </p>
                  )}

                  {addSearchQuery &&
                    filteredAvailableStudents.length === 0 &&
                    availableStudents.length > 0 && (
                      <p className="text-sm text-amber-600 mt-2">
                        ⚠️ Không tìm thấy học sinh phù hợp với &ldquo;
                        {addSearchQuery}
                        &rdquo;. Thử tìm kiếm với từ khóa khác.
                      </p>
                    )}
                </>
              )}
            </div>
          )}

          {/* Students List */}
          <div className="space-y-2">
            {filteredCurrentStudents.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <span className="text-5xl mb-4 block">👥</span>
                <p className="font-medium">
                  {currentStudents.length === 0
                    ? "Chưa có học sinh trong lớp"
                    : "Không tìm thấy học sinh"}
                </p>
                <p className="text-sm mt-1">
                  {currentStudents.length === 0
                    ? "Nhấn 'Thêm học sinh' để thêm"
                    : "Thử tìm kiếm với từ khóa khác"}
                </p>
              </div>
            ) : (
              filteredCurrentStudents.map((student, index) => (
                <div
                  key={student._id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-4 py-3 hover:border-blue-200 hover:shadow-sm transition-all bg-white"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-linear-to-br from-blue-100 to-indigo-100 flex items-center justify-center text-lg">
                      👨‍🎓
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg text-blue-600 border-blue-200 hover:bg-blue-50"
                        onClick={() => openTransferPopup(student._id, student.name)}
                        disabled={isLoading}
                      >
                        🔄 Chuyển lớp
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-lg text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() =>
                          handleRemoveStudent(student._id, student.name)
                        }
                        disabled={isLoading}
                      >
                        🗑️ Xóa
                      </Button>
                    </div>
                    className="rounded-lg text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() =>
                      handleRemoveStudent(student._id, student.name)
                    }
                    disabled={isLoading}

          {showTransferPopup && transferStudent && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-60 p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Yêu cầu chuyển lớp</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Học sinh: <strong>{transferStudent.name}</strong>
                    </p>
                    <p className="text-xs text-gray-500">Lớp hiện tại: {classData.name}</p>
                  </div>
                  <button
                    onClick={closeTransferPopup}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Chọn lớp đích
                  </label>
                  <select
                    value={targetClassId}
                    onChange={(e) => setTargetClassId(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Chọn lớp đích --</option>
                    {availableTransferClasses.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                        {c.subject ? ` - ${c.subject}` : ""}
                        {` (${c.studentIds?.length || 0}/${c.maxStudents || 30})`}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedTargetClass && (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                    <p className="text-sm font-semibold text-blue-800 mb-2">
                      Lịch lớp đích: {selectedTargetClass.name}
                    </p>
                    {selectedTargetClass.schedule?.length ? (
                      <div className="space-y-1 text-sm text-blue-700">
                        {selectedTargetClass.schedule.map((item, idx) => {
                          const dayNames = [
                            "Chủ nhật",
                            "Thứ 2",
                            "Thứ 3",
                            "Thứ 4",
                            "Thứ 5",
                            "Thứ 6",
                            "Thứ 7",
                          ];
                          const dayLabel =
                            dayNames[item.dayOfWeek] || `Thứ ${item.dayOfWeek}`;
                          return (
                            <p key={`${item.dayOfWeek}-${item.startTime}-${idx}`}>
                              • {dayLabel}: {item.startTime} - {item.endTime}
                              {item.room ? ` (Phòng ${item.room})` : ""}
                            </p>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-blue-700">Chưa có lịch học.</p>
                    )}
                  </div>
                )}

                {transferConflictWarning && (
                  <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                    {transferConflictWarning}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ghi chú lý do (tuỳ chọn)
                  </label>
                  <textarea
                    value={transferReason}
                    onChange={(e) => setTransferReason(e.target.value)}
                    rows={3}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="VD: Phù hợp trình độ hơn, thuận tiện lịch cá nhân..."
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={closeTransferPopup}>
                    Hủy
                  </Button>
                  <Button
                    onClick={handleCreateTransferRequest}
                    disabled={!targetClassId || Boolean(transferConflictWarning) || isLoading}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {isLoading ? "Đang gửi..." : "Xác nhận gửi yêu cầu"}
                  </Button>
                </div>
              </div>
            </div>
          )}
                  >
                    🗑️ Xóa
                  </Button>
                </div>
              ))
            )}
          </div>

          {/* Summary */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>
                Tổng số học sinh: <strong>{currentStudentIds.length}</strong>
              </span>
              <span>
                Còn trống:{" "}
                <strong>
                  {(classData.maxStudents || 30) - currentStudentIds.length}
                </strong>{" "}
                chỗ
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full rounded-xl"
          >
            Đóng
          </Button>
        </div>
      </div>
    </div>
  );
}
