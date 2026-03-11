import { create } from "zustand";
import api from "@/lib/api";

export interface ChildInfo {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  studentCode?: string;
  dateOfBirth?: string;
  avatarUrl?: string;
}

export interface ChildClassInfo {
  _id: string;
  name: string;
  description?: string;
  subject?: string;
  teacherName: string;
  teacherId?: string;
  schedule: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    room?: string;
  }>;
  studentCount: number;
}

export interface ChildSession {
  _id: string;
  classId: string;
  className: string;
  date: string;
  startTime: string;
  endTime: string;
  topic?: string;
  status: "scheduled" | "completed" | "cancelled";
  attendanceStatus?: "present" | "absent" | "late" | "excused" | null;
}

export interface ChildGrade {
  _id: string;
  title: string;
  className: string;
  classId?: string | null;
  teacherName?: string | null;
  score: number | null;
  maxScore: number | null;
  percentage: number | null;
  assessedAt: string | null;
  weight?: number | null;
  type?: string | null;
  feedback?: string | null;
  dueDate?: string | null;
  submittedAt?: string | null;
}

export interface ParentDashboardData {
  child: ChildInfo | null;
  classes: ChildClassInfo[];
  upcomingSessions: ChildSession[];
  recentGrades: ChildGrade[];
  attendanceRecords: Array<{
    _id: string;
    status: "present" | "absent" | "late" | "excused";
    sessionId:
      | {
          _id: string;
          startTime: string;
          classId: { _id: string; name: string } | string;
        }
      | string;
    createdAt: string;
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

interface ParentDashboardState {
  data: ParentDashboardData | null;
  isLoading: boolean;
  error: string | null;
}

interface ParentDashboardActions {
  fetchDashboardData: (parentId: string, childEmail?: string) => Promise<void>;
  clearError: () => void;
}

export const useParentDashboardStore = create<
  ParentDashboardState & ParentDashboardActions
>((set) => ({
  data: null,
  isLoading: false,
  error: null,

  fetchDashboardData: async (parentId: string, childEmail?: string) => {
    set({ isLoading: true, error: null });

    try {
      // First, get the child info
      let childId: string | null = null;
      let childInfo: ChildInfo | null = null;

      if (childEmail) {
        // If childEmail is provided, find the child using new endpoint
        try {
          const childRes = await api.get("/users/child-by-email", {
            params: { email: childEmail },
          });
          if (childRes.data) {
            const child = childRes.data;
            childId = child._id;
            childInfo = {
              _id: child._id,
              name: child.name,
              email: child.email,
              phone: child.phone,
              studentCode: child.studentCode,
              dateOfBirth: child.dateOfBirth,
              avatarUrl: child.avatarUrl,
            };
          }
        } catch (e) {
          console.error("Error fetching child info:", e);
        }
      }

      if (!childId) {
        // No child found
        set({
          data: {
            child: null,
            classes: [],
            upcomingSessions: [],
            recentGrades: [],
            attendanceRecords: [],
            attendanceStats: {
              present: 0,
              absent: 0,
              late: 0,
              total: 0,
              rate: 0,
            },
            tuitionStatus: [],
          },
          isLoading: false,
        });
        return;
      }

      // Fetch data for the child (similar to student dashboard)
      const [
        classesRes,
        sessionsRes,
        assessmentsRes,
        attendanceRes,
        tuitionRes,
      ] = await Promise.allSettled([
        api.get("/classes", { params: { studentId: childId } }),
        api.get("/sessions", {
          params: { studentId: childId, status: "scheduled", limit: 10 },
        }),
        api.get("/assessments", { params: { studentId: childId, limit: 10 } }),
        api.get("/attendance/statistics", { params: { studentId: childId } }),
        api.get("/tuition", {
          params: { studentId: childId, status: "pending" },
        }),
      ]);

      // Process classes
      const classes =
        classesRes.status === "fulfilled"
          ? Array.isArray(classesRes.value.data)
            ? classesRes.value.data
            : classesRes.value.data.classes || []
          : [];

      // Process sessions with attendance
      const sessionsRaw =
        sessionsRes.status === "fulfilled"
          ? Array.isArray(sessionsRes.value.data)
            ? sessionsRes.value.data
            : sessionsRes.value.data.sessions || []
          : [];

      // Fetch attendance records for the child
      let attendanceRecords: any[] = [];
      try {
        const attendanceRecordsRes = await api.get("/attendance", {
          params: { studentId: childId },
        });
        attendanceRecords = Array.isArray(attendanceRecordsRes.data)
          ? attendanceRecordsRes.data
          : attendanceRecordsRes.data.attendance || [];
      } catch (e) {
        console.error("Error fetching attendance records:", e);
      }

      const upcomingSessions = sessionsRaw.map((s: any) => {
        // Try to find attendance by sessionId first
        let attendanceRecord = attendanceRecords.find(
          (r: any) => r.sessionId === s._id || r.sessionId?._id === s._id,
        );

        // If not found, try to find by date
        if (!attendanceRecord) {
          const sessionDate = new Date(s.date || s.startTime);
          sessionDate.setHours(0, 0, 0, 0);
          attendanceRecord = attendanceRecords.find((r: any) => {
            const session = r.sessionId;
            if (session?.startTime) {
              const attDate = new Date(session.startTime);
              attDate.setHours(0, 0, 0, 0);
              return attDate.getTime() === sessionDate.getTime();
            }
            return false;
          });
        }

        return {
          _id: s._id,
          classId: s.classId?._id || s.classId,
          className: s.class?.name || s.classId?.name || "Lớp học",
          date: s.date || s.startTime,
          startTime: s.startTime,
          endTime: s.endTime,
          topic: s.topic,
          status: s.status,
          attendanceStatus: attendanceRecord?.status || null,
        };
      });

      // Process assessments
      const assessmentsRaw =
        assessmentsRes.status === "fulfilled"
          ? Array.isArray(assessmentsRes.value.data)
            ? assessmentsRes.value.data
            : assessmentsRes.value.data.assessments || []
          : [];

      const recentGrades = assessmentsRaw
        .map((a: any) => {
          const score = typeof a.score === "number" ? a.score : null;
          const maxScore = typeof a.maxScore === "number" ? a.maxScore : null;
          const calculatedPercentage =
            score !== null && maxScore && maxScore > 0
              ? Math.round(((score / maxScore) * 100 + Number.EPSILON) * 10) /
                10
              : null;
          const payloadPercentage =
            typeof a.percentage === "number"
              ? a.percentage
              : typeof a.percentage === "string"
                ? Number(a.percentage)
                : null;
          const rawPercentage =
            typeof payloadPercentage === "number" &&
            !Number.isNaN(payloadPercentage)
              ? Math.round((payloadPercentage + Number.EPSILON) * 10) / 10
              : null;
          const percentage = calculatedPercentage ?? rawPercentage;
          const assessedAt =
            a.assessedAt ||
            a.submittedAt ||
            a.dueDate ||
            a.updatedAt ||
            a.createdAt ||
            null;
          const rawClassName =
            a.class?.name ||
            a.className ||
            a.class?.className ||
            a.subject ||
            null;
          const className =
            rawClassName && rawClassName !== "N/A" ? rawClassName : "Lớp học";
          const maybeClassId =
            typeof a.classId !== "undefined" && a.classId !== null
              ? a.classId
              : a.class?._id;
          const classId =
            typeof maybeClassId === "string"
              ? maybeClassId
              : typeof maybeClassId?.toString === "function"
                ? maybeClassId.toString()
                : null;
          const teacherName =
            a.class?.teacher?.name ||
            a.class?.teacherId?.name ||
            a.teacher?.name ||
            a.teacherId?.name ||
            a.teacherName ||
            null;

          return {
            _id: a._id,
            title: a.title,
            className,
            classId,
            teacherName,
            score,
            maxScore,
            percentage,
            assessedAt,
            weight: typeof a.weight === "number" ? a.weight : null,
            type: a.type || null,
            feedback: a.feedback || null,
            dueDate: a.dueDate || null,
            submittedAt: a.submittedAt || null,
          };
        })
        .sort((a: any, b: any) => {
          const aTime = a.assessedAt ? new Date(a.assessedAt).getTime() : 0;
          const bTime = b.assessedAt ? new Date(b.assessedAt).getTime() : 0;
          return bTime - aTime;
        });

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
          child: childInfo,
          classes: classes.map((c: any) => ({
            _id: c._id,
            name: c.name,
            description: c.description,
            subject: c.subject,
            teacherName: c.teacherId?.name || c.teacher?.name || "N/A",
            teacherId: c.teacherId?._id || c.teacher?._id || c.teacherId,
            schedule: c.schedule || [],
            studentCount: c.studentIds?.length || 0,
            status: c.status || "active",
          })),
          upcomingSessions,
          recentGrades,
          attendanceRecords,
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
