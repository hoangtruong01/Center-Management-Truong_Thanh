"use client";
import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useScheduleStore,
  Session,
  SessionType,
  SessionStatus,
  MakeupConflictPolicy,
  CancelAndMakeupResult,
  getTypeColor,
  getSessionClassName,
  getSessionTeacherName,
  formatSessionTime,
  type ScheduleQuery,
} from "@/lib/stores/schedule-store";
import { useClassesStore, Class } from "@/lib/stores/classes-store";
import { useBranchesStore } from "@/lib/stores/branches-store";
import { useUsersStore } from "@/lib/stores/users-store";
import { notify } from "@/lib/notify";
import api from "@/lib/api";
import SessionFormModal from "./session-form-modal";
import ClassDetailModal from "./class-detail-modal";

interface ScheduleManagerProps {
  userRole?: string;
  userId?: string;
}

// Helper để lấy ngày đầu tuần (Thứ 2)
const getStartOfWeek = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
};

// Helper để lấy ngày cuối tuần (Chủ nhật)
const getEndOfWeek = (date: Date): Date => {
  const start = getStartOfWeek(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
};

const formatDisplayDate = (date: Date): string => {
  return date.toLocaleDateString("vi-VN", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
};

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7:00 - 20:00
const DAYS_OF_WEEK = [
  "Thứ 2",
  "Thứ 3",
  "Thứ 4",
  "Thứ 5",
  "Thứ 6",
  "Thứ 7",
  "CN",
];

// Colors for classes - each class gets a unique color
const CLASS_COLORS = [
  "bg-blue-100 border-blue-400 text-blue-800",
  "bg-green-100 border-green-400 text-green-800",
  "bg-purple-100 border-purple-400 text-purple-800",
  "bg-orange-100 border-orange-400 text-orange-800",
  "bg-pink-100 border-pink-400 text-pink-800",
  "bg-teal-100 border-teal-400 text-teal-800",
  "bg-indigo-100 border-indigo-400 text-indigo-800",
  "bg-rose-100 border-rose-400 text-rose-800",
  "bg-cyan-100 border-cyan-400 text-cyan-800",
  "bg-amber-100 border-amber-400 text-amber-800",
];

// Interface for class-based schedules
interface ClassScheduleEvent {
  classId: string;
  className: string;
  teacherName: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room?: string;
  colorIndex: number;
}

interface SuggestedMakeupSlot {
  startTime: string;
  endTime: string;
  report: CancelAndMakeupResult["report"];
  score: number;
}

export default function ScheduleManager({
  userRole = "admin",
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  userId,
}: ScheduleManagerProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"week" | "month" | "list">("week");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>("");
  const [selectedTeacherFilter, setSelectedTeacherFilter] =
    useState<string>("");
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>("");
  const [selectedClassDetail, setSelectedClassDetail] = useState<Class | null>(
    null,
  );
  const [showMakeupModal, setShowMakeupModal] = useState(false);
  const [selectedSessionForMakeup, setSelectedSessionForMakeup] =
    useState<Session | null>(null);
  const [makeupReason, setMakeupReason] = useState("");
  const [makeupPolicy, setMakeupPolicy] = useState<MakeupConflictPolicy>(
    MakeupConflictPolicy.BlockAll,
  );
  const [maxConflictRatePercent, setMaxConflictRatePercent] = useState(15);
  const [makeupStart, setMakeupStart] = useState("");
  const [makeupEnd, setMakeupEnd] = useState("");
  const [previewResult, setPreviewResult] =
    useState<CancelAndMakeupResult | null>(null);
  const [isSubmittingMakeup, setIsSubmittingMakeup] = useState(false);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const [suggestedSlots, setSuggestedSlots] = useState<SuggestedMakeupSlot[]>(
    [],
  );
  const [showManualResolutionOnly, setShowManualResolutionOnly] =
    useState(false);

  // Stores
  const {
    sessions,
    isLoading,
    error,
    statistics,
    fetchSchedule,
    fetchStatistics,
    updateSession,
    deleteSession,
    cancelAndMakeupSession,
    clearError,
  } = useScheduleStore();

  const { classes, fetchClasses, updateClass } = useClassesStore();
  const { branches, fetchBranches } = useBranchesStore();
  const { users, fetchUsers } = useUsersStore();
  const canManageSchedule = userRole === "admin";

  const readErrorMessagePayload = (error: unknown) => {
    if (!error || typeof error !== "object") return undefined;
    const response = (error as { response?: { data?: { message?: unknown } } })
      .response;
    return response?.data?.message;
  };

  const readErrorReport = (error: unknown) => {
    const payload = readErrorMessagePayload(error);
    if (!payload || typeof payload !== "object") return undefined;
    const report = (payload as { report?: CancelAndMakeupResult["report"] })
      .report;
    return report;
  };

  // Calculate date range based on view mode
  const dateRange = useMemo(() => {
    if (viewMode === "week") {
      return {
        start: getStartOfWeek(currentDate),
        end: getEndOfWeek(currentDate),
      };
    } else {
      // Month view
      const start = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        1,
      );
      const end = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() + 1,
        0,
      );
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
  }, [currentDate, viewMode]);

  // Fetch data on mount
  useEffect(() => {
    fetchClasses().catch(console.error);
    fetchBranches().catch(console.error);
    fetchUsers({ role: "teacher" }).catch(console.error);
  }, [fetchClasses, fetchBranches, fetchUsers]);

  // Fetch schedule when date range or filters change
  useEffect(() => {
    const query: ScheduleQuery = {
      startDate: dateRange.start.toISOString(),
      endDate: dateRange.end.toISOString(),
    };
    if (selectedClassFilter) query.classId = selectedClassFilter;
    if (selectedTeacherFilter) query.teacherId = selectedTeacherFilter;
    if (selectedBranchFilter) query.branchId = selectedBranchFilter;

    fetchSchedule(query).catch(console.error);
    fetchStatistics(
      dateRange.start.toISOString(),
      dateRange.end.toISOString(),
      selectedBranchFilter || undefined,
    ).catch(console.error);
  }, [
    dateRange,
    selectedClassFilter,
    selectedTeacherFilter,
    selectedBranchFilter,
    fetchSchedule,
    fetchStatistics,
  ]);

  // Get teachers from users
  const teachers = useMemo(() => {
    return users.filter((u) => u.role === "teacher");
  }, [users]);

  // Generate class-based schedule events from classes
  const classScheduleEvents = useMemo(() => {
    const events: ClassScheduleEvent[] = [];
    // Filter out completed/inactive classes - they should not appear on schedule
    let filteredClasses = classes.filter((c) => c.status === "active");

    // Apply filters
    if (selectedBranchFilter) {
      filteredClasses = filteredClasses.filter(
        (c) =>
          c.branchId === selectedBranchFilter ||
          c.branch?._id === selectedBranchFilter,
      );
    }
    if (selectedClassFilter) {
      filteredClasses = filteredClasses.filter(
        (c) => c._id === selectedClassFilter,
      );
    }
    if (selectedTeacherFilter) {
      filteredClasses = filteredClasses.filter(
        (c) =>
          c.teacherId === selectedTeacherFilter ||
          c.teacher?._id === selectedTeacherFilter,
      );
    }

    filteredClasses.forEach((cls, classIndex) => {
      if (cls.schedule && cls.schedule.length > 0) {
        cls.schedule.forEach((sched) => {
          events.push({
            classId: cls._id,
            className: cls.name,
            teacherName: cls.teacher?.name || "Chưa phân công",
            dayOfWeek: sched.dayOfWeek,
            startTime: sched.startTime,
            endTime: sched.endTime,
            room: sched.room,
            colorIndex: classIndex % CLASS_COLORS.length,
          });
        });
      }
    });

    return events;
  }, [
    classes,
    selectedBranchFilter,
    selectedClassFilter,
    selectedTeacherFilter,
  ]);

  const filteredSessions = useMemo(() => {
    if (!showManualResolutionOnly) return sessions;
    return sessions.filter(
      (session) =>
        session.type === SessionType.Makeup &&
        session.conflictResolutionRequired &&
        session.conflictResolutionStatus === "pending",
    );
  }, [sessions, showManualResolutionOnly]);

  const previewMakeupRequest = async (
    sessionId: string,
    payload: {
      reason: string;
      makeupStartTime: string;
      makeupEndTime: string;
      policy: MakeupConflictPolicy;
      maxConflictRate?: number;
    },
  ): Promise<CancelAndMakeupResult> => {
    try {
      const response = await api.post(
        `/sessions/${sessionId}/cancel-and-makeup`,
        {
          ...payload,
          dryRun: true,
        },
      );
      return response.data;
    } catch (error: unknown) {
      const report = readErrorReport(error);
      if (report) {
        return {
          previewOnly: true,
          originalSessionId: sessionId,
          report,
        };
      }
      throw error;
    }
  };

  const calculateSuggestionScore = (result: CancelAndMakeupResult) => {
    const report = result.report;
    const policyPenalty = report.policyDecision.canCreate ? 0 : 1000;
    const teacherPenalty = report.teacherConflicts.length * 300;
    const roomPenalty = report.roomConflicts.length * 250;
    const studentPenalty = report.conflictingStudentCount * 10;
    const ratePenalty = Math.round(report.conflictRate * 100);
    return (
      policyPenalty +
      teacherPenalty +
      roomPenalty +
      studentPenalty +
      ratePenalty
    );
  };

  const buildCandidateSlots = () => {
    if (!selectedSessionForMakeup || !makeupStart || !makeupEnd) return [];
    const baseStart = new Date(makeupStart);
    const baseEnd = new Date(makeupEnd);
    const duration = baseEnd.getTime() - baseStart.getTime();
    if (duration <= 0) return [];

    const hourOffsets = [0, 1, -1];
    const dayOffsets = [0, 1, 2, 3, 4, 5, 6];
    const candidates: Array<{ startTime: string; endTime: string }> = [];

    for (const dayOffset of dayOffsets) {
      for (const hourOffset of hourOffsets) {
        const start = new Date(baseStart);
        start.setDate(start.getDate() + dayOffset);
        start.setHours(start.getHours() + hourOffset);
        if (start.getHours() < 7 || start.getHours() > 20) continue;

        const end = new Date(start.getTime() + duration);
        candidates.push({
          startTime: start.toISOString(),
          endTime: end.toISOString(),
        });
      }
    }

    return Array.from(
      new Map(
        candidates.map((item) => [`${item.startTime}-${item.endTime}`, item]),
      ).values(),
    ).slice(0, 12);
  };

  const generateSuggestedSlots = async () => {
    if (!selectedSessionForMakeup) return;
    if (!validateMakeupInput()) return;

    const candidates = buildCandidateSlots();
    if (candidates.length === 0) {
      notify.warning("Không tạo được danh sách gợi ý từ thời gian hiện tại.");
      return;
    }

    setIsGeneratingSuggestions(true);
    try {
      const rawResults = await Promise.all(
        candidates.map(async (candidate) => {
          const result = await previewMakeupRequest(
            selectedSessionForMakeup._id,
            {
              reason: makeupReason.trim(),
              makeupStartTime: candidate.startTime,
              makeupEndTime: candidate.endTime,
              policy: makeupPolicy,
              maxConflictRate:
                makeupPolicy === MakeupConflictPolicy.AllowWithThreshold
                  ? maxConflictRatePercent / 100
                  : undefined,
            },
          );

          return {
            startTime: candidate.startTime,
            endTime: candidate.endTime,
            report: result.report,
            score: calculateSuggestionScore(result),
          } as SuggestedMakeupSlot;
        }),
      );

      const bestSlots = rawResults
        .sort((a, b) => a.score - b.score)
        .slice(0, 3);
      setSuggestedSlots(bestSlots);
      if (bestSlots.length > 0) {
        notify.success("Đã tìm thấy các khung giờ gợi ý tối ưu.");
      } else {
        notify.warning("Không tìm thấy khung giờ phù hợp.");
      }
    } catch (error: unknown) {
      notify.error(extractServerMessage(error));
    } finally {
      setIsGeneratingSuggestions(false);
    }
  };

  const applySuggestedSlot = (slot: SuggestedMakeupSlot) => {
    setMakeupStart(toLocalDateTime(slot.startTime));
    setMakeupEnd(toLocalDateTime(slot.endTime));
    setPreviewResult({
      previewOnly: true,
      originalSessionId: selectedSessionForMakeup?._id || "",
      report: slot.report,
    });
    notify.info("Đã áp dụng khung giờ gợi ý.");
  };

  const markManualResolutionDone = async (session: Session) => {
    try {
      await updateSession(session._id, {
        conflictResolutionStatus: "resolved",
      });
      notify.success("Đã đánh dấu xử lý thủ công hoàn tất.");
    } catch (error: unknown) {
      notify.error(extractServerMessage(error));
    }
  };

  const removeFixedScheduleFromClassDetail = async (
    scheduleIndex: number,
    reason: string,
  ) => {
    if (!canManageSchedule) {
      notify.error("Bạn không có quyền xóa lịch cố định.");
      return;
    }

    const normalizedReason = reason.trim();
    if (!normalizedReason) {
      notify.warning("Vui lòng nhập lý do trước khi xóa lịch cố định.");
      return;
    }

    if (!selectedClassDetail) {
      notify.error("Không tìm thấy lớp cần xóa lịch cố định.");
      return;
    }

    const classInfo = classes.find((c) => c._id === selectedClassDetail._id);
    if (!classInfo?.schedule?.length) {
      notify.error("Không tìm thấy lịch cố định của lớp.");
      return;
    }

    if (scheduleIndex < 0 || scheduleIndex >= classInfo.schedule.length) {
      notify.error("Không tìm thấy buổi cố định cần xóa.");
      return;
    }

    const targetSchedule = classInfo.schedule[scheduleIndex];
    const confirmed = window.confirm(
      `Xác nhận xóa lịch cố định ${targetSchedule.startTime} - ${targetSchedule.endTime} (${targetSchedule.dayOfWeek === 0 ? "Chủ nhật" : `Thứ ${targetSchedule.dayOfWeek + 1}`})?\n\nLý do: ${normalizedReason}`,
    );
    if (!confirmed) return;

    const nextSchedule = classInfo.schedule.filter(
      (_, idx) => idx !== scheduleIndex,
    );

    try {
      const updatedClass = await updateClass(classInfo._id, {
        schedule: nextSchedule,
      });
      setSelectedClassDetail(updatedClass);
      await fetchClasses();
      notify.success(
        "Đã xóa lịch cố định. Bạn có thể tạo buổi học bù theo ngày cụ thể ngay trên lịch.",
      );
    } catch (error: unknown) {
      notify.error(extractServerMessage(error));
    }
  };

  // Navigate week/month
  const navigatePrev = () => {
    const newDate = new Date(currentDate);
    if (viewMode === "week") {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setMonth(newDate.getMonth() - 1);
    }
    setCurrentDate(newDate);
  };

  const navigateNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === "week") {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Get sessions for a specific day and hour
  const getSessionsForSlot = (dayIndex: number, hour: number): Session[] => {
    const targetDate = new Date(dateRange.start);
    targetDate.setDate(targetDate.getDate() + dayIndex);

    return filteredSessions.filter((session) => {
      const sessionStart = new Date(session.startTime);
      const sessionHour = sessionStart.getHours();
      const sessionDate = sessionStart.toDateString();
      return sessionDate === targetDate.toDateString() && sessionHour === hour;
    });
  };

  // Get class schedules for a specific day (by dayOfWeek index) and hour
  const getClassSchedulesForSlot = (
    dayIndex: number,
    hour: number,
  ): ClassScheduleEvent[] => {
    // Convert dayIndex (0=Monday, 6=Sunday) to dayOfWeek (1=Monday, 0=Sunday)
    const targetDayOfWeek = dayIndex === 6 ? 0 : dayIndex + 1;

    return classScheduleEvents.filter((event) => {
      const startHour = parseInt(event.startTime.split(":")[0], 10);
      return event.dayOfWeek === targetDayOfWeek && startHour === hour;
    });
  };

  // Get class schedules for a specific date (for month view)
  const getClassSchedulesForDate = (date: Date): ClassScheduleEvent[] => {
    const dayOfWeek = date.getDay(); // 0=Sunday, 1=Monday, etc.
    return classScheduleEvents.filter((event) => event.dayOfWeek === dayOfWeek);
  };

  // Get sessions for a specific date (for month view)
  const getSessionsForDate = (date: Date): Session[] => {
    return filteredSessions.filter((session) => {
      const sessionDate = new Date(session.startTime).toDateString();
      return sessionDate === date.toDateString();
    });
  };

  // Handle session actions
  const handleEditSession = (session: Session) => {
    setEditingSession(session);
    setShowCreateModal(true);
  };

  const handleDeleteSession = async (session: Session) => {
    if (!canManageSchedule) {
      notify.error("Bạn không có quyền xóa buổi học.");
      return;
    }
    if (window.confirm("Bạn có chắc muốn xóa buổi học này?")) {
      try {
        await deleteSession(session._id);
        notify.success("Đã xóa buổi học.");
      } catch (error: unknown) {
        notify.error(extractServerMessage(error));
      }
    }
  };

  const toLocalDateTime = (iso: string) => {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = `${d.getMonth() + 1}`.padStart(2, "0");
    const day = `${d.getDate()}`.padStart(2, "0");
    const h = `${d.getHours()}`.padStart(2, "0");
    const min = `${d.getMinutes()}`.padStart(2, "0");
    return `${y}-${m}-${day}T${h}:${min}`;
  };

  const openMakeupModal = (session: Session) => {
    const start = new Date(session.startTime);
    const end = new Date(session.endTime);
    const durationMs = end.getTime() - start.getTime();
    const suggestedStart = new Date(start);
    suggestedStart.setDate(suggestedStart.getDate() + 1);
    const suggestedEnd = new Date(suggestedStart.getTime() + durationMs);

    setSelectedSessionForMakeup(session);
    setMakeupReason("");
    setMakeupPolicy(MakeupConflictPolicy.BlockAll);
    setMaxConflictRatePercent(15);
    setMakeupStart(toLocalDateTime(suggestedStart.toISOString()));
    setMakeupEnd(toLocalDateTime(suggestedEnd.toISOString()));
    setPreviewResult(null);
    setSuggestedSlots([]);
    setShowMakeupModal(true);
  };

  const closeMakeupModal = () => {
    setShowMakeupModal(false);
    setSelectedSessionForMakeup(null);
    setPreviewResult(null);
    setSuggestedSlots([]);
  };

  const extractServerMessage = (error: unknown) => {
    const message = readErrorMessagePayload(error);
    if (typeof message === "string") return message;
    if (
      message &&
      typeof message === "object" &&
      "message" in message &&
      typeof message.message === "string"
    ) {
      return message.message;
    }
    return "Không thể xử lý lịch bù. Vui lòng thử lại.";
  };

  const validateMakeupInput = () => {
    if (!selectedSessionForMakeup) {
      notify.error("Không tìm thấy buổi học cần xử lý.");
      return false;
    }
    if (!makeupReason.trim()) {
      notify.warning("Vui lòng nhập lý do hủy buổi cũ.");
      return false;
    }
    if (!makeupStart || !makeupEnd) {
      notify.warning("Vui lòng chọn đầy đủ thời gian học bù.");
      return false;
    }
    const start = new Date(makeupStart);
    const end = new Date(makeupEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      notify.error("Thời gian học bù không hợp lệ.");
      return false;
    }
    if (end <= start) {
      notify.warning("Giờ kết thúc phải sau giờ bắt đầu.");
      return false;
    }
    return true;
  };

  const runMakeupAction = async (dryRun: boolean) => {
    if (!validateMakeupInput() || !selectedSessionForMakeup) return;

    setIsSubmittingMakeup(true);
    try {
      const result = await cancelAndMakeupSession(
        selectedSessionForMakeup._id,
        {
          reason: makeupReason.trim(),
          makeupStartTime: new Date(makeupStart).toISOString(),
          makeupEndTime: new Date(makeupEnd).toISOString(),
          policy: makeupPolicy,
          maxConflictRate:
            makeupPolicy === MakeupConflictPolicy.AllowWithThreshold
              ? maxConflictRatePercent / 100
              : undefined,
          dryRun,
        },
      );

      setPreviewResult(result);

      if (!dryRun) {
        const query: ScheduleQuery = {
          startDate: dateRange.start.toISOString(),
          endDate: dateRange.end.toISOString(),
        };
        if (selectedClassFilter) query.classId = selectedClassFilter;
        if (selectedTeacherFilter) query.teacherId = selectedTeacherFilter;
        if (selectedBranchFilter) query.branchId = selectedBranchFilter;
        await fetchSchedule(query);
        await fetchStatistics(
          dateRange.start.toISOString(),
          dateRange.end.toISOString(),
          selectedBranchFilter || undefined,
        );
        notify.success("Đã hủy buổi cũ và tạo buổi học bù thành công.");
        closeMakeupModal();
      } else {
        notify.info("Đã cập nhật xem trước xung đột.");
      }
    } catch (error: unknown) {
      const report = readErrorReport(error);
      if (report) {
        setPreviewResult({
          previewOnly: true,
          originalSessionId: selectedSessionForMakeup._id,
          report,
        });
      }
      notify.error(extractServerMessage(error));
    } finally {
      setIsSubmittingMakeup(false);
    }
  };

  // Close modal
  const handleCloseModal = () => {
    setShowCreateModal(false);
    setEditingSession(null);
  };

  // Render session card
  const renderSessionCard = (session: Session, compact = false) => {
    const className = getSessionClassName(session);
    const teacherName = getSessionTeacherName(session);
    const timeStr = formatSessionTime(session);

    if (compact) {
      return (
        <div
          key={session._id}
          className={`p-1.5 rounded text-xs cursor-pointer hover:opacity-80 ${getTypeColor(
            session.type,
          )}`}
          onClick={() => handleEditSession(session)}
          title={`${className} - ${teacherName}\n${timeStr}`}
        >
          <div className="font-medium truncate">{className}</div>
          <div className="text-[10px] opacity-70">{timeStr}</div>
        </div>
      );
    }

    return (
      <Card
        key={session._id}
        className="p-3 hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-blue-500"
        onClick={() => handleEditSession(session)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-gray-900 truncate">
              {className}
            </div>
            <div className="text-sm text-gray-600">{teacherName}</div>
            <div className="text-sm text-gray-500 mt-1">{timeStr}</div>
            <div className="flex gap-1.5 mt-2 flex-wrap">
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${getTypeColor(
                  session.type,
                )}`}
              >
                {session.type === SessionType.Regular
                  ? "Thường"
                  : session.type === SessionType.Makeup
                    ? "Học bù"
                    : "Kiểm tra"}
              </span>
              {session.conflictResolutionRequired &&
                session.conflictResolutionStatus === "pending" && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                    Chờ xử lý thủ công
                  </span>
                )}
            </div>
          </div>
          <div className="flex flex-col gap-1">
            {canManageSchedule &&
              session.status !== SessionStatus.Cancelled && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 text-amber-700 border-amber-200 hover:bg-amber-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    openMakeupModal(session);
                  }}
                >
                  Hủy + bù
                </Button>
              )}
            {canManageSchedule &&
              session.conflictResolutionRequired &&
              session.conflictResolutionStatus === "pending" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    markManualResolutionDone(session);
                  }}
                >
                  Đã xử lý
                </Button>
              )}
            {canManageSchedule && (
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7 text-red-600 border-red-200 hover:bg-red-50"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteSession(session);
                }}
              >
                ✕
              </Button>
            )}
          </div>
        </div>
      </Card>
    );
  };

  // Render class schedule card (from class's weekly schedule)
  const renderClassScheduleCard = (
    event: ClassScheduleEvent,
    compact = false,
  ) => {
    const colorClass = CLASS_COLORS[event.colorIndex];

    // Handler to show class detail
    const handleClickClass = () => {
      const classInfo = classes.find((c) => c._id === event.classId);
      if (classInfo) {
        setSelectedClassDetail(classInfo);
      }
    };

    if (compact) {
      return (
        <div
          key={`${event.classId}-${event.dayOfWeek}-${event.startTime}`}
          className={`p-1.5 rounded text-xs border-l-2 cursor-pointer hover:opacity-80 transition-opacity ${colorClass}`}
          title={`${event.className} - ${event.teacherName}\n${
            event.startTime
          } - ${event.endTime}${event.room ? `\nPhòng: ${event.room}` : ""}\n\nNhấn để xem chi tiết`}
          onClick={handleClickClass}
        >
          <div className="font-medium truncate">{event.className}</div>
          <div className="text-[10px] opacity-70">
            {event.startTime} - {event.endTime}
          </div>
        </div>
      );
    }

    return (
      <Card
        key={`${event.classId}-${event.dayOfWeek}-${event.startTime}`}
        className={`p-3 transition-shadow border-l-4 cursor-pointer hover:shadow-md ${colorClass}`}
        onClick={handleClickClass}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{event.className}</div>
            <div className="text-sm opacity-80">{event.teacherName}</div>
            <div className="text-sm opacity-70 mt-1">
              {event.startTime} - {event.endTime}
            </div>
            {event.room && (
              <div className="text-xs opacity-60 mt-1">📍 {event.room}</div>
            )}
            <span className="inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-medium bg-white/50">
              Lịch cố định
            </span>
          </div>
          <span className="text-xs text-gray-600">Nhấn để xem chi tiết</span>
        </div>
      </Card>
    );
  };

  // Render week view
  const renderWeekView = () => {
    const weekDates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(dateRange.start);
      d.setDate(d.getDate() + i);
      return d;
    });

    return (
      <div className="overflow-x-auto">
        <div className="min-w-225">
          {/* Header với ngày */}
          <div className="grid grid-cols-8 gap-1 mb-2">
            <div className="p-2 text-center text-sm font-medium text-gray-500">
              Giờ
            </div>
            {weekDates.map((date, i) => (
              <div
                key={i}
                className={`p-2 text-center rounded-lg ${
                  date.toDateString() === new Date().toDateString()
                    ? "bg-blue-100 text-blue-700"
                    : "bg-gray-50"
                }`}
              >
                <div className="text-xs text-gray-500">{DAYS_OF_WEEK[i]}</div>
                <div className="font-semibold">{date.getDate()}</div>
              </div>
            ))}
          </div>

          {/* Time grid */}
          <div className="border rounded-xl overflow-hidden bg-white">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="grid grid-cols-8 border-b last:border-b-0"
              >
                <div className="p-2 text-xs text-gray-400 border-r bg-gray-50 text-center">
                  {hour}:00
                </div>
                {Array.from({ length: 7 }, (_, dayIndex) => {
                  const slotSessions = getSessionsForSlot(dayIndex, hour);
                  const slotClassSchedules = getClassSchedulesForSlot(
                    dayIndex,
                    hour,
                  );
                  return (
                    <div
                      key={dayIndex}
                      className="min-h-15 p-1 border-r last:border-r-0 hover:bg-gray-50 space-y-1"
                    >
                      {/* Render class schedules (recurring) */}
                      {slotClassSchedules.map((event) =>
                        renderClassScheduleCard(event, true),
                      )}
                      {/* Render sessions (one-time events) */}
                      {slotSessions.map((session) =>
                        renderSessionCard(session, true),
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Render month view
  const renderMonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDayOfWeek = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
    const daysInMonth = lastDay.getDate();

    const weeks: Date[][] = [];
    let currentWeek: Date[] = [];

    // Fill empty days at start
    for (let i = 0; i < startDayOfWeek; i++) {
      const d = new Date(firstDay);
      d.setDate(d.getDate() - (startDayOfWeek - i));
      currentWeek.push(d);
    }

    // Fill days of month
    for (let day = 1; day <= daysInMonth; day++) {
      currentWeek.push(new Date(year, month, day));
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    // Fill remaining days
    if (currentWeek.length > 0) {
      let nextDay = 1;
      while (currentWeek.length < 7) {
        currentWeek.push(new Date(year, month + 1, nextDay++));
      }
      weeks.push(currentWeek);
    }

    return (
      <div className="bg-white rounded-xl border overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-7 bg-gray-50 border-b">
          {DAYS_OF_WEEK.map((day) => (
            <div
              key={day}
              className="p-2 text-center text-sm font-medium text-gray-600"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Weeks */}
        {weeks.map((week, weekIndex) => (
          <div
            key={weekIndex}
            className="grid grid-cols-7 border-b last:border-b-0"
          >
            {week.map((date, dayIndex) => {
              const isCurrentMonth = date.getMonth() === month;
              const isToday = date.toDateString() === new Date().toDateString();
              const daySessions = getSessionsForDate(date);
              const dayClassSchedules = getClassSchedulesForDate(date);
              const totalItems = daySessions.length + dayClassSchedules.length;

              return (
                <div
                  key={dayIndex}
                  className={`min-h-25 p-1 border-r last:border-r-0 ${
                    !isCurrentMonth ? "bg-gray-50" : ""
                  }`}
                >
                  <div
                    className={`text-sm mb-1 text-center ${
                      isToday
                        ? "w-6 h-6 rounded-full bg-blue-600 text-white mx-auto flex items-center justify-center"
                        : !isCurrentMonth
                          ? "text-gray-300"
                          : "text-gray-700"
                    }`}
                  >
                    {date.getDate()}
                  </div>
                  <div className="space-y-1">
                    {/* Render class schedules first */}
                    {dayClassSchedules
                      .slice(0, 2)
                      .map((event) => renderClassScheduleCard(event, true))}
                    {/* Then render sessions */}
                    {daySessions
                      .slice(0, Math.max(0, 3 - dayClassSchedules.length))
                      .map((session) => renderSessionCard(session, true))}
                    {totalItems > 3 && (
                      <div className="text-xs text-gray-500 text-center">
                        +{totalItems - 3} khác
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  };

  // Render list view
  const renderListView = () => {
    const groupedByDate = filteredSessions.reduce(
      (acc, session) => {
        const dateKey = new Date(session.startTime).toDateString();
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(session);
        return acc;
      },
      {} as Record<string, Session[]>,
    );

    const sortedDates = Object.keys(groupedByDate).sort(
      (a, b) => new Date(a).getTime() - new Date(b).getTime(),
    );

    if (sortedDates.length === 0) {
      return (
        <div className="text-center py-12 text-gray-500">
          <div className="text-4xl mb-3">📅</div>
          <p>Không có buổi học nào trong khoảng thời gian này</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {sortedDates.map((dateKey) => (
          <div key={dateKey}>
            <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              {new Date(dateKey).toLocaleDateString("vi-VN", {
                weekday: "long",
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
              <span className="text-sm font-normal text-gray-400">
                ({groupedByDate[dateKey].length} buổi)
              </span>
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {groupedByDate[dateKey].map((session) =>
                renderSessionCard(session),
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            📅 Quản lý Lịch dạy học
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Xem lịch các lớp và tạo buổi học bất thường (học bù, kiểm tra)
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
          >
            ➕ Thêm buổi học bất thường
          </Button>
        </div>
      </div>

      {/* Statistics */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-4 bg-linear-to-br from-blue-50 to-indigo-50 border-blue-100">
            <div className="text-sm text-gray-600">Tổng buổi học</div>
            <div className="text-2xl font-bold text-blue-700">
              {statistics.total}
            </div>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <select
            value={selectedClassFilter}
            onChange={(e) => setSelectedClassFilter(e.target.value)}
            className="nice-select px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tất cả lớp</option>
            {classes.map((c: Class) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            value={selectedTeacherFilter}
            onChange={(e) => setSelectedTeacherFilter(e.target.value)}
            className="nice-select px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tất cả giáo viên</option>
            {teachers.map((t) => (
              <option key={t._id} value={t._id}>
                {t.name}
              </option>
            ))}
          </select>

          <select
            value={selectedBranchFilter}
            onChange={(e) => setSelectedBranchFilter(e.target.value)}
            className="nice-select px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tất cả cơ sở</option>
            {branches.map((b) => (
              <option key={b._id} value={b._id}>
                {b.name}
              </option>
            ))}
          </select>

          {(selectedClassFilter ||
            selectedTeacherFilter ||
            selectedBranchFilter) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedClassFilter("");
                setSelectedTeacherFilter("");
                setSelectedBranchFilter("");
              }}
              className="text-gray-500"
            >
              Xóa bộ lọc
            </Button>
          )}

          <label className="inline-flex items-center gap-2 text-sm text-gray-700 border rounded-lg px-3 py-2">
            <input
              type="checkbox"
              checked={showManualResolutionOnly}
              onChange={(e) => setShowManualResolutionOnly(e.target.checked)}
              className="rounded"
            />
            Chỉ hiển thị buổi bù chờ xử lý thủ công
          </label>
        </div>
      </Card>

      {/* Navigation & View Mode */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={navigatePrev}>
            ←
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Hôm nay
          </Button>
          <Button variant="outline" size="sm" onClick={navigateNext}>
            →
          </Button>
          <span className="ml-2 font-semibold text-gray-700">
            {viewMode === "week"
              ? `${formatDisplayDate(dateRange.start)} - ${formatDisplayDate(
                  dateRange.end,
                )}`
              : currentDate.toLocaleDateString("vi-VN", {
                  month: "long",
                  year: "numeric",
                })}
          </span>
        </div>

        <Tabs
          value={viewMode}
          onValueChange={(v) => setViewMode(v as "week" | "month" | "list")}
        >
          <TabsList className="bg-gray-100">
            <TabsTrigger value="week" className="text-sm">
              📅 Tuần
            </TabsTrigger>
            <TabsTrigger value="month" className="text-sm">
              📆 Tháng
            </TabsTrigger>
            <TabsTrigger value="list" className="text-sm">
              📋 Danh sách
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Error display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
          <span className="text-red-700">{error}</span>
          <Button variant="outline" size="sm" onClick={clearError}>
            Đóng
          </Button>
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-500 mt-2">Đang tải...</p>
        </div>
      )}

      {/* Calendar Views */}
      {!isLoading && (
        <Card className="p-4">
          {viewMode === "week" && renderWeekView()}
          {viewMode === "month" && renderMonthView()}
          {viewMode === "list" && renderListView()}
        </Card>
      )}

      {/* Modals */}
      {showCreateModal && (
        <SessionFormModal
          session={editingSession}
          classes={classes}
          branches={branches}
          onClose={handleCloseModal}
        />
      )}

      {/* Class Detail Modal */}
      {selectedClassDetail && (
        <ClassDetailModal
          classData={selectedClassDetail}
          canManageFixedSchedule={canManageSchedule}
          onDeleteFixedSchedule={async (_schedule, index, reason) => {
            await removeFixedScheduleFromClassDetail(index, reason);
          }}
          onClose={() => setSelectedClassDetail(null)}
        />
      )}

      {showMakeupModal && selectedSessionForMakeup && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <Card className="w-full max-w-3xl p-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Hủy buổi và xếp lịch học bù
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Buổi gốc:{" "}
                  <span className="font-medium">
                    {getSessionClassName(selectedSessionForMakeup)}
                  </span>{" "}
                  - {formatSessionTime(selectedSessionForMakeup)}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={closeMakeupModal}>
                Đóng
              </Button>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Thời gian học bù bắt đầu
                </label>
                <input
                  type="datetime-local"
                  value={makeupStart}
                  onChange={(e) => {
                    setMakeupStart(e.target.value);
                    setPreviewResult(null);
                    setSuggestedSlots([]);
                  }}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Thời gian học bù kết thúc
                </label>
                <input
                  type="datetime-local"
                  value={makeupEnd}
                  onChange={(e) => {
                    setMakeupEnd(e.target.value);
                    setPreviewResult(null);
                    setSuggestedSlots([]);
                  }}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lý do hủy buổi cũ
              </label>
              <textarea
                value={makeupReason}
                onChange={(e) => {
                  setMakeupReason(e.target.value);
                  setPreviewResult(null);
                  setSuggestedSlots([]);
                }}
                rows={3}
                placeholder="Ví dụ: Nghỉ lễ, giáo viên bận đột xuất..."
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="mt-4 grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Chính sách xử lý trùng học sinh
                </label>
                <select
                  value={makeupPolicy}
                  onChange={(e) => {
                    setMakeupPolicy(e.target.value as MakeupConflictPolicy);
                    setPreviewResult(null);
                    setSuggestedSlots([]);
                  }}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value={MakeupConflictPolicy.BlockAll}>
                    Chặn toàn bộ nếu có trùng
                  </option>
                  <option value={MakeupConflictPolicy.AllowWithThreshold}>
                    Cho phép theo ngưỡng trùng
                  </option>
                  <option
                    value={MakeupConflictPolicy.AllowWithManualResolution}
                  >
                    Cho phép và xử lý thủ công
                  </option>
                </select>
              </div>

              {makeupPolicy === MakeupConflictPolicy.AllowWithThreshold && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ngưỡng tối đa học sinh trùng (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={maxConflictRatePercent}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setMaxConflictRatePercent(Number.isNaN(v) ? 0 : v);
                      setPreviewResult(null);
                      setSuggestedSlots([]);
                    }}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>

            <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-sky-900">
                    Gợi ý khung giờ tối ưu
                  </div>
                  <div className="text-xs text-sky-700 mt-1">
                    Hệ thống thử nhiều khung giờ gần nhất và chọn 3 phương án có
                    xung đột thấp nhất.
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={generateSuggestedSlots}
                  disabled={isGeneratingSuggestions || isSubmittingMakeup}
                  className="border-sky-300 text-sky-800 hover:bg-sky-100"
                >
                  {isGeneratingSuggestions
                    ? "Đang phân tích..."
                    : "Gợi ý 3 khung giờ"}
                </Button>
              </div>

              {suggestedSlots.length > 0 && (
                <div className="mt-3 grid md:grid-cols-3 gap-2">
                  {suggestedSlots.map((slot) => (
                    <button
                      key={`${slot.startTime}-${slot.endTime}`}
                      className="text-left rounded-lg border border-sky-200 bg-white p-3 hover:border-sky-400 hover:bg-sky-50 transition-colors"
                      onClick={() => applySuggestedSlot(slot)}
                    >
                      <div className="text-sm font-semibold text-gray-900">
                        {new Date(slot.startTime).toLocaleDateString("vi-VN")}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {new Date(slot.startTime).toLocaleTimeString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {" - "}
                        {new Date(slot.endTime).toLocaleTimeString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                      <div className="text-[11px] text-sky-700 mt-2">
                        Trùng học sinh: {slot.report.conflictingStudentCount}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {previewResult && (
              <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700">
                    Sĩ số: {previewResult.report.totalStudents}
                  </span>
                  <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-700">
                    Trùng học sinh:{" "}
                    {previewResult.report.conflictingStudentCount}
                  </span>
                  <span className="px-2 py-1 rounded-full bg-slate-200 text-slate-700">
                    Tỷ lệ:{" "}
                    {(previewResult.report.conflictRate * 100).toFixed(1)}%
                  </span>
                </div>

                {!previewResult.report.policyDecision.canCreate && (
                  <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                    Không thể chuyển lịch:{" "}
                    {previewResult.report.policyDecision.reason ||
                      "vi phạm chính sách"}
                  </div>
                )}

                {previewResult.report.policyDecision
                  .requiresManualResolution && (
                  <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    Có học sinh trùng lịch. Buổi bù vẫn tạo được nhưng admin cần
                    xử lý thủ công danh sách bên dưới.
                  </div>
                )}

                {previewResult.report.teacherConflicts.length > 0 && (
                  <div className="text-sm text-red-700">
                    Giáo viên bị trùng{" "}
                    {previewResult.report.teacherConflicts.length} buổi ở khung
                    giờ này.
                  </div>
                )}

                {previewResult.report.roomConflicts.length > 0 && (
                  <div className="text-sm text-red-700">
                    Phòng học bị trùng{" "}
                    {previewResult.report.roomConflicts.length} buổi ở khung giờ
                    này.
                  </div>
                )}

                {previewResult.report.conflictStudents.length > 0 && (
                  <div>
                    <div className="text-sm font-medium text-gray-800 mb-2">
                      Danh sách học sinh trùng lịch
                    </div>
                    <div className="max-h-44 overflow-auto rounded-lg border border-gray-200 bg-white">
                      {previewResult.report.conflictStudents.map((item) => (
                        <div
                          key={`${item.studentId}-${item.conflictingSessionId}`}
                          className="px-3 py-2 text-sm border-b last:border-b-0"
                        >
                          <span className="font-medium">
                            {item.studentName}
                          </span>{" "}
                          trùng với lớp {item.conflictingClassName}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => runMakeupAction(true)}
                disabled={isSubmittingMakeup}
              >
                Xem trước xung đột
              </Button>
              <Button
                onClick={() => runMakeupAction(false)}
                disabled={
                  isSubmittingMakeup ||
                  (previewResult !== null &&
                    !previewResult.report.policyDecision.canCreate)
                }
                className="bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700"
              >
                {isSubmittingMakeup
                  ? "Đang xử lý..."
                  : "Xác nhận hủy và tạo buổi bù"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
