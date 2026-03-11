import { create } from "zustand";
import api from "@/lib/api";

export interface Session {
  _id: string;
  id?: string;
  classId: string;
  date: string;
  startTime: string;
  endTime: string;
  topic?: string;
  status: "scheduled" | "completed" | "cancelled";
  createdAt?: string;
  // Populated
  class?: {
    _id: string;
    name: string;
    teacher?: {
      _id: string;
      name: string;
    };
  };
}

export interface StudentDashboardData {
  classes: Array<{
    _id: string;
    name: string;
    description?: string;
    teacherName: string;
    schedule: Array<{
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      room?: string;
    }>;
    studentCount: number;
    progress?: number;
  }>;
  upcomingSessions: Session[];
  recentGrades: Array<{
    _id: string;
    title: string;
    className: string;
    score: number;
    maxScore: number;
    percentage: number;
    assessedAt: string;
  }>;
  attendanceStats: {
    present: number;
    absent: number;
    late: number;
    total: number;
    rate: number;
  };
  tuitionStatus: Array<{
    _id: string;
    className: string;
    amount: number;
    period: string;
    dueDate: string;
    status: "pending" | "paid" | "overdue";
  }>;
}

interface StudentDashboardState {
  data: StudentDashboardData | null;
  isLoading: boolean;
  error: string | null;
}

interface StudentDashboardActions {
  fetchDashboardData: (studentId: string) => Promise<void>;
  clearError: () => void;
}

export const useStudentDashboardStore = create<
  StudentDashboardState & StudentDashboardActions
>((set) => ({
  data: null,
  isLoading: false,
  error: null,

  fetchDashboardData: async (studentId: string) => {
    set({ isLoading: true, error: null });

    try {
      // Fetch multiple endpoints in parallel
      const [
        classesRes,
        sessionsRes,
        assessmentsRes,
        attendanceRes,
        tuitionRes,
      ] = await Promise.allSettled([
        api.get("/classes", { params: { studentId } }),
        api.get("/sessions", {
          params: { studentId, status: "scheduled", limit: 10 },
        }),
        api.get("/assessments", { params: { studentId, limit: 10 } }),
        api.get("/attendance/statistics", { params: { studentId } }),
        api.get("/tuition", { params: { studentId, status: "pending" } }),
      ]);

      // Process classes
      const classes =
        classesRes.status === "fulfilled"
          ? Array.isArray(classesRes.value.data)
            ? classesRes.value.data
            : classesRes.value.data.classes || []
          : [];

      // Process sessions
      const upcomingSessions =
        sessionsRes.status === "fulfilled"
          ? Array.isArray(sessionsRes.value.data)
            ? sessionsRes.value.data
            : sessionsRes.value.data.sessions || []
          : [];

      // Process assessments
      const assessmentsRaw =
        assessmentsRes.status === "fulfilled"
          ? Array.isArray(assessmentsRes.value.data)
            ? assessmentsRes.value.data
            : assessmentsRes.value.data.assessments || []
          : [];

      const recentGrades = assessmentsRaw.map((a: any) => ({
        _id: a._id,
        title: a.title,
        className: a.class?.name || "N/A",
        score: a.score,
        maxScore: a.maxScore,
        percentage: (a.score / a.maxScore) * 100,
        assessedAt: a.assessedAt,
      }));

      // Process attendance stats
      const attendanceStats =
        attendanceRes.status === "fulfilled"
          ? attendanceRes.value.data
          : { present: 0, absent: 0, late: 0, total: 0, rate: 0 };

      // Process tuition
      const tuitionRaw =
        tuitionRes.status === "fulfilled"
          ? Array.isArray(tuitionRes.value.data)
            ? tuitionRes.value.data
            : tuitionRes.value.data.tuition || []
          : [];

      const tuitionStatus = tuitionRaw.map((t: any) => ({
        _id: t._id,
        className: t.class?.name || "N/A",
        amount: t.amount,
        period: t.period,
        dueDate: t.dueDate,
        status: t.status,
      }));

      set({
        data: {
          classes: classes.map((c: any) => ({
            _id: c._id,
            name: c.name,
            description: c.description,
            teacherName: c.teacherId?.name || c.teacher?.name || "Chưa có GV",
            schedule: c.schedule || [],
            studentCount: c.studentIds?.length || 0,
            status: c.status || "active",
            progress: 75, // TODO: Calculate from sessions
          })),
          upcomingSessions,
          recentGrades,
          attendanceStats,
          tuitionStatus,
        },
        isLoading: false,
      });
    } catch (error: any) {
      const message =
        error.response?.data?.message || "Lỗi khi tải dữ liệu dashboard";
      set({ isLoading: false, error: message });
      throw new Error(message);
    }
  },

  clearError: () => set({ error: null }),
}));
