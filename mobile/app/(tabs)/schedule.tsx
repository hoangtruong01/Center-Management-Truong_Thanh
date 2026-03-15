import { useEffect, useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
  Modal,
  FlatList,
  TextInput,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import {
  useScheduleStore,
  useAuthStore,
  useClassesStore,
  useBranchesStore,
  useUsersStore,
  useAttendanceStore,
  useSessionsStore,
  useChildrenStore,
} from "@/lib/stores";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Platform } from "react-native";
import { subjects, getSubjectLabel } from "@/lib/constants/subjects";
import api from "@/lib/api";
import ChildSelector from "@/components/ChildSelector";
import { notificationService } from "@/lib/services/notification.service";

const { width } = Dimensions.get("window");

const daysOfWeek = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const fullDaysOfWeek = [
  "Chủ nhật",
  "Thứ hai",
  "Thứ ba",
  "Thứ tư",
  "Thứ năm",
  "Thứ sáu",
  "Thứ bảy",
];

// Helper function to get week date range
function getWeekRange(date: Date) {
  const dayOfWeek = date.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(date);
  monday.setDate(date.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { startDate: monday.toISOString(), endDate: sunday.toISOString() };
}

// Status colors matching web
const getStatusConfig = (status?: string) => {
  switch (status) {
    case "present":
      return {
        colors: ["#10B981", "#059669"],
        icon: "checkmark-circle",
        label: "Có mặt",
      };
    case "absent":
      return {
        colors: ["#EF4444", "#DC2626"],
        icon: "close-circle",
        label: "Vắng",
      };
    case "late":
      return { colors: ["#F59E0B", "#D97706"], icon: "time", label: "Đi trễ" };
    case "excused":
      return {
        colors: ["#8B5CF6", "#7C3AED"],
        icon: "document-text",
        label: "Có phép",
      };
    case "approved":
      return {
        colors: ["#10B981", "#059669"],
        icon: "checkmark-circle",
        label: "Đã xác nhận",
      };
    case "pending":
      return {
        colors: ["#F59E0B", "#D97706"],
        icon: "time",
        label: "Chờ duyệt",
      };
    case "cancelled":
      return {
        colors: ["#EF4444", "#DC2626"],
        icon: "close-circle",
        label: "Đã hủy",
      };
    default:
      return {
        colors: ["#3B82F6", "#2563EB"],
        icon: "calendar",
        label: "Sắp tới",
      };
  }
};

interface TimetableItem {
  classId: string;
  className: string;
  subject: string;
  startTime: string;
  endTime: string;
  room?: string;
  teacherName?: string;
  branchName?: string;
  colorIndex?: number;
  // Irregular session fields
  sessionId?: string;
  sessionTitle?: string;
  sessionType?: "makeup" | "exam";
  isIrregular?: boolean;
}

// Class colors for admin view
const CLASS_COLORS: [string, string][] = [
  ["#3B82F6", "#2563EB"],
  ["#10B981", "#059669"],
  ["#8B5CF6", "#7C3AED"],
  ["#F59E0B", "#D97706"],
  ["#EC4899", "#DB2777"],
  ["#14B8A6", "#0D9488"],
  ["#6366F1", "#4F46E5"],
  ["#F43F5E", "#E11D48"],
  ["#06B6D4", "#0891B2"],
  ["#84CC16", "#65A30D"],
];

// Time slots for admin timetable (7:00 - 21:00)
const TIME_SLOTS = [
  "07:00",
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
];

export default function ScheduleScreen() {
  const {
    sessions,
    isLoading: sessionsLoading,
    fetchTeacherSchedule,
    fetchStudentSchedule,
  } = useScheduleStore();
  const {
    classes,
    isLoading: classesLoading,
    fetchClasses,
  } = useClassesStore();
  const { branches, fetchBranches } = useBranchesStore();
  const { users, fetchUsers } = useUsersStore();
  const { user } = useAuthStore();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [weekOffset, setWeekOffset] = useState(0);

  // Admin filters
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showBranchPicker, setShowBranchPicker] = useState(false);
  const [showClassPicker, setShowClassPicker] = useState(false);
  const [viewMode, setViewMode] = useState<"day" | "list">("day"); // Admin view modes
  const [selectedClassDetail, setSelectedClassDetail] = useState<any>(null);
  const [showClassDetailModal, setShowClassDetailModal] = useState(false);

  // Teacher attendance states
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [attendanceClassId, setAttendanceClassId] = useState<string | null>(
    null,
  );
  const [attendanceRecords, setAttendanceRecords] = useState<
    {
      studentId: string;
      name: string;
      email: string;
      status: "present" | "absent" | "late" | "excused" | null;
    }[]
  >([]);
  const [attendanceNote, setAttendanceNote] = useState("");
  const [isSavingAttendance, setIsSavingAttendance] = useState(false);
  const [selectedScheduleItem, setSelectedScheduleItem] =
    useState<TimetableItem | null>(null);

  // Teacher view mode: day view only
  const [teacherViewMode, setTeacherViewMode] = useState<"week" | "day">("day");

  // Admin: Add irregular session states
  const {
    createSession: createNewSession,
    fetchSessions,
    sessions: extraSessions,
  } = useSessionsStore();
  const [adminExtraSessions, setAdminExtraSessions] = useState<any[]>([]);
  const [teacherExtraSessions, setTeacherExtraSessions] = useState<any[]>([]);
  const [showCreateSessionModal, setShowCreateSessionModal] = useState(false);
  const [sessionForm, setSessionForm] = useState({
    branchId: "",
    classId: "",
    teacherId: "",
    subject: "",
    title: "",
    room: "",
    date: new Date(),
    startTime: "08:00",
    endTime: "09:30",
    type: "makeup" as "makeup" | "exam",
    note: "",
  });
  const [showSessionDatePicker, setShowSessionDatePicker] = useState(false);
  const [showSessionStartTimePicker, setShowSessionStartTimePicker] =
    useState(false);
  const [showSessionEndTimePicker, setShowSessionEndTimePicker] =
    useState(false);
  const [activeSessionPicker, setActiveSessionPicker] = useState<
    "branch" | "class" | "teacher" | null
  >(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  const isAdmin = user?.role === "admin";
  const isTeacher = user?.role === "teacher";
  const isLoading = sessionsLoading || classesLoading;

  // Calculate current week based on offset
  const currentWeekStart = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday + weekOffset * 7);
    monday.setHours(0, 0, 0, 0);
    return monday;
  }, [weekOffset]);

  // Multi-child support for parent
  const { children, selectedChild, fetchChildren } = useChildrenStore();

  // State to store attendance records for student/parent
  const [studentAttendanceRecords, setStudentAttendanceRecords] = useState<
    any[]
  >([]);

  // Fetch children for parent on mount
  useEffect(() => {
    if (user?.role === "parent" && user?._id) {
      fetchChildren(user._id);
    }
  }, [user]);

  useEffect(() => {
    loadSchedule();
  }, [user, weekOffset, selectedChild?._id]);

  useEffect(() => {
    if (isAdmin) {
      fetchBranches();
      fetchUsers({ role: "teacher" });
    }
  }, [isAdmin]);

  const loadSchedule = async () => {
    if (!user) return;

    if (user.role === "teacher" || user.role === "admin") {
      // Fetch classes for teacher/admin to build timetable
      await fetchClasses();
      // For admin, also fetch irregular sessions for the current week
      if (user.role === "admin") {
        try {
          const { startDate, endDate } = getWeekRange(currentWeekStart);
          const res = await api.get("/sessions/schedule", {
            params: { startDate, endDate },
          });
          const data = res.data;
          setAdminExtraSessions(
            Array.isArray(data)
              ? data.filter(
                  (s: any) => s.type === "makeup" || s.type === "exam",
                )
              : [],
          );
        } catch {
          setAdminExtraSessions([]);
        }
      }
      // For teacher, fetch irregular sessions assigned to them
      if (user.role === "teacher") {
        try {
          const { startDate, endDate } = getWeekRange(currentWeekStart);
          const res = await api.get("/sessions/schedule", {
            params: { startDate, endDate, teacherId: user._id },
          });
          const data = res.data;
          setTeacherExtraSessions(
            Array.isArray(data)
              ? data.filter(
                  (s: any) => s.type === "makeup" || s.type === "exam",
                )
              : [],
          );
        } catch {
          setTeacherExtraSessions([]);
        }
      }
    } else if (user.role === "student") {
      // Fetch classes to get schedule for student
      await fetchClasses();
      // Also fetch sessions for attendance status
      const { startDate, endDate } = getWeekRange(currentWeekStart);
      await fetchStudentSchedule(user._id, startDate, endDate);
      // Fetch attendance records for student
      try {
        const attendanceRes = await api.get("/attendance", {
          params: { studentId: user._id },
        });
        setStudentAttendanceRecords(
          Array.isArray(attendanceRes.data) ? attendanceRes.data : [],
        );
      } catch (error) {
        console.error("Error fetching attendance records:", error);
        setStudentAttendanceRecords([]);
      }
    } else if (user.role === "parent") {
      // For parent, use selected child from children store
      const cId = selectedChild?._id;
      if (cId) {
        await fetchClasses(undefined, cId);
        const { startDate, endDate } = getWeekRange(currentWeekStart);
        await fetchStudentSchedule(cId, startDate, endDate);
        // Fetch attendance records for child
        try {
          const attendanceRes = await api.get("/attendance", {
            params: { studentId: cId },
          });
          setStudentAttendanceRecords(
            Array.isArray(attendanceRes.data) ? attendanceRes.data : [],
          );
        } catch (error) {
          console.error("Error fetching attendance records:", error);
          setStudentAttendanceRecords([]);
        }
      }
      // If no selectedChild yet, wait for children store to load
    }
  };

  const onRefresh = async () => {
    await loadSchedule();
  };

  // Generate dates for the week
  const getWeekDates = () => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(currentWeekStart.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const weekDates = getWeekDates();

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isSelected = (date: Date) => {
    return date.toDateString() === selectedDate.toDateString();
  };

  const formatDate = (date: Date) => {
    return date.getDate().toString();
  };

  // Build timetable for teacher from class schedules
  // Build timetable for teacher from class schedules
  const teacherTimetable = useMemo((): TimetableItem[] => {
    if (user?.role !== "teacher") return [];

    const dayIndex = selectedDate.getDay();
    const timetable: TimetableItem[] = [];

    // Filter classes taught by this teacher
    const teacherClasses = classes.filter((cls) => {
      const teacherId =
        typeof cls.teacherId === "object" && cls.teacherId
          ? (cls.teacherId as any)._id
          : cls.teacherId;
      return teacherId === user._id;
    });

    teacherClasses.forEach((cls) => {
      if (cls.schedule && cls.schedule.length > 0) {
        cls.schedule.forEach((sch) => {
          if (sch.dayOfWeek === dayIndex) {
            timetable.push({
              classId: cls._id,
              className: cls.name,
              subject: cls.subject || "Chưa xác định",
              startTime: sch.startTime,
              endTime: sch.endTime,
              room: undefined,
            });
          }
        });
      }
    });

    // Sort by start time
    timetable.sort((a, b) => a.startTime.localeCompare(b.startTime));

    // Add irregular sessions assigned to this teacher for selected date
    const toHHMM = (d: Date) =>
      `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
    teacherExtraSessions.forEach((session: any) => {
      if (!session.startTime) return;
      const sessDate = new Date(session.startTime);
      if (
        sessDate.getDate() === selectedDate.getDate() &&
        sessDate.getMonth() === selectedDate.getMonth() &&
        sessDate.getFullYear() === selectedDate.getFullYear()
      ) {
        const classId =
          typeof session.classId === "object"
            ? session.classId?._id || ""
            : session.classId || "";
        const classObj = classes.find((c) => c._id === classId);
        timetable.push({
          classId,
          className:
            typeof session.classId === "object"
              ? session.classId?.name || "Buổi học bất thường"
              : classObj?.name || "Buổi học bất thường",
          subject:
            typeof session.classId === "object"
              ? session.classId?.subject || "Chưa xác định"
              : classObj?.subject || "Chưa xác định",
          startTime: toHHMM(sessDate),
          endTime: toHHMM(new Date(session.endTime)),
          room: session.room,
          sessionId: session._id,
          sessionTitle: session.title,
          sessionType: session.type as "makeup" | "exam",
          isIrregular: true,
        });
      }
    });
    timetable.sort((a, b) => a.startTime.localeCompare(b.startTime));

    return timetable;
  }, [classes, selectedDate, user, teacherExtraSessions]);

  // Build timetable by week for teacher (giống web)
  interface DaySchedule {
    day: string;
    date: string;
    schedules: (TimetableItem & { studentCount: number })[];
    fullDate: Date;
  }

  const teacherTimetableByWeek = useMemo((): DaySchedule[] => {
    if (user?.role !== "teacher") return [];

    const dayNamesVN = [
      "CHỦ NHẬT",
      "THỨ HAI",
      "THỨ BA",
      "THỨ TƯ",
      "THỨ NĂM",
      "THỨ SÁU",
      "THỨ BẢY",
    ];

    const days: DaySchedule[] = [];

    // Filter classes taught by this teacher
    const teacherClasses = classes.filter((cls) => {
      const teacherId =
        typeof cls.teacherId === "object" && cls.teacherId
          ? (cls.teacherId as any)._id
          : cls.teacherId;
      return teacherId === user._id;
    });

    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(currentWeekStart.getDate() + i);
      const dayIndex = date.getDay();

      // Find all class schedules for this day
      const daySchedules: (TimetableItem & { studentCount: number })[] = [];

      teacherClasses.forEach((cls) => {
        if (cls.schedule && cls.schedule.length > 0) {
          cls.schedule.forEach((sch) => {
            if (sch.dayOfWeek === dayIndex) {
              const studentCount =
                cls.students?.length || cls.studentIds?.length || 0;
              daySchedules.push({
                classId: cls._id,
                className: cls.name,
                subject: cls.subject || "Chưa xác định",
                startTime: sch.startTime,
                endTime: sch.endTime,
                room: sch.room,
                studentCount,
              });
            }
          });
        }
      });

      // Add irregular sessions for this day
      const toHHMM2 = (d: Date) =>
        `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
      teacherExtraSessions.forEach((session: any) => {
        if (!session.startTime) return;
        const sessDate = new Date(session.startTime);
        if (
          sessDate.getDate() === date.getDate() &&
          sessDate.getMonth() === date.getMonth() &&
          sessDate.getFullYear() === date.getFullYear()
        ) {
          const classId =
            typeof session.classId === "object"
              ? session.classId?._id || ""
              : session.classId || "";
          const classObj = classes.find((c) => c._id === classId);
          daySchedules.push({
            classId,
            className:
              typeof session.classId === "object"
                ? session.classId?.name || "Buổi học bất thường"
                : classObj?.name || "Buổi học bất thường",
            subject:
              typeof session.classId === "object"
                ? session.classId?.subject || "Chưa xác định"
                : classObj?.subject || "Chưa xác định",
            startTime: toHHMM2(sessDate),
            endTime: toHHMM2(new Date(session.endTime)),
            room: session.room,
            studentCount: classObj?.students?.length || classObj?.studentIds?.length || 0,
            sessionId: session._id,
            sessionTitle: session.title,
            sessionType: session.type as "makeup" | "exam",
            isIrregular: true,
          });
        }
      });

      // Sort by start time
      daySchedules.sort((a, b) => a.startTime.localeCompare(b.startTime));

      days.push({
        day: dayNamesVN[dayIndex],
        date: date.toLocaleDateString("vi-VN", {
          day: "2-digit",
          month: "2-digit",
        }),
        schedules: daySchedules,
        fullDate: date,
      });
    }

    // Reorder so Monday is first
    const mondayIndex = days.findIndex((d) => d.day === "THỨ HAI");
    return [...days.slice(mondayIndex), ...days.slice(0, mondayIndex)];
  }, [classes, currentWeekStart, user, teacherExtraSessions]);

  // Build timetable for admin - all classes with filters
  const adminTimetable = useMemo((): TimetableItem[] => {
    if (user?.role !== "admin") return [];

    const dayIndex = selectedDate.getDay();
    const timetable: TimetableItem[] = [];

    // Apply filters
    let filteredClasses: any[] = classes;

    if (selectedBranch) {
      filteredClasses = filteredClasses.filter((cls) => {
        const branchId =
          typeof cls.branchId === "string" ? cls.branchId : cls.branchId?._id;
        return branchId === selectedBranch;
      });
    }

    if (selectedClass) {
      filteredClasses = filteredClasses.filter(
        (cls) => cls._id === selectedClass,
      );
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredClasses = filteredClasses.filter(
        (cls) =>
          cls.name.toLowerCase().includes(query) ||
          (cls.subject && cls.subject.toLowerCase().includes(query)),
      );
    }

    filteredClasses.forEach((cls, classIndex) => {
      const teacherName =
        typeof cls.teacherId === "object" && cls.teacherId?.name
          ? cls.teacherId.name
          : users.find((u) => u._id === cls.teacherId)?.name ||
            "Chưa phân công";

      const branchName =
        typeof cls.branchId === "object" && cls.branchId?.name
          ? cls.branchId.name
          : branches.find((b) => b._id === cls.branchId)?.name || "";

      if (cls.schedule && cls.schedule.length > 0) {
        cls.schedule.forEach((sch: any) => {
          if (sch.dayOfWeek === dayIndex) {
            timetable.push({
              classId: cls._id,
              className: cls.name,
              subject: cls.subject || "Chưa xác định",
              startTime: sch.startTime,
              endTime: sch.endTime,
              room: sch.room,
              teacherName,
              branchName,
              colorIndex: classIndex % CLASS_COLORS.length,
            });
          }
        });
      }
    });

    // Sort by start time
    timetable.sort((a, b) => a.startTime.localeCompare(b.startTime));

    // Add irregular sessions (makeup / exam) for the selected date
    adminExtraSessions.forEach((session: any) => {
      if (!session.startTime) return;
      const sessionDate = new Date(session.startTime);
      if (
        sessionDate.getDate() === selectedDate.getDate() &&
        sessionDate.getMonth() === selectedDate.getMonth() &&
        sessionDate.getFullYear() === selectedDate.getFullYear()
      ) {
        const classId =
          typeof session.classId === "object"
            ? session.classId?._id || ""
            : session.classId || "";
        const classObj = classes.find((c) => c._id === classId);
        const teacherName =
          typeof session.teacherId === "object" && session.teacherId
            ? session.teacherId.fullName || session.teacherId.name || ""
            : users.find((u) => u._id === session.teacherId)?.name || "";
        const branchName = classObj
          ? typeof classObj.branchId === "object" &&
            (classObj.branchId as any)?.name
            ? (classObj.branchId as any).name
            : branches.find((b) => b._id === classObj.branchId)?.name || ""
          : "";
        const toHHMM = (d: Date) =>
          `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
        timetable.push({
          classId,
          className:
            typeof session.classId === "object"
              ? session.classId.name || "Buổi học bất thường"
              : classObj?.name || "Buổi học bất thường",
          subject:
            typeof session.classId === "object"
              ? session.classId.subject || session.subject || "Chưa xác định"
              : classObj?.subject || session.subject || "Chưa xác định",
          startTime: toHHMM(sessionDate),
          endTime: toHHMM(new Date(session.endTime)),
          room: session.room,
          teacherName,
          branchName,
          colorIndex: timetable.length % CLASS_COLORS.length,
          sessionId: session._id,
          sessionTitle: session.title,
          sessionType: session.type as "makeup" | "exam",
          isIrregular: true,
        });
      }
    });

    // Re-sort after adding irregular sessions
    timetable.sort((a, b) => a.startTime.localeCompare(b.startTime));
    return timetable;
  }, [
    classes,
    selectedDate,
    user,
    selectedBranch,
    selectedClass,
    searchQuery,
    users,
    branches,
    adminExtraSessions,
  ]);

  // Admin list view - all classes regardless of selected day
  const adminClassList = useMemo(() => {
    if (user?.role !== "admin") return [];

    let filteredClasses: any[] = classes;

    if (selectedBranch) {
      filteredClasses = filteredClasses.filter((cls) => {
        const branchId =
          typeof cls.branchId === "string" ? cls.branchId : cls.branchId?._id;
        return branchId === selectedBranch;
      });
    }

    if (selectedClass) {
      filteredClasses = filteredClasses.filter(
        (cls) => cls._id === selectedClass,
      );
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredClasses = filteredClasses.filter(
        (cls) =>
          cls.name.toLowerCase().includes(query) ||
          (cls.subject && cls.subject.toLowerCase().includes(query)),
      );
    }

    return filteredClasses.map((cls, index) => {
      const teacherName =
        typeof cls.teacherId === "object" && cls.teacherId?.name
          ? cls.teacherId.name
          : users.find((u) => u._id === cls.teacherId)?.name ||
            "Chưa phân công";

      const branchName =
        typeof cls.branchId === "object" && cls.branchId?.name
          ? cls.branchId.name
          : branches.find((b) => b._id === cls.branchId)?.name || "";

      return {
        ...cls,
        teacherName,
        branchName,
        colorIndex: index % CLASS_COLORS.length,
      };
    });
  }, [
    classes,
    user,
    selectedBranch,
    selectedClass,
    searchQuery,
    users,
    branches,
  ]);

  // Filter sessions by selected date (for students)
  const filteredSessions = useMemo(() => {
    if (user?.role === "teacher") return [];

    return sessions.filter((session) => {
      const sessionDate = new Date(session.startTime);
      return (
        sessionDate.getDate() === selectedDate.getDate() &&
        sessionDate.getMonth() === selectedDate.getMonth() &&
        sessionDate.getFullYear() === selectedDate.getFullYear()
      );
    });
  }, [sessions, selectedDate, user]);

  // Build timetable for student from class schedules (when no sessions available)
  const studentTimetable = useMemo((): (TimetableItem & {
    attendanceStatus?: string;
  })[] => {
    if (user?.role !== "student" && user?.role !== "parent") return [];

    const dayIndex = selectedDate.getDay();
    const timetable: (TimetableItem & { attendanceStatus?: string })[] = [];

    // For parent, use selectedChild._id; for student, use user._id
    const targetStudentId =
      user?.role === "parent" ? selectedChild?._id : user?._id;

    // Filter classes where student is enrolled
    // For parent: API already returns child's classes, so we can use all classes
    // For student: filter by studentIds
    const studentClasses =
      user?.role === "parent"
        ? classes // Parent: classes already filtered by selectedChild from API
        : classes.filter((cls) => {
            // Check if user is in studentIds
            if (cls.studentIds && cls.studentIds.includes(user._id))
              return true;
            // Check if user is in students array
            if (cls.students && cls.students.some((s) => s._id === user._id))
              return true;
            return false;
          });

    studentClasses.forEach((cls, classIndex) => {
      const teacherName =
        typeof cls.teacherId === "object" && cls.teacherId
          ? (cls.teacherId as any).fullName ||
            (cls.teacherId as any).name ||
            "Giáo viên"
          : "Giáo viên";

      if (cls.schedule && cls.schedule.length > 0) {
        cls.schedule.forEach((sch) => {
          if (sch.dayOfWeek === dayIndex) {
            // Check if there's attendance for this class and date from attendance records
            let attendanceStatus: string | undefined = undefined;

            // First, try to find attendance from studentAttendanceRecords
            const attendanceRecord = studentAttendanceRecords.find((r) => {
              // Check if attendance record matches this class
              const recordClassId =
                typeof r.sessionId === "object" && r.sessionId?.classId
                  ? typeof r.sessionId.classId === "object"
                    ? r.sessionId.classId._id
                    : r.sessionId.classId
                  : null;

              // Also check by date
              if (r.sessionId?.startTime) {
                const attDate = new Date(r.sessionId.startTime);
                return (
                  (recordClassId === cls._id || r.classId === cls._id) &&
                  attDate.getDate() === selectedDate.getDate() &&
                  attDate.getMonth() === selectedDate.getMonth() &&
                  attDate.getFullYear() === selectedDate.getFullYear()
                );
              }
              return false;
            });

            if (attendanceRecord) {
              attendanceStatus = attendanceRecord.status;
            } else {
              // Determine status based on time
              const now = new Date();
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const selDate = new Date(selectedDate);
              selDate.setHours(0, 0, 0, 0);

              // Parse start/end times
              const [startH, startM] = sch.startTime.split(":").map(Number);
              const [endH, endM] = sch.endTime.split(":").map(Number);

              const classStart = new Date(selectedDate);
              classStart.setHours(startH, startM, 0, 0);
              const classEnd = new Date(selectedDate);
              classEnd.setHours(endH, endM, 0, 0);

              if (selDate.getTime() < today.getTime()) {
                // Past date, no attendance record → auto absent
                attendanceStatus = "absent";
              } else if (selDate.getTime() === today.getTime()) {
                // Today
                if (now >= classEnd) {
                  // Class already ended, teacher didn't take attendance → auto absent
                  attendanceStatus = "absent";
                } else if (now >= classStart && now < classEnd) {
                  // Currently in class
                  attendanceStatus = "in_progress";
                } else {
                  // Class hasn't started yet today
                  attendanceStatus = undefined; // "Sắp tới"
                }
              } else {
                // Future date
                attendanceStatus = undefined; // "Sắp tới"
              }
            }

            timetable.push({
              classId: cls._id,
              className: cls.name,
              subject: cls.subject || "Chưa xác định",
              startTime: sch.startTime,
              endTime: sch.endTime,
              room: sch.room,
              teacherName,
              colorIndex: classIndex % CLASS_COLORS.length,
              attendanceStatus,
            });
          }
        });
      }
    });

    // Sort by start time
    timetable.sort((a, b) => a.startTime.localeCompare(b.startTime));
    return timetable;
  }, [
    classes,
    selectedDate,
    user,
    sessions,
    selectedChild?._id,
    studentAttendanceRecords,
  ]);

  // Check if day has classes for student
  const studentHasClassesOnDate = useCallback(
    (date: Date) => {
      if (user?.role !== "student" && user?.role !== "parent") return false;

      const dayIndex = date.getDay();

      // For parent: use all classes (already filtered by selectedChild from API)
      // For student: filter by studentIds
      const studentClasses =
        user?.role === "parent"
          ? classes
          : classes.filter((cls) => {
              if (cls.studentIds && cls.studentIds.includes(user._id))
                return true;
              if (cls.students && cls.students.some((s) => s._id === user._id))
                return true;
              return false;
            });

      return studentClasses.some(
        (cls) =>
          cls.schedule &&
          cls.schedule.some((sch) => sch.dayOfWeek === dayIndex),
      );
    },
    [classes, user],
  );

  // Get class name from session
  const getClassName = (session: any) => {
    if (typeof session.classId === "object" && session.classId?.name) {
      return session.classId.name;
    }
    // Try to find in classes store
    if (typeof session.classId === "string") {
      const cls = classes.find((c) => c._id === session.classId);
      if (cls) return cls.name;
    }
    return "Chưa xác định";
  };

  // Get subject from session
  const getSubject = (session: any) => {
    if (typeof session.classId === "object" && session.classId?.subject) {
      return session.classId.subject;
    }
    // Try to find in classes store
    if (typeof session.classId === "string") {
      const cls = classes.find((c) => c._id === session.classId);
      if (cls && cls.subject) return cls.subject;
    }
    return session.subject || "";
  };

  // Format time from session
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Navigate weeks
  const goToPreviousWeek = () => {
    setWeekOffset(weekOffset - 1);
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 7);
    setSelectedDate(newDate);
  };

  const goToNextWeek = () => {
    setWeekOffset(weekOffset + 1);
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 7);
    setSelectedDate(newDate);
  };

  // Format schedule for display
  const formatScheduleText = (schedule: any[]) => {
    if (!schedule || schedule.length === 0) return "Chưa có lịch";
    const dayNames = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
    return schedule
      .map((s) => `${dayNames[s.dayOfWeek]} ${s.startTime}-${s.endTime}`)
      .join(", ");
  };

  // Handle class detail click
  const handleClassPress = (cls: any) => {
    setSelectedClassDetail(cls);
    setShowClassDetailModal(true);
  };

  // Helper function to check if current time is within class schedule time
  const isWithinClassTime = (
    scheduleDate: Date,
    startTime: string,
    endTime: string,
  ): boolean => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const schedDay = new Date(
      scheduleDate.getFullYear(),
      scheduleDate.getMonth(),
      scheduleDate.getDate(),
    );

    // Check if same day
    if (today.getTime() !== schedDay.getTime()) {
      return false;
    }

    // Parse times
    const [startHour, startMin] = startTime.split(":").map(Number);
    const [endHour, endMin] = endTime.split(":").map(Number);

    const currentHour = now.getHours();
    const currentMin = now.getMinutes();

    const currentMinutes = currentHour * 60 + currentMin;
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    // Allow 15 minutes before and after class time
    return (
      currentMinutes >= startMinutes - 15 && currentMinutes <= endMinutes + 15
    );
  };

  // Handle attendance for teacher
  // State to track which date is being used for attendance
  const [attendanceDate, setAttendanceDate] = useState<Date>(selectedDate);

  const handleOpenAttendance = async (
    item: TimetableItem,
    scheduleDate?: Date,
  ) => {
    const classData = classes.find((c) => c._id === item.classId);
    if (!classData) {
      Alert.alert("Lỗi", "Không tìm thấy thông tin lớp học");
      return;
    }

    const students = classData.students || [];
    if (students.length === 0) {
      Alert.alert("Thông báo", "Lớp học này chưa có học sinh nào");
      return;
    }

    // Use scheduleDate if provided (from week view), otherwise use selectedDate
    const dateForAttendance = scheduleDate || selectedDate;
    setAttendanceDate(dateForAttendance);

    // Check if within class time
    const canAttend = isWithinClassTime(
      dateForAttendance,
      item.startTime,
      item.endTime,
    );
    if (!canAttend) {
      Alert.alert(
        "Thông báo",
        `Chỉ có thể điểm danh trong khoảng thời gian học (${item.startTime} - ${item.endTime}). Vui lòng quay lại đúng giờ học.`,
      );
      return;
    }

    setAttendanceClassId(item.classId);
    setSelectedScheduleItem(item);

    // Initialize attendance records
    setAttendanceRecords(
      students.map((s) => ({
        studentId: s._id,
        name: s.fullName || s.name || "Học sinh",
        email: s.email,
        status: null,
      })),
    );
    setAttendanceNote("");

    // Try to fetch existing attendance for this class and date
    try {
      const response = await api.get("/attendance/by-class-date", {
        params: {
          classId: item.classId,
          date: dateForAttendance.toISOString(),
        },
      });
      const existingRecords = response.data || [];

      if (existingRecords.length > 0) {
        setAttendanceRecords((prevRows) =>
          prevRows.map((row) => {
            const existingRecord = existingRecords.find(
              (r: any) =>
                r.studentId === row.studentId ||
                r.studentId?._id === row.studentId,
            );
            if (existingRecord) {
              return { ...row, status: existingRecord.status };
            }
            return row;
          }),
        );
      }
    } catch (error) {
      console.log("No existing attendance records");
    }

    setShowAttendanceModal(true);
  };

  // Update attendance status for a student
  const updateAttendanceStatus = (
    studentId: string,
    status: "present" | "absent" | "late" | "excused" | null,
  ) => {
    setAttendanceRecords((prev) =>
      prev.map((r) => (r.studentId === studentId ? { ...r, status } : r)),
    );
  };

  // Save attendance
  const handleSaveAttendance = async () => {
    if (!attendanceClassId || !selectedScheduleItem) return;

    setIsSavingAttendance(true);
    try {
      const payloadRecords = attendanceRecords
        .filter((record) => record.status)
        .map((record) => ({
          studentId: record.studentId,
          status: record.status!,
        }));

      if (payloadRecords.length === 0) {
        Alert.alert("Thông báo", "Vui lòng chọn trạng thái điểm danh");
        setIsSavingAttendance(false);
        return;
      }

      await api.post("/attendance/timetable", {
        classId: attendanceClassId,
        date: attendanceDate.toISOString(),
        records: payloadRecords,
        note: attendanceNote || undefined,
      });

      // Send notifications for each student
      const className = selectedScheduleItem.className;
      const dateStr = attendanceDate.toLocaleDateString("vi-VN");
      
      attendanceRecords.forEach(record => {
        if (record.status) {
          notificationService.notifyAttendance({
            studentId: record.studentId,
            studentName: record.name,
            status: record.status,
            className: className,
            date: dateStr
          }).catch(err => console.error(`Failed to notify attendance for ${record.name}:`, err));
        }
      });

      Alert.alert("Thành công", "Đã lưu điểm danh thành công");
      setShowAttendanceModal(false);
    } catch (error: any) {
      console.error("Error saving attendance:", error);
      Alert.alert(
        "Lỗi",
        error?.response?.data?.message ||
          error.message ||
          "Không thể lưu điểm danh. Vui lòng thử lại.",
      );
    } finally {
      setIsSavingAttendance(false);
    }
  };

  // Render admin class card (list view)
  const renderAdminClassCard = (cls: any) => {
    const colors = CLASS_COLORS[cls.colorIndex || 0];
    return (
      <TouchableOpacity
        key={cls._id}
        style={styles.adminClassCard}
        onPress={() => handleClassPress(cls)}
        activeOpacity={0.7}
      >
        <LinearGradient colors={colors} style={styles.adminClassIndicator} />
        <View style={styles.adminClassContent}>
          <View style={styles.adminClassHeader}>
            <Text style={styles.adminClassName} numberOfLines={1}>
              {cls.name}
            </Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: `${colors[0]}20` },
              ]}
            >
              <Text style={[styles.statusText, { color: colors[0] }]}>
                {cls.schedule?.length || 0} buổi/tuần
              </Text>
            </View>
          </View>
          <Text style={styles.adminClassSubject} numberOfLines={1}>
            {cls.subject || "Chưa xác định"}
          </Text>
          <View style={styles.adminClassDetails}>
            <View style={styles.detailItem}>
              <Ionicons name="person-outline" size={12} color="#6B7280" />
              <Text style={styles.detailText} numberOfLines={1}>
                {cls.teacherName}
              </Text>
            </View>
            {cls.branchName && (
              <View style={styles.detailItem}>
                <Ionicons name="business-outline" size={12} color="#6B7280" />
                <Text style={styles.detailText} numberOfLines={1}>
                  {cls.branchName}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.schedulePreview} numberOfLines={1}>
            <Ionicons name="time-outline" size={11} color="#9CA3AF" />{" "}
            {formatScheduleText(cls.schedule)}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
      </TouchableOpacity>
    );
  };

  // Render admin timetable item (day view)
  const renderAdminTimetableItem = (item: TimetableItem, index: number) => {
    const colors = CLASS_COLORS[item.colorIndex || 0];
    return (
      <TouchableOpacity
        key={`${item.classId}-${index}`}
        style={styles.scheduleCard}
        onPress={() => {
          setSelectedScheduleItem(item);
          if (item.isIrregular) {
            setShowClassDetailModal(true);
          } else {
            const cls = adminClassList.find((c) => c._id === item.classId);
            if (cls) handleClassPress(cls);
          }
        }}
        activeOpacity={0.7}
      >
        <View style={styles.timeColumn}>
          <LinearGradient colors={colors} style={styles.timeIndicator} />
          <Text style={styles.startTime}>{item.startTime}</Text>
          <Text style={styles.endTime}>{item.endTime}</Text>
        </View>
        <View style={styles.scheduleInfo}>
          <View style={styles.scheduleHeader}>
            <Text
              style={styles.className}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {item.isIrregular && item.sessionTitle
                ? item.sessionTitle
                : item.className}
            </Text>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: item.isIrregular
                    ? item.sessionType === "exam"
                      ? "#FEE2E2"
                      : "#D1FAE5"
                    : `${colors[0]}20`,
                },
              ]}
            >
              {item.isIrregular ? (
                <Ionicons
                  name={
                    item.sessionType === "exam" ? "document-text" : "refresh"
                  }
                  size={10}
                  color={item.sessionType === "exam" ? "#EF4444" : "#10B981"}
                />
              ) : (
                <Ionicons name="repeat" size={10} color={colors[0]} />
              )}
              <Text
                style={[
                  styles.statusText,
                  {
                    color: item.isIrregular
                      ? item.sessionType === "exam"
                        ? "#EF4444"
                        : "#10B981"
                      : colors[0],
                  },
                ]}
              >
                {item.isIrregular
                  ? item.sessionType === "exam"
                    ? "Kiểm tra"
                    : "Học bù"
                  : "Cố định"}
              </Text>
            </View>
          </View>
          <Text style={styles.subject} numberOfLines={1} ellipsizeMode="tail">
            {item.isIrregular && item.sessionTitle
              ? item.className
                ? `${item.className} – ${item.subject}`
                : item.subject
              : item.subject}
          </Text>
          <View style={styles.scheduleDetails}>
            <View style={styles.detailItem}>
              <Ionicons name="person-outline" size={12} color="#6B7280" />
              <Text style={styles.detailText} numberOfLines={1}>
                {item.teacherName}
              </Text>
            </View>
            {item.branchName && (
              <View style={styles.detailItem}>
                <Ionicons name="business-outline" size={12} color="#6B7280" />
                <Text style={styles.detailText} numberOfLines={1}>
                  {item.branchName}
                </Text>
              </View>
            )}
            {item.room && (
              <View style={styles.detailItem}>
                <Ionicons name="location-outline" size={12} color="#6B7280" />
                <Text style={styles.detailText} numberOfLines={1}>
                  {item.room}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Get selected branch name for display
  const selectedBranchName =
    branches.find((b) => b._id === selectedBranch)?.name || "Tất cả chi nhánh";

  // Filtered classes for session form (by branch and subject)
  const sessionFormClasses = useMemo(() => {
    let result = classes;
    if (sessionForm.branchId) {
      result = result.filter((cls: any) => {
        const branchId =
          typeof cls.branchId === "string" ? cls.branchId : cls.branchId?._id;
        return branchId === sessionForm.branchId;
      });
    }
    return result;
  }, [classes, sessionForm.branchId]);

  // Teachers list for session form
  const sessionTeachers = useMemo(() => {
    return users.filter((u: any) => u.role === "teacher");
  }, [users]);

  // Reset session form
  const resetSessionForm = () => {
    setSessionForm({
      branchId: "",
      classId: "",
      teacherId: "",
      subject: "",
      title: "",
      room: "",
      date: new Date(),
      startTime: "08:00",
      endTime: "09:30",
      type: "makeup",
      note: "",
    });
    setActiveSessionPicker(null);
  };

  // Handle create session submit
  const handleCreateSession = async () => {
    if (!sessionForm.title.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập tiêu đề buổi học");
      return;
    }
    if (sessionForm.startTime >= sessionForm.endTime) {
      Alert.alert("Lỗi", "Giờ kết thúc phải sau giờ bắt đầu");
      return;
    }

    setIsCreatingSession(true);
    try {
      const dateStr = sessionForm.date.toISOString().split("T")[0];
      const startDateTime = new Date(`${dateStr}T${sessionForm.startTime}:00`);
      const endDateTime = new Date(`${dateStr}T${sessionForm.endTime}:00`);

      await createNewSession({
        classId: sessionForm.classId || undefined,
        teacherId: sessionForm.teacherId || undefined,
        subject:
          classes.find((c: any) => c._id === sessionForm.classId)?.subject ||
          undefined,
        title: sessionForm.title || undefined,
        room: sessionForm.room || undefined,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        type: sessionForm.type,
        note: sessionForm.note || undefined,
      } as any);

      // Notify if it's a makeup class
      if (sessionForm.type === "makeup" && sessionForm.classId) {
        const cls = classes.find(c => c._id === sessionForm.classId);
        notificationService.notifyMakeUpClass({
          classId: sessionForm.classId,
          className: cls?.name || "Lớp học",
          subject: getSubjectLabel(sessionForm.subject),
          date: sessionForm.date.toLocaleDateString("vi-VN"),
          startTime: sessionForm.startTime,
          endTime: sessionForm.endTime,
          room: sessionForm.room || "Chưa xác định"
        }).catch(err => console.error("Failed to notify make-up class:", err));
      }

      Alert.alert("Thành công", "Đã tạo buổi học bất thường");
      setShowCreateSessionModal(false);
      resetSessionForm();
      // Refresh both classes and sessions so the new session appears in the calendar
      await loadSchedule();
    } catch (error: any) {
      Alert.alert("Lỗi", error.message || "Không thể tạo buổi học");
    } finally {
      setIsCreatingSession(false);
    }
  };

  // Admin View
  if (isAdmin) {
    return (
      <SafeAreaView style={styles.container} edges={["left", "right"]}>
        {/* Admin Header with Filters */}
        <View style={styles.adminHeader}>
          <View style={styles.adminTitleRow}>
            <Text style={styles.adminTitle}>Lịch dạy học</Text>
            <View style={styles.viewModeToggle}>
              <TouchableOpacity
                style={[
                  styles.viewModeBtn,
                  viewMode === "day" && styles.viewModeBtnActive,
                ]}
                onPress={() => setViewMode("day")}
              >
                <Ionicons
                  name="calendar"
                  size={16}
                  color={viewMode === "day" ? "#fff" : "#6B7280"}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.viewModeBtn,
                  viewMode === "list" && styles.viewModeBtnActive,
                ]}
                onPress={() => setViewMode("list")}
              >
                <Ionicons
                  name="list"
                  size={16}
                  color={viewMode === "list" ? "#fff" : "#6B7280"}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Ionicons
              name="search"
              size={18}
              color="#9CA3AF"
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm kiếm lớp học..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Branch Filter */}
          <TouchableOpacity
            style={styles.filterPicker}
            onPress={() => setShowBranchPicker(true)}
          >
            <Ionicons name="business-outline" size={16} color="#6B7280" />
            <Text style={styles.filterPickerText} numberOfLines={1}>
              {selectedBranchName}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* Week Calendar - only for day view */}
        {viewMode === "day" && (
          <View style={styles.calendarContainer}>
            <View style={styles.weekHeader}>
              <TouchableOpacity
                style={styles.weekNavButton}
                onPress={goToPreviousWeek}
              >
                <Ionicons name="chevron-back" size={20} color="#6B7280" />
              </TouchableOpacity>
              <Text style={styles.weekTitle}>
                Tháng {currentWeekStart.getMonth() + 1},{" "}
                {currentWeekStart.getFullYear()}
              </Text>
              <TouchableOpacity
                style={styles.weekNavButton}
                onPress={goToNextWeek}
              >
                <Ionicons name="chevron-forward" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <View style={styles.weekRow}>
              {weekDates.map((date, index) => {
                const selected = isSelected(date);
                const today = isToday(date);
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.dateCell,
                      selected && styles.selectedDateCell,
                    ]}
                    onPress={() => setSelectedDate(date)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        selected && styles.selectedDayText,
                        today && !selected && styles.todayDayText,
                      ]}
                    >
                      {daysOfWeek[(index + 1) % 7]}
                    </Text>
                    <View
                      style={[
                        styles.dateCircle,
                        selected && styles.selectedDateCircle,
                        today && !selected && styles.todayDateCircle,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dateText,
                          selected && styles.selectedDateText,
                          today && !selected && styles.todayDateText,
                        ]}
                      >
                        {formatDate(date)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Selected Date Header - only for day view */}
        {viewMode === "day" && (
          <View style={styles.selectedDateHeader}>
            <View style={styles.selectedDateInfo}>
              <Text style={styles.selectedDateTitle}>
                {fullDaysOfWeek[selectedDate.getDay()]}
              </Text>
              <Text style={styles.selectedDateSubtitle}>
                {selectedDate.toLocaleDateString("vi-VN", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </Text>
            </View>
            <View style={styles.sessionCount}>
              <Text style={styles.sessionCountText}>
                {adminTimetable.length} lớp học
              </Text>
            </View>
          </View>
        )}

        {/* Stats for list view */}
        {viewMode === "list" && (
          <View style={styles.adminStats}>
            <View style={styles.statCard}>
              <LinearGradient
                colors={["#3B82F6", "#2563EB"]}
                style={styles.statIcon}
              >
                <Ionicons name="school" size={18} color="#fff" />
              </LinearGradient>
              <Text style={styles.statValue}>{adminClassList.length}</Text>
              <Text style={styles.statLabel}>Lớp học</Text>
            </View>
            <View style={styles.statCard}>
              <LinearGradient
                colors={["#10B981", "#059669"]}
                style={styles.statIcon}
              >
                <Ionicons name="person" size={18} color="#fff" />
              </LinearGradient>
              <Text style={styles.statValue}>
                {users.filter((u) => u.role === "teacher").length}
              </Text>
              <Text style={styles.statLabel}>Giáo viên</Text>
            </View>
            <View style={styles.statCard}>
              <LinearGradient
                colors={["#8B5CF6", "#7C3AED"]}
                style={styles.statIcon}
              >
                <Ionicons name="business" size={18} color="#fff" />
              </LinearGradient>
              <Text style={styles.statValue}>{branches.length}</Text>
              <Text style={styles.statLabel}>Chi nhánh</Text>
            </View>
          </View>
        )}

        {/* Content */}
        <ScrollView
          style={styles.scheduleList}
          contentContainerStyle={[
            styles.scheduleContent,
            { paddingBottom: 100 },
          ]}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
          {viewMode === "day" ? (
            // Day View - show timetable for selected day
            adminTimetable.length === 0 ? (
              <View style={styles.emptyContainer}>
                <LinearGradient
                  colors={["#F3F4F6", "#E5E7EB"]}
                  style={styles.emptyIconBg}
                >
                  <Ionicons name="calendar-outline" size={48} color="#9CA3AF" />
                </LinearGradient>
                <Text style={styles.emptyTitle}>Không có lịch dạy</Text>
                <Text style={styles.emptyText}>
                  Không có lớp học nào trong ngày này
                </Text>
                <TouchableOpacity
                  style={{
                    marginTop: 16,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    backgroundColor: "#EEF2FF",
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 10,
                  }}
                  onPress={() => {
                    resetSessionForm();
                    fetchClasses();
                    setShowCreateSessionModal(true);
                  }}
                >
                  <Ionicons
                    name="add-circle-outline"
                    size={18}
                    color="#3B82F6"
                  />
                  <Text
                    style={{
                      color: "#3B82F6",
                      fontWeight: "600",
                      fontSize: 14,
                    }}
                  >
                    Thêm buổi học bất thường
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              adminTimetable.map((item, index) =>
                renderAdminTimetableItem(item, index),
              )
            )
          ) : // List View - show all classes
          adminClassList.length === 0 ? (
            <View style={styles.emptyContainer}>
              <LinearGradient
                colors={["#F3F4F6", "#E5E7EB"]}
                style={styles.emptyIconBg}
              >
                <Ionicons name="school-outline" size={48} color="#9CA3AF" />
              </LinearGradient>
              <Text style={styles.emptyTitle}>Không có lớp học</Text>
              <Text style={styles.emptyText}>
                Chưa có lớp học nào trong hệ thống
              </Text>
            </View>
          ) : (
            adminClassList.map((cls) => renderAdminClassCard(cls))
          )}
        </ScrollView>

        {/* Branch Picker Modal */}
        <Modal
          visible={showBranchPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowBranchPicker(false)}
        >
          <TouchableOpacity
            style={styles.pickerOverlay}
            activeOpacity={1}
            onPress={() => setShowBranchPicker(false)}
          >
            <View style={styles.pickerContainer}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>Chọn chi nhánh</Text>
                <TouchableOpacity onPress={() => setShowBranchPicker(false)}>
                  <Ionicons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.pickerList}>
                <TouchableOpacity
                  style={[
                    styles.pickerItem,
                    !selectedBranch && styles.pickerItemActive,
                  ]}
                  onPress={() => {
                    setSelectedBranch("");
                    setShowBranchPicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerItemText,
                      !selectedBranch && styles.pickerItemTextActive,
                    ]}
                  >
                    Tất cả chi nhánh
                  </Text>
                  {!selectedBranch && (
                    <Ionicons name="checkmark" size={20} color="#3B82F6" />
                  )}
                </TouchableOpacity>
                {branches.map((branch) => (
                  <TouchableOpacity
                    key={branch._id}
                    style={[
                      styles.pickerItem,
                      selectedBranch === branch._id && styles.pickerItemActive,
                    ]}
                    onPress={() => {
                      setSelectedBranch(branch._id);
                      setShowBranchPicker(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerItemText,
                        selectedBranch === branch._id &&
                          styles.pickerItemTextActive,
                      ]}
                    >
                      {branch.name}
                    </Text>
                    {selectedBranch === branch._id && (
                      <Ionicons name="checkmark" size={20} color="#3B82F6" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Class Detail Modal */}
        <Modal
          visible={showClassDetailModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowClassDetailModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.classDetailModal}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {selectedScheduleItem?.isIrregular
                    ? "Chi tiết buổi học"
                    : "Chi tiết lớp học"}
                </Text>
                <TouchableOpacity
                  onPress={() => setShowClassDetailModal(false)}
                >
                  <Ionicons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>
              {selectedScheduleItem?.isIrregular ? (
                <ScrollView style={styles.classDetailContent}>
                  {/* Session type badge */}
                  <View style={styles.classDetailSection}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 6,
                      }}
                    >
                      <View
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 20,
                          backgroundColor:
                            selectedScheduleItem.sessionType === "exam"
                              ? "#FEE2E2"
                              : "#D1FAE5",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12,
                            fontWeight: "600",
                            color:
                              selectedScheduleItem.sessionType === "exam"
                                ? "#EF4444"
                                : "#10B981",
                          }}
                        >
                          {selectedScheduleItem.sessionType === "exam"
                            ? "Kiểm tra"
                            : "Học bù"}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.classDetailName}>
                      {selectedScheduleItem.sessionTitle ||
                        selectedScheduleItem.className}
                    </Text>
                    {selectedScheduleItem.className &&
                      selectedScheduleItem.sessionTitle && (
                        <Text style={styles.classDetailSubject}>
                          Lớp: {selectedScheduleItem.className}
                        </Text>
                      )}
                    {selectedScheduleItem.subject && (
                      <Text
                        style={[styles.classDetailSubject, { marginTop: 2 }]}
                      >
                        {selectedScheduleItem.subject}
                      </Text>
                    )}
                  </View>

                  <View style={styles.classDetailSection}>
                    <Text style={styles.sectionTitle}>Thời gian</Text>
                    <View style={styles.infoRow}>
                      <Ionicons name="time" size={16} color="#6B7280" />
                      <Text style={styles.infoText}>
                        {selectedScheduleItem.startTime} –{" "}
                        {selectedScheduleItem.endTime}
                      </Text>
                    </View>
                    {selectedScheduleItem.room && (
                      <View style={styles.infoRow}>
                        <Ionicons name="location" size={16} color="#6B7280" />
                        <Text style={styles.infoText}>
                          Phòng: {selectedScheduleItem.room}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.classDetailSection}>
                    <Text style={styles.sectionTitle}>
                      Giảng viên & Chi nhánh
                    </Text>
                    {selectedScheduleItem.teacherName ? (
                      <View style={styles.infoRow}>
                        <Ionicons name="person" size={16} color="#6B7280" />
                        <Text style={styles.infoText}>
                          GV: {selectedScheduleItem.teacherName}
                        </Text>
                      </View>
                    ) : null}
                    {selectedScheduleItem.branchName ? (
                      <View style={styles.infoRow}>
                        <Ionicons name="business" size={16} color="#6B7280" />
                        <Text style={styles.infoText}>
                          Chi nhánh: {selectedScheduleItem.branchName}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </ScrollView>
              ) : selectedClassDetail ? (
                <ScrollView style={styles.classDetailContent}>
                  <View style={styles.classDetailSection}>
                    <Text style={styles.classDetailName}>
                      {selectedClassDetail.name}
                    </Text>
                    <Text style={styles.classDetailSubject}>
                      {selectedClassDetail.subject || "Chưa xác định"}
                    </Text>
                  </View>

                  <View style={styles.classDetailSection}>
                    <Text style={styles.sectionTitle}>Thông tin giảng dạy</Text>
                    <View style={styles.infoRow}>
                      <Ionicons name="person" size={16} color="#6B7280" />
                      <Text style={styles.infoText}>
                        GV: {selectedClassDetail.teacherName}
                      </Text>
                    </View>
                    {selectedClassDetail.branchName && (
                      <View style={styles.infoRow}>
                        <Ionicons name="business" size={16} color="#6B7280" />
                        <Text style={styles.infoText}>
                          Chi nhánh: {selectedClassDetail.branchName}
                        </Text>
                      </View>
                    )}
                    <View style={styles.infoRow}>
                      <Ionicons name="people" size={16} color="#6B7280" />
                      <Text style={styles.infoText}>
                        Sĩ số: {selectedClassDetail.studentIds?.length || 0} học
                        sinh
                      </Text>
                    </View>
                  </View>

                  <View style={styles.classDetailSection}>
                    <Text style={styles.sectionTitle}>Lịch học cố định</Text>
                    {selectedClassDetail.schedule &&
                    selectedClassDetail.schedule.length > 0 ? (
                      selectedClassDetail.schedule.map(
                        (sch: any, idx: number) => (
                          <View key={idx} style={styles.scheduleItem}>
                            <View style={styles.scheduleDay}>
                              <Text style={styles.scheduleDayText}>
                                {fullDaysOfWeek[sch.dayOfWeek]}
                              </Text>
                            </View>
                            <Text style={styles.scheduleTime}>
                              {sch.startTime} - {sch.endTime}
                            </Text>
                            {sch.room && (
                              <Text style={styles.scheduleRoom}>
                                Phòng: {sch.room}
                              </Text>
                            )}
                          </View>
                        ),
                      )
                    ) : (
                      <Text style={styles.noScheduleText}>
                        Chưa có lịch học
                      </Text>
                    )}
                  </View>
                </ScrollView>
              ) : null}
            </View>
          </View>
        </Modal>

        {/* FAB - Add Irregular Session */}
        <TouchableOpacity
          style={styles.fab}
          onPress={() => {
            resetSessionForm();
            fetchClasses(); // ensure fresh class data before opening modal
            setShowCreateSessionModal(true);
          }}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={["#3B82F6", "#2563EB"]}
            style={styles.fabGradient}
          >
            <Ionicons name="add" size={28} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>

        {/* Create Session Modal */}
        <Modal
          visible={showCreateSessionModal}
          transparent
          animationType="slide"
          onRequestClose={() => {
            setShowCreateSessionModal(false);
            setActiveSessionPicker(null);
          }}
        >
          <View style={styles.modalOverlay}>
            <View
              style={[styles.classDetailModal, { maxHeight: "90%", flex: 1 }]}
            >
              <View style={styles.modalHeader}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      backgroundColor: "#EEF2FF",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <Ionicons name="calendar" size={20} color="#3B82F6" />
                  </View>
                  <View>
                    <Text style={styles.modalTitle}>
                      Thêm buổi học bất thường
                    </Text>
                    <Text style={{ fontSize: 12, color: "#9CA3AF" }}>
                      Tạo buổi học bù hoặc kiểm tra
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setShowCreateSessionModal(false);
                    setActiveSessionPicker(null);
                  }}
                >
                  <Ionicons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
                showsVerticalScrollIndicator={false}
              >
                {/* Session Type Toggle */}
                <View style={{ marginBottom: 16 }}>
                  <Text style={styles.formLabel}>Loại buổi học</Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TouchableOpacity
                      style={[
                        styles.typeChip,
                        sessionForm.type === "makeup" && styles.typeChipActive,
                      ]}
                      onPress={() =>
                        setSessionForm((prev) => ({ ...prev, type: "makeup" }))
                      }
                    >
                      <Text
                        style={[
                          styles.typeChipText,
                          sessionForm.type === "makeup" &&
                            styles.typeChipTextActive,
                        ]}
                      >
                        Học bù
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.typeChip,
                        sessionForm.type === "exam" && styles.typeChipActive,
                      ]}
                      onPress={() =>
                        setSessionForm((prev) => ({ ...prev, type: "exam" }))
                      }
                    >
                      <Text
                        style={[
                          styles.typeChipText,
                          sessionForm.type === "exam" &&
                            styles.typeChipTextActive,
                        ]}
                      >
                        Kiểm tra
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Title */}
                <View style={{ marginBottom: 16 }}>
                  <Text style={styles.formLabel}>Tiêu đề *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="VD: Buổi ôn tập, Kiểm tra giữa kỳ..."
                    placeholderTextColor="#9CA3AF"
                    value={sessionForm.title}
                    onChangeText={(text) =>
                      setSessionForm((prev) => ({ ...prev, title: text }))
                    }
                  />
                </View>

                {/* Branch Picker */}
                <View style={{ marginBottom: 16 }}>
                  <Text style={styles.formLabel}>Cơ sở</Text>
                  <TouchableOpacity
                    style={[
                      styles.formPicker,
                      activeSessionPicker === "branch" && {
                        borderColor: "#3B82F6",
                      },
                    ]}
                    onPress={() =>
                      setActiveSessionPicker(
                        activeSessionPicker === "branch" ? null : "branch",
                      )
                    }
                  >
                    <Ionicons
                      name="business-outline"
                      size={18}
                      color="#6B7280"
                    />
                    <Text
                      style={[
                        styles.formPickerText,
                        !sessionForm.branchId && { color: "#9CA3AF" },
                      ]}
                      numberOfLines={1}
                    >
                      {sessionForm.branchId
                        ? branches.find((b) => b._id === sessionForm.branchId)
                            ?.name
                        : "Chọn cơ sở"}
                    </Text>
                    <Ionicons
                      name={
                        activeSessionPicker === "branch"
                          ? "chevron-up"
                          : "chevron-down"
                      }
                      size={16}
                      color="#6B7280"
                    />
                  </TouchableOpacity>
                  {activeSessionPicker === "branch" && (
                    <ScrollView
                      style={styles.inlineDropdown}
                      nestedScrollEnabled
                      showsVerticalScrollIndicator={false}
                    >
                      <TouchableOpacity
                        style={[
                          styles.inlineDropdownItem,
                          !sessionForm.branchId &&
                            styles.inlineDropdownItemActive,
                        ]}
                        onPress={() => {
                          setSessionForm((prev) => ({
                            ...prev,
                            branchId: "",
                            classId: "",
                          }));
                          setActiveSessionPicker(null);
                        }}
                      >
                        <Text
                          style={[
                            styles.inlineDropdownText,
                            !sessionForm.branchId &&
                              styles.inlineDropdownTextActive,
                          ]}
                        >
                          Tất cả
                        </Text>
                        {!sessionForm.branchId && (
                          <Ionicons
                            name="checkmark"
                            size={16}
                            color="#3B82F6"
                          />
                        )}
                      </TouchableOpacity>
                      {branches.map((branch) => (
                        <TouchableOpacity
                          key={branch._id}
                          style={[
                            styles.inlineDropdownItem,
                            sessionForm.branchId === branch._id &&
                              styles.inlineDropdownItemActive,
                          ]}
                          onPress={() => {
                            setSessionForm((prev) => ({
                              ...prev,
                              branchId: branch._id,
                              classId: "",
                            }));
                            setActiveSessionPicker(null);
                          }}
                        >
                          <Text
                            style={[
                              styles.inlineDropdownText,
                              sessionForm.branchId === branch._id &&
                                styles.inlineDropdownTextActive,
                            ]}
                          >
                            {branch.name}
                          </Text>
                          {sessionForm.branchId === branch._id && (
                            <Ionicons
                              name="checkmark"
                              size={16}
                              color="#3B82F6"
                            />
                          )}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                </View>

                {/* Class Picker */}
                <View style={{ marginBottom: 16 }}>
                  <Text style={styles.formLabel}>Lớp học</Text>
                  <TouchableOpacity
                    style={[
                      styles.formPicker,
                      activeSessionPicker === "class" && {
                        borderColor: "#3B82F6",
                      },
                    ]}
                    onPress={() =>
                      setActiveSessionPicker(
                        activeSessionPicker === "class" ? null : "class",
                      )
                    }
                  >
                    <Ionicons name="school-outline" size={18} color="#6B7280" />
                    <Text
                      style={[
                        styles.formPickerText,
                        !sessionForm.classId && { color: "#9CA3AF" },
                      ]}
                      numberOfLines={1}
                    >
                      {sessionForm.classId
                        ? classes.find(
                            (c: any) => c._id === sessionForm.classId,
                          )?.name
                        : "Chọn lớp học"}
                    </Text>
                    <Ionicons
                      name={
                        activeSessionPicker === "class"
                          ? "chevron-up"
                          : "chevron-down"
                      }
                      size={16}
                      color="#6B7280"
                    />
                  </TouchableOpacity>
                  {activeSessionPicker === "class" && (
                    <ScrollView
                      style={styles.inlineDropdown}
                      nestedScrollEnabled
                      showsVerticalScrollIndicator={false}
                    >
                      {sessionFormClasses.length === 0 ? (
                        <Text
                          style={{
                            padding: 12,
                            color: "#9CA3AF",
                            textAlign: "center",
                            fontSize: 13,
                          }}
                        >
                          Không có lớp học phù hợp
                        </Text>
                      ) : (
                        sessionFormClasses.map((cls: any) => (
                          <TouchableOpacity
                            key={cls._id}
                            style={[
                              styles.inlineDropdownItem,
                              sessionForm.classId === cls._id &&
                                styles.inlineDropdownItemActive,
                            ]}
                            onPress={() => {
                              const teacherId =
                                typeof cls.teacherId === "object"
                                  ? cls.teacherId?._id
                                  : cls.teacherId;
                              setSessionForm((prev) => ({
                                ...prev,
                                classId: cls._id,
                                teacherId: teacherId || prev.teacherId,
                              }));
                              setActiveSessionPicker(null);
                            }}
                          >
                            <View style={{ flex: 1 }}>
                              <Text
                                style={[
                                  styles.inlineDropdownText,
                                  sessionForm.classId === cls._id &&
                                    styles.inlineDropdownTextActive,
                                ]}
                              >
                                {cls.name}
                              </Text>
                              {cls.subject ? (
                                <Text
                                  style={{ fontSize: 11, color: "#9CA3AF" }}
                                >
                                  {getSubjectLabel(cls.subject)}
                                </Text>
                              ) : null}
                            </View>
                            {sessionForm.classId === cls._id && (
                              <Ionicons
                                name="checkmark"
                                size={16}
                                color="#3B82F6"
                              />
                            )}
                          </TouchableOpacity>
                        ))
                      )}
                    </ScrollView>
                  )}
                </View>

                {/* Teacher Picker */}
                <View style={{ marginBottom: 16 }}>
                  <Text style={styles.formLabel}>Giáo viên</Text>
                  <TouchableOpacity
                    style={[
                      styles.formPicker,
                      activeSessionPicker === "teacher" && {
                        borderColor: "#3B82F6",
                      },
                    ]}
                    onPress={() =>
                      setActiveSessionPicker(
                        activeSessionPicker === "teacher" ? null : "teacher",
                      )
                    }
                  >
                    <Ionicons name="person-outline" size={18} color="#6B7280" />
                    <Text
                      style={[
                        styles.formPickerText,
                        !sessionForm.teacherId && { color: "#9CA3AF" },
                      ]}
                      numberOfLines={1}
                    >
                      {sessionForm.teacherId
                        ? (() => {
                            const t = users.find(
                              (u: any) => u._id === sessionForm.teacherId,
                            );
                            return t ? t.fullName || t.name : "Chọn giáo viên";
                          })()
                        : "Chọn giáo viên"}
                    </Text>
                    <Ionicons
                      name={
                        activeSessionPicker === "teacher"
                          ? "chevron-up"
                          : "chevron-down"
                      }
                      size={16}
                      color="#6B7280"
                    />
                  </TouchableOpacity>
                  {activeSessionPicker === "teacher" && (
                    <ScrollView
                      style={styles.inlineDropdown}
                      nestedScrollEnabled
                      showsVerticalScrollIndicator={false}
                    >
                      {sessionTeachers.length === 0 ? (
                        <Text
                          style={{
                            padding: 12,
                            color: "#9CA3AF",
                            textAlign: "center",
                            fontSize: 13,
                          }}
                        >
                          Không có giáo viên
                        </Text>
                      ) : (
                        sessionTeachers.map((teacher: any) => (
                          <TouchableOpacity
                            key={teacher._id}
                            style={[
                              styles.inlineDropdownItem,
                              sessionForm.teacherId === teacher._id &&
                                styles.inlineDropdownItemActive,
                            ]}
                            onPress={() => {
                              setSessionForm((prev) => ({
                                ...prev,
                                teacherId: teacher._id,
                              }));
                              setActiveSessionPicker(null);
                            }}
                          >
                            <View style={{ flex: 1 }}>
                              <Text
                                style={[
                                  styles.inlineDropdownText,
                                  sessionForm.teacherId === teacher._id &&
                                    styles.inlineDropdownTextActive,
                                ]}
                              >
                                {teacher.fullName || teacher.name}
                              </Text>
                              <Text style={{ fontSize: 11, color: "#9CA3AF" }}>
                                {teacher.email}
                              </Text>
                            </View>
                            {sessionForm.teacherId === teacher._id && (
                              <Ionicons
                                name="checkmark"
                                size={16}
                                color="#3B82F6"
                              />
                            )}
                          </TouchableOpacity>
                        ))
                      )}
                    </ScrollView>
                  )}
                </View>

                {/* Room */}
                <View style={{ marginBottom: 16 }}>
                  <Text style={styles.formLabel}>Phòng học</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="VD: P201, Lab A..."
                    placeholderTextColor="#9CA3AF"
                    value={sessionForm.room}
                    onChangeText={(text) =>
                      setSessionForm((prev) => ({ ...prev, room: text }))
                    }
                  />
                </View>

                {/* Date */}
                <View style={{ marginBottom: 16 }}>
                  <Text style={styles.formLabel}>Ngày học *</Text>
                  <TouchableOpacity
                    style={styles.formPicker}
                    onPress={() => setShowSessionDatePicker(true)}
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={18}
                      color="#6B7280"
                    />
                    <Text style={styles.formPickerText}>
                      {sessionForm.date.toLocaleDateString("vi-VN", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </Text>
                  </TouchableOpacity>
                  {showSessionDatePicker && (
                    <DateTimePicker
                      value={sessionForm.date}
                      mode="date"
                      onChange={(event: DateTimePickerEvent, date?: Date) => {
                        setShowSessionDatePicker(Platform.OS === "ios");
                        if (date) setSessionForm((prev) => ({ ...prev, date }));
                      }}
                    />
                  )}
                </View>

                {/* Time Row */}
                <View
                  style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>Giờ bắt đầu *</Text>
                    <TouchableOpacity
                      style={styles.formPicker}
                      onPress={() => setShowSessionStartTimePicker(true)}
                    >
                      <Ionicons name="time-outline" size={18} color="#6B7280" />
                      <Text style={styles.formPickerText}>
                        {sessionForm.startTime}
                      </Text>
                    </TouchableOpacity>
                    {showSessionStartTimePicker && (
                      <DateTimePicker
                        value={(() => {
                          const d = new Date();
                          const [h, m] = sessionForm.startTime.split(":");
                          d.setHours(parseInt(h), parseInt(m));
                          return d;
                        })()}
                        mode="time"
                        is24Hour={true}
                        onChange={(event: DateTimePickerEvent, date?: Date) => {
                          setShowSessionStartTimePicker(Platform.OS === "ios");
                          if (date) {
                            const h = date
                              .getHours()
                              .toString()
                              .padStart(2, "0");
                            const m = date
                              .getMinutes()
                              .toString()
                              .padStart(2, "0");
                            setSessionForm((prev) => ({
                              ...prev,
                              startTime: `${h}:${m}`,
                            }));
                          }
                        }}
                      />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.formLabel}>Giờ kết thúc *</Text>
                    <TouchableOpacity
                      style={styles.formPicker}
                      onPress={() => setShowSessionEndTimePicker(true)}
                    >
                      <Ionicons name="time-outline" size={18} color="#6B7280" />
                      <Text style={styles.formPickerText}>
                        {sessionForm.endTime}
                      </Text>
                    </TouchableOpacity>
                    {showSessionEndTimePicker && (
                      <DateTimePicker
                        value={(() => {
                          const d = new Date();
                          const [h, m] = sessionForm.endTime.split(":");
                          d.setHours(parseInt(h), parseInt(m));
                          return d;
                        })()}
                        mode="time"
                        is24Hour={true}
                        onChange={(event: DateTimePickerEvent, date?: Date) => {
                          setShowSessionEndTimePicker(Platform.OS === "ios");
                          if (date) {
                            const h = date
                              .getHours()
                              .toString()
                              .padStart(2, "0");
                            const m = date
                              .getMinutes()
                              .toString()
                              .padStart(2, "0");
                            setSessionForm((prev) => ({
                              ...prev,
                              endTime: `${h}:${m}`,
                            }));
                          }
                        }}
                      />
                    )}
                  </View>
                </View>

                {/* Note */}
                <View style={{ marginBottom: 16 }}>
                  <Text style={styles.formLabel}>Ghi chú</Text>
                  <TextInput
                    style={[
                      styles.formInput,
                      { height: 80, textAlignVertical: "top" },
                    ]}
                    placeholder="Ghi chú thêm..."
                    placeholderTextColor="#9CA3AF"
                    value={sessionForm.note}
                    onChangeText={(text) =>
                      setSessionForm((prev) => ({ ...prev, note: text }))
                    }
                    multiline
                  />
                </View>
              </ScrollView>

              {/* Submit Buttons */}
              <View
                style={{
                  flexDirection: "row",
                  gap: 10,
                  padding: 16,
                  paddingTop: 12,
                  borderTopWidth: 1,
                  borderTopColor: "#F3F4F6",
                }}
              >
                <TouchableOpacity
                  style={[
                    styles.formButton,
                    { flex: 1, backgroundColor: "#F3F4F6" },
                  ]}
                  onPress={() => {
                    setShowCreateSessionModal(false);
                    setActiveSessionPicker(null);
                  }}
                >
                  <Text style={[styles.formButtonText, { color: "#6B7280" }]}>
                    Hủy
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.formButton, { flex: 2 }]}
                  onPress={handleCreateSession}
                  disabled={isCreatingSession}
                >
                  <LinearGradient
                    colors={["#3B82F6", "#2563EB"]}
                    style={[
                      styles.formButtonGradient,
                      isCreatingSession && { opacity: 0.7 },
                    ]}
                  >
                    <Ionicons name="add-circle" size={18} color="#fff" />
                    <Text style={[styles.formButtonText, { color: "#fff" }]}>
                      {isCreatingSession ? "Đang tạo..." : "Tạo buổi học"}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }
  if (isTeacher) {
    return (
      <SafeAreaView style={styles.container} edges={["left", "right"]}>
        {/* Teacher Header */}
        <View style={styles.teacherHeader}>
          <View style={styles.teacherTitleRow}>
            <Text style={styles.teacherTitle}>Lịch dạy của tôi</Text>
          </View>

          {/* Week Navigation */}
          <View style={styles.weekNavRow}>
            <TouchableOpacity
              style={styles.weekNavBtnSmall}
              onPress={goToPreviousWeek}
            >
              <Ionicons name="chevron-back" size={18} color="#6B7280" />
            </TouchableOpacity>
            <Text style={styles.weekNavText}>
              Tuần{" "}
              {currentWeekStart.toLocaleDateString("vi-VN", {
                day: "2-digit",
                month: "2-digit",
              })}{" "}
              -{" "}
              {new Date(
                currentWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000,
              ).toLocaleDateString("vi-VN", {
                day: "2-digit",
                month: "2-digit",
              })}
            </Text>
            <TouchableOpacity
              style={styles.weekNavBtnSmall}
              onPress={goToNextWeek}
            >
              <Ionicons name="chevron-forward" size={18} color="#6B7280" />
            </TouchableOpacity>
          </View>
        </View>

        {/* DAY VIEW */}
        <>
          {/* Week Calendar Header */}
          <View style={styles.calendarContainer}>
            <View style={styles.weekRow}>
              {weekDates.map((date, index) => {
                const selected = isSelected(date);
                const today = isToday(date);
                return (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.dateCell,
                      selected && styles.selectedDateCell,
                    ]}
                    onPress={() => setSelectedDate(date)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        selected && styles.selectedDayText,
                        today && !selected && styles.todayDayText,
                      ]}
                    >
                      {daysOfWeek[(index + 1) % 7]}
                    </Text>
                    <View
                      style={[
                        styles.dateCircle,
                        selected && styles.selectedDateCircle,
                        today && !selected && styles.todayDateCircle,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dateText,
                          selected && styles.selectedDateText,
                          today && !selected && styles.todayDateText,
                        ]}
                      >
                        {formatDate(date)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Selected Date Header */}
          <View style={styles.selectedDateHeader}>
            <View style={styles.selectedDateInfo}>
              <Text style={styles.selectedDateTitle}>
                {fullDaysOfWeek[selectedDate.getDay()]}
              </Text>
              <Text style={styles.selectedDateSubtitle}>
                {selectedDate.toLocaleDateString("vi-VN", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </Text>
            </View>
            <View style={styles.sessionCount}>
              <Text style={styles.sessionCountText}>
                {teacherTimetable.length} buổi dạy
              </Text>
            </View>
          </View>

          {/* Schedule List */}
          <ScrollView
            style={styles.scheduleList}
            contentContainerStyle={styles.scheduleContent}
            refreshControl={
              <RefreshControl refreshing={isLoading} onRefresh={onRefresh} />
            }
            showsVerticalScrollIndicator={false}
          >
            {teacherTimetable.length === 0 ? (
              <View style={styles.emptyContainer}>
                <LinearGradient
                  colors={["#F3F4F6", "#E5E7EB"]}
                  style={styles.emptyIconBg}
                >
                  <Ionicons name="calendar-outline" size={48} color="#9CA3AF" />
                </LinearGradient>
                <Text style={styles.emptyTitle}>Không có lịch dạy</Text>
                <Text style={styles.emptyText}>
                  Bạn không có tiết dạy nào trong ngày này
                </Text>
              </View>
            ) : (
              teacherTimetable.map((item, index) => {
                const classData = classes.find((c) => c._id === item.classId);
                const studentCount =
                  classData?.students?.length ||
                  classData?.studentIds?.length ||
                  0;
                const canAttend = isWithinClassTime(
                  selectedDate,
                  item.startTime,
                  item.endTime,
                );

                return (
                  <View
                    key={`${item.classId}-${index}`}
                    style={[
                      styles.teacherScheduleCard,
                      canAttend && styles.teacherScheduleCardActive,
                    ]}
                  >
                    <View style={styles.timeColumn}>
                      <LinearGradient
                        colors={
                          canAttend
                            ? ["#10B981", "#059669"]
                            : ["#3B82F6", "#2563EB"]
                        }
                        style={styles.timeIndicator}
                      />
                      <Text style={styles.startTime}>{item.startTime}</Text>
                      <Text style={styles.endTime}>{item.endTime}</Text>
                    </View>
                    <View style={styles.scheduleInfo}>
                      <View style={styles.scheduleHeader}>
                        <Text
                          style={styles.className}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {item.className}
                        </Text>
                        <View
                          style={[
                            styles.statusBadge,
                            {
                              backgroundColor: canAttend
                                ? "#D1FAE5"
                                : "#DBEAFE",
                            },
                          ]}
                        >
                          <Ionicons
                            name={canAttend ? "checkmark-circle" : "time"}
                            size={10}
                            color={canAttend ? "#059669" : "#3B82F6"}
                          />
                          <Text
                            style={[
                              styles.statusText,
                              { color: canAttend ? "#059669" : "#3B82F6" },
                            ]}
                          >
                            {canAttend ? "Đang diễn ra" : "Sắp tới"}
                          </Text>
                        </View>
                      </View>
                      <Text
                        style={styles.subject}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {item.subject}
                      </Text>

                      {/* Class info */}
                      <View style={styles.classInfoRow}>
                        <View style={styles.detailItem}>
                          <Ionicons
                            name="people-outline"
                            size={12}
                            color="#6B7280"
                          />
                          <Text style={styles.detailText}>
                            {studentCount} học sinh
                          </Text>
                        </View>
                        {item.room && (
                          <View style={styles.detailItem}>
                            <Ionicons
                              name="location-outline"
                              size={12}
                              color="#6B7280"
                            />
                            <Text style={styles.detailText} numberOfLines={1}>
                              {item.room}
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Attendance button */}
                      <TouchableOpacity
                        style={[
                          styles.attendanceButton,
                          !canAttend && styles.attendanceButtonDisabled,
                        ]}
                        onPress={() => handleOpenAttendance(item)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name="checkmark-done-circle"
                          size={16}
                          color={canAttend ? "#FFFFFF" : "#9CA3AF"}
                        />
                        <Text
                          style={[
                            styles.attendanceButtonText,
                            !canAttend && styles.attendanceButtonTextDisabled,
                          ]}
                        >
                          {canAttend ? "Điểm danh" : "Chưa đến giờ"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>
        </>

        {/* Teacher Attendance Modal */}
        <Modal
          visible={showAttendanceModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowAttendanceModal(false)}
        >
          <SafeAreaView style={styles.attendanceModalContainer}>
            {/* Modal Header */}
            <View style={styles.attendanceModalHeader}>
              <TouchableOpacity
                onPress={() => setShowAttendanceModal(false)}
                style={styles.attendanceCloseBtn}
              >
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
              <Text style={styles.attendanceModalTitle}>Điểm danh</Text>
              <View style={{ width: 40 }} />
            </View>

            {/* Class Info */}
            {selectedScheduleItem && (
              <View style={styles.attendanceClassInfo}>
                <Text style={styles.attendanceClassName}>
                  {selectedScheduleItem.className}
                </Text>
                <Text style={styles.attendanceDateTime}>
                  {fullDaysOfWeek[attendanceDate.getDay()]},{" "}
                  {attendanceDate.toLocaleDateString("vi-VN")} •{" "}
                  {selectedScheduleItem.startTime} -{" "}
                  {selectedScheduleItem.endTime}
                </Text>
              </View>
            )}

            {/* Stats */}
            <View style={styles.attendanceStats}>
              <View style={styles.attendanceStat}>
                <Text style={styles.attendanceStatValue}>
                  {attendanceRecords.length}
                </Text>
                <Text style={styles.attendanceStatLabel}>Tổng số</Text>
              </View>
              <View
                style={[styles.attendanceStat, { backgroundColor: "#D1FAE5" }]}
              >
                <Text
                  style={[styles.attendanceStatValue, { color: "#059669" }]}
                >
                  {
                    attendanceRecords.filter(
                      (r) => r.status === "present" || r.status === "late",
                    ).length
                  }
                </Text>
                <Text style={styles.attendanceStatLabel}>Có mặt</Text>
              </View>
              <View
                style={[styles.attendanceStat, { backgroundColor: "#FEE2E2" }]}
              >
                <Text
                  style={[styles.attendanceStatValue, { color: "#DC2626" }]}
                >
                  {
                    attendanceRecords.filter((r) => r.status === "absent")
                      .length
                  }
                </Text>
                <Text style={styles.attendanceStatLabel}>Vắng</Text>
              </View>
            </View>

            <ScrollView style={styles.attendanceList}>
              {attendanceRecords.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyTitle}>
                    Lớp học chưa có học sinh
                  </Text>
                </View>
              ) : (
                attendanceRecords.map((record) => (
                  <View key={record.studentId} style={styles.attendanceRow}>
                    <View style={styles.attendanceStudentInfo}>
                      <LinearGradient
                        colors={["#10B981", "#059669"]}
                        style={styles.attendanceAvatar}
                      >
                        <Text style={styles.attendanceAvatarText}>
                          {record.name.charAt(0).toUpperCase()}
                        </Text>
                      </LinearGradient>
                      <View style={styles.attendanceStudentDetails}>
                        <Text style={styles.attendanceStudentName}>
                          {record.name}
                        </Text>
                        <Text style={styles.attendanceStudentEmail}>
                          {record.email}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.attendanceButtons}>
                      <TouchableOpacity
                        style={[
                          styles.attendanceStatusBtn,
                          record.status === "present" &&
                            styles.attendanceStatusBtnActive,
                        ]}
                        onPress={() =>
                          updateAttendanceStatus(record.studentId, "present")
                        }
                      >
                        <Ionicons
                          name="checkmark"
                          size={16}
                          color={
                            record.status === "present" ? "#FFFFFF" : "#10B981"
                          }
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.attendanceStatusBtn,
                          styles.attendanceStatusBtnAbsent,
                          record.status === "absent" &&
                            styles.attendanceStatusBtnAbsentActive,
                        ]}
                        onPress={() =>
                          updateAttendanceStatus(record.studentId, "absent")
                        }
                      >
                        <Ionicons
                          name="close"
                          size={16}
                          color={
                            record.status === "absent" ? "#FFFFFF" : "#EF4444"
                          }
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.attendanceStatusBtn,
                          styles.attendanceStatusBtnLate,
                          record.status === "late" &&
                            styles.attendanceStatusBtnLateActive,
                        ]}
                        onPress={() =>
                          updateAttendanceStatus(record.studentId, "late")
                        }
                      >
                        <Ionicons
                          name="time"
                          size={16}
                          color={
                            record.status === "late" ? "#FFFFFF" : "#F59E0B"
                          }
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}

              {/* Note input */}
              <View style={styles.attendanceNoteSection}>
                <Text style={styles.attendanceNoteLabel}>Ghi chú buổi học</Text>
                <TextInput
                  style={styles.attendanceNoteInput}
                  placeholder="Nội dung dạy, bài tập giao..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={3}
                  value={attendanceNote}
                  onChangeText={setAttendanceNote}
                />
              </View>
            </ScrollView>

            {/* Save Button */}
            <View style={styles.attendanceSaveContainer}>
              <TouchableOpacity
                style={[
                  styles.attendanceSaveBtn,
                  isSavingAttendance && styles.attendanceSaveBtnDisabled,
                ]}
                onPress={handleSaveAttendance}
                disabled={isSavingAttendance}
              >
                <LinearGradient
                  colors={
                    isSavingAttendance
                      ? ["#D1D5DB", "#9CA3AF"]
                      : ["#10B981", "#059669"]
                  }
                  style={styles.attendanceSaveBtnGradient}
                >
                  {isSavingAttendance ? (
                    <Text style={styles.attendanceSaveBtnText}>
                      Đang lưu...
                    </Text>
                  ) : (
                    <>
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color="#FFFFFF"
                      />
                      <Text style={styles.attendanceSaveBtnText}>
                        Lưu điểm danh
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    );
  }

  // Student View (original)
  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      {/* Child Selector for Parent */}
      {user?.role === "parent" && <ChildSelector />}

      {/* Week Calendar Header */}
      <View style={styles.calendarContainer}>
        <View style={styles.weekHeader}>
          <TouchableOpacity
            style={styles.weekNavButton}
            onPress={goToPreviousWeek}
          >
            <Ionicons name="chevron-back" size={20} color="#6B7280" />
          </TouchableOpacity>
          <Text style={styles.weekTitle}>
            Tháng {currentWeekStart.getMonth() + 1},{" "}
            {currentWeekStart.getFullYear()}
          </Text>
          <TouchableOpacity style={styles.weekNavButton} onPress={goToNextWeek}>
            <Ionicons name="chevron-forward" size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>
        <View style={styles.weekRow}>
          {weekDates.map((date, index) => {
            const selected = isSelected(date);
            const today = isToday(date);

            // Check if there are any classes for this date (from class schedule)
            const hasClasses = studentHasClassesOnDate(date);

            return (
              <TouchableOpacity
                key={index}
                style={[styles.dateCell, selected && styles.selectedDateCell]}
                onPress={() => setSelectedDate(date)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.dayText,
                    selected && styles.selectedDayText,
                    today && !selected && styles.todayDayText,
                  ]}
                >
                  {daysOfWeek[(index + 1) % 7]}
                </Text>
                <View
                  style={[
                    styles.dateCircle,
                    selected && styles.selectedDateCircle,
                    today && !selected && styles.todayDateCircle,
                  ]}
                >
                  <Text
                    style={[
                      styles.dateText,
                      selected && styles.selectedDateText,
                      today && !selected && styles.todayDateText,
                    ]}
                  >
                    {formatDate(date)}
                  </Text>
                </View>
                {/* Class Indicator Dot */}
                {hasClasses && (
                  <View
                    style={[
                      styles.sessionDot,
                      selected
                        ? { backgroundColor: "#FFFFFF" }
                        : today
                          ? { backgroundColor: "#3B82F6" }
                          : { backgroundColor: "#10B981" },
                    ]}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Selected Date Header */}
      <View style={styles.selectedDateHeader}>
        <View style={styles.selectedDateInfo}>
          <Text style={styles.selectedDateTitle}>
            {fullDaysOfWeek[selectedDate.getDay()]}
          </Text>
          <Text style={styles.selectedDateSubtitle}>
            {selectedDate.toLocaleDateString("vi-VN", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </Text>
        </View>
        <View style={styles.sessionCount}>
          <Text style={styles.sessionCountText}>
            {studentTimetable.length} buổi học
          </Text>
        </View>
      </View>

      {/* Schedule List */}
      <ScrollView
        style={styles.scheduleList}
        contentContainerStyle={styles.scheduleContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {studentTimetable.length === 0 ? (
          <View style={styles.emptyContainer}>
            <LinearGradient
              colors={["#F3F4F6", "#E5E7EB"]}
              style={styles.emptyIconBg}
            >
              <Ionicons name="calendar-outline" size={48} color="#9CA3AF" />
            </LinearGradient>
            <Text style={styles.emptyTitle}>Không có lịch học</Text>
            <Text style={styles.emptyText}>
              Bạn không có buổi học nào trong ngày này
            </Text>
          </View>
        ) : (
          studentTimetable.map((item, index) => {
            const colors = CLASS_COLORS[item.colorIndex || 0];
            // Determine attendance status display
            const getAttendanceConfig = (status?: string) => {
              switch (status) {
                case "present":
                  return {
                    colors: ["#10B981", "#059669"],
                    icon: "checkmark-circle",
                    label: "Có mặt",
                  };
                case "absent":
                  return {
                    colors: ["#EF4444", "#DC2626"],
                    icon: "close-circle",
                    label: "Vắng",
                  };
                case "late":
                  return {
                    colors: ["#F59E0B", "#D97706"],
                    icon: "time",
                    label: "Đi trễ",
                  };
                case "excused":
                  return {
                    colors: ["#8B5CF6", "#7C3AED"],
                    icon: "document-text",
                    label: "Có phép",
                  };
                case "in_progress":
                  return {
                    colors: ["#06B6D4", "#0891B2"],
                    icon: "play-circle",
                    label: "Đang học",
                  };
                default:
                  return { colors: colors, icon: "calendar", label: "Sắp tới" };
              }
            };
            const attendanceConfig = getAttendanceConfig(item.attendanceStatus);

            return (
              <View
                key={`${item.classId}-${index}`}
                style={styles.scheduleCard}
              >
                <View style={styles.timeColumn}>
                  <LinearGradient
                    colors={attendanceConfig.colors as [string, string]}
                    style={styles.timeIndicator}
                  />
                  <Text style={styles.startTime}>{item.startTime}</Text>
                  <Text style={styles.endTime}>{item.endTime}</Text>
                </View>
                <View style={styles.scheduleInfo}>
                  <View style={styles.scheduleHeader}>
                    <Text
                      style={styles.className}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {item.className}
                    </Text>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: `${attendanceConfig.colors[0]}20` },
                      ]}
                    >
                      <Ionicons
                        name={attendanceConfig.icon as any}
                        size={10}
                        color={attendanceConfig.colors[0]}
                      />
                      <Text
                        style={[
                          styles.statusText,
                          { color: attendanceConfig.colors[0] },
                        ]}
                      >
                        {attendanceConfig.label}
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={styles.subject}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {item.subject}
                  </Text>
                  <View style={styles.scheduleDetails}>
                    <View style={styles.detailItem}>
                      <Ionicons
                        name="person-outline"
                        size={12}
                        color="#6B7280"
                      />
                      <Text
                        style={styles.detailText}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {item.teacherName || "Giáo viên"}
                      </Text>
                    </View>
                    {item.room && (
                      <View style={styles.detailItem}>
                        <Ionicons
                          name="location-outline"
                          size={12}
                          color="#6B7280"
                        />
                        <Text
                          style={styles.detailText}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {item.room}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  calendarContainer: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  weekHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    paddingHorizontal: 8,
  },
  weekNavButton: {
    padding: 6,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
  },
  weekTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1F2937",
  },
  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  dateCell: {
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 14,
    minWidth: (width - 48) / 7,
    maxWidth: (width - 24) / 7,
  },
  selectedDateCell: {
    backgroundColor: "#EFF6FF",
  },
  dayText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#9CA3AF",
    marginBottom: 6,
  },
  selectedDayText: {
    color: "#3B82F6",
  },
  todayDayText: {
    color: "#3B82F6",
    fontWeight: "600",
  },
  dateCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  selectedDateCircle: {
    backgroundColor: "#3B82F6",
  },
  todayDateCircle: {
    backgroundColor: "#DBEAFE",
  },
  dateText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  selectedDateText: {
    color: "#FFFFFF",
  },
  todayDateText: {
    color: "#3B82F6",
  },
  sessionDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#10B981",
    marginTop: 4,
  },
  selectedDateHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    marginTop: 10,
    marginHorizontal: 16,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  selectedDateInfo: {
    flex: 1,
    minWidth: 0,
  },
  selectedDateTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
  },
  selectedDateSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  sessionCount: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    flexShrink: 0,
  },
  sessionCountText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#3B82F6",
  },
  scheduleList: {
    flex: 1,
  },
  scheduleContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 40,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
  },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },
  scheduleCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    marginHorizontal: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    overflow: "hidden",
  },
  timeColumn: {
    alignItems: "center",
    marginRight: 12,
    width: 50,
    flexShrink: 0,
  },
  timeIndicator: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginBottom: 8,
  },
  startTime: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1F2937",
  },
  endTime: {
    fontSize: 12,
    fontWeight: "500",
    color: "#9CA3AF",
    marginTop: 4,
  },
  scheduleInfo: {
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
  },
  scheduleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
    flexWrap: "nowrap",
  },
  className: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1F2937",
    flex: 1,
    flexShrink: 1,
    marginRight: 8,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 3,
    flexShrink: 0,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "600",
  },
  subject: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 8,
  },
  scheduleDetails: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    maxWidth: "100%",
  },
  detailText: {
    fontSize: 12,
    color: "#6B7280",
    flexShrink: 1,
  },
  // Admin-specific styles
  adminHeader: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    paddingTop: 12,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  adminTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  adminTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1F2937",
  },
  viewModeToggle: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    padding: 3,
  },
  viewModeBtn: {
    padding: 8,
    borderRadius: 8,
  },
  viewModeBtnActive: {
    backgroundColor: "#3B82F6",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1F2937",
  },
  filterPicker: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 8,
  },
  filterPickerText: {
    flex: 1,
    fontSize: 14,
    color: "#374151",
  },
  adminStats: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
  },
  statLabel: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
  },
  adminClassCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    alignItems: "center",
  },
  adminClassIndicator: {
    width: 4,
    height: "100%",
    minHeight: 60,
    borderRadius: 2,
    marginRight: 12,
  },
  adminClassContent: {
    flex: 1,
    minWidth: 0,
  },
  adminClassHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  adminClassName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1F2937",
    flex: 1,
    marginRight: 8,
  },
  adminClassSubject: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 6,
  },
  adminClassDetails: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 4,
  },
  schedulePreview: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 4,
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  pickerContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "60%",
  },
  pickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1F2937",
  },
  pickerList: {
    padding: 8,
  },
  pickerItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    borderRadius: 10,
    marginBottom: 4,
  },
  pickerItemActive: {
    backgroundColor: "#EFF6FF",
  },
  pickerItemText: {
    fontSize: 15,
    color: "#374151",
  },
  pickerItemTextActive: {
    color: "#3B82F6",
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  classDetailModal: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1F2937",
  },
  classDetailContent: {
    padding: 16,
  },
  classDetailSection: {
    marginBottom: 20,
  },
  classDetailName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 4,
  },
  classDetailSubject: {
    fontSize: 15,
    color: "#6B7280",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: "#374151",
  },
  scheduleItem: {
    backgroundColor: "#F9FAFB",
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  scheduleDay: {
    backgroundColor: "#3B82F6",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  scheduleDayText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },
  scheduleTime: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1F2937",
    flex: 1,
  },
  scheduleRoom: {
    fontSize: 12,
    color: "#6B7280",
  },
  noScheduleText: {
    fontSize: 14,
    color: "#9CA3AF",
    fontStyle: "italic",
  },
  // Teacher Schedule Card
  teacherScheduleCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    marginHorizontal: 0,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    overflow: "hidden",
  },
  classInfoRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 10,
  },
  attendanceButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#10B981",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    gap: 6,
    marginTop: 4,
  },
  attendanceButtonDisabled: {
    backgroundColor: "#E5E7EB",
  },
  attendanceButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  attendanceButtonTextDisabled: {
    color: "#9CA3AF",
  },
  // Attendance Modal Styles
  attendanceModalContainer: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  attendanceModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  attendanceCloseBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  attendanceModalTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#111827",
  },
  attendanceClassInfo: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  attendanceClassName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 4,
  },
  attendanceDateTime: {
    fontSize: 14,
    color: "#6B7280",
  },
  attendanceStats: {
    flexDirection: "row",
    padding: 16,
    gap: 12,
    backgroundColor: "#FFFFFF",
  },
  attendanceStat: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  attendanceStatValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1F2937",
  },
  attendanceStatLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  attendanceList: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  attendanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  attendanceStudentInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  attendanceAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  attendanceAvatarText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  attendanceStudentDetails: {
    flex: 1,
  },
  attendanceStudentName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  attendanceStudentEmail: {
    fontSize: 12,
    color: "#6B7280",
  },
  attendanceButtons: {
    flexDirection: "row",
    gap: 6,
  },
  attendanceStatusBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  attendanceStatusBtnActive: {
    backgroundColor: "#10B981",
    borderColor: "#10B981",
  },
  attendanceStatusBtnAbsent: {
    borderColor: "#EF4444",
  },
  attendanceStatusBtnAbsentActive: {
    backgroundColor: "#EF4444",
    borderColor: "#EF4444",
  },
  attendanceStatusBtnLate: {
    borderColor: "#F59E0B",
  },
  attendanceStatusBtnLateActive: {
    backgroundColor: "#F59E0B",
    borderColor: "#F59E0B",
  },
  attendanceNoteSection: {
    marginTop: 16,
    marginBottom: 20,
  },
  attendanceNoteLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  attendanceNoteInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: "#111827",
    minHeight: 80,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    textAlignVertical: "top",
  },
  attendanceSaveContainer: {
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  attendanceSaveBtn: {
    borderRadius: 12,
    overflow: "hidden",
  },
  attendanceSaveBtnDisabled: {
    opacity: 0.7,
  },
  attendanceSaveBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 8,
  },
  attendanceSaveBtnText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },

  // ========== TEACHER WEEK VIEW STYLES ==========
  teacherHeader: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  teacherTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  teacherTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
  },
  weekNavRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  weekNavBtnSmall: {
    padding: 6,
    backgroundColor: "#F3F4F6",
    borderRadius: 8,
  },
  weekNavText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
  teacherWeekStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  statCardSmall: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 4,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  statIconSmall: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  statValueSmall: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
  },
  statLabelSmall: {
    fontSize: 10,
    color: "#6B7280",
    marginTop: 2,
  },
  weekGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  dayColumn: {
    width: (width - 48) / 2,
    marginBottom: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  dayColumnToday: {
    borderWidth: 2,
    borderColor: "#10B981",
  },
  dayHeader: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  dayHeaderText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  dayHeaderDate: {
    fontSize: 10,
    color: "rgba(255,255,255,0.8)",
    marginTop: 1,
  },
  emptyDayContent: {
    paddingVertical: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyDayText: {
    fontSize: 16,
    color: "#D1D5DB",
  },
  dayContent: {
    padding: 8,
    gap: 8,
  },
  weekScheduleCard: {
    backgroundColor: "#EFF6FF",
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#DBEAFE",
  },
  weekScheduleCardActive: {
    backgroundColor: "#D1FAE5",
    borderColor: "#10B981",
    borderWidth: 2,
  },
  weekCardClassName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E40AF",
    textAlign: "center",
    marginBottom: 4,
  },
  weekCardSubject: {
    fontSize: 11,
    color: "#4B5563",
    textAlign: "center",
    marginBottom: 6,
  },
  weekCardInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginBottom: 4,
  },
  weekCardInfoText: {
    fontSize: 10,
    color: "#6B7280",
  },
  weekCardTimeBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    gap: 4,
    marginBottom: 4,
  },
  weekCardTime: {
    fontSize: 11,
    fontWeight: "600",
    color: "#374151",
  },
  weekCardActiveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginTop: 4,
    backgroundColor: "#FFFFFF",
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  weekCardActiveText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#059669",
  },
  teacherScheduleCardActive: {
    borderWidth: 2,
    borderColor: "#10B981",
  },
  // FAB styles
  fab: {
    position: "absolute",
    bottom: 24,
    right: 20,
    zIndex: 10,
  },
  fabGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  // Session form styles
  formLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1F2937",
  },
  formPicker: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  formPickerText: {
    flex: 1,
    fontSize: 14,
    color: "#1F2937",
  },
  formButton: {
    borderRadius: 10,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 12,
  },
  formButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    width: "100%",
    borderRadius: 10,
  },
  formButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  typeChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  typeChipActive: {
    backgroundColor: "#EEF2FF",
    borderColor: "#3B82F6",
  },
  typeChipText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6B7280",
  },
  typeChipTextActive: {
    color: "#3B82F6",
  },
  inlineDropdown: {
    marginTop: 4,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#3B82F6",
    borderRadius: 10,
    maxHeight: 200,
    overflow: "hidden",
  },
  inlineDropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  inlineDropdownItemActive: {
    backgroundColor: "#EEF2FF",
  },
  inlineDropdownText: {
    fontSize: 14,
    color: "#374151",
  },
  inlineDropdownTextActive: {
    color: "#3B82F6",
    fontWeight: "600",
  },
});
