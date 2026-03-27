import { create } from "zustand";
import api from "@/lib/api";

export enum SessionStatus {
  Pending = "pending",
  Approved = "approved",
  Cancelled = "cancelled",
}

export enum SessionType {
  Regular = "regular",
  Makeup = "makeup",
  Exam = "exam",
}

export interface Session {
  _id: string;
  classId?:
    | string
    | {
        _id: string;
        name: string;
        subject?: string;
        teacherId?: {
          _id: string;
          name: string;
          email: string;
        };
      };
  teacherId?:
    | string
    | {
        _id: string;
        name: string;
        email: string;
        subjects?: string[];
      };
  subject?: string;
  title?: string;
  room?: string;
  startTime: string;
  endTime: string;
  type: SessionType;
  status: SessionStatus;
  createdBy?: {
    _id: string;
    name: string;
    email: string;
  };
  approvedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  originalSessionId?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  cancelReason?: string;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
}

export enum MakeupConflictPolicy {
  BlockAll = "block_all",
  AllowWithThreshold = "allow_with_threshold",
  AllowWithManualResolution = "allow_with_manual_resolution",
}

export interface CancelAndMakeupData {
  reason: string;
  makeupStartTime: string;
  makeupEndTime: string;
  policy?: MakeupConflictPolicy;
  maxConflictRate?: number;
  dryRun?: boolean;
}

export interface StudentConflictDetail {
  studentId: string;
  studentName: string;
  conflictingClassId: string;
  conflictingClassName: string;
  conflictingSessionId: string;
  conflictingStartTime: string;
  conflictingEndTime: string;
}

export interface MakeupConflictReport {
  classId: string;
  totalStudents: number;
  conflictStudents: StudentConflictDetail[];
  conflictingStudentCount: number;
  conflictingStudentIds: string[];
  conflictRate: number;
  teacherConflicts: Array<{
    sessionId: string;
    startTime: string;
    endTime: string;
  }>;
  roomConflicts: Array<{
    sessionId: string;
    room: string;
    startTime: string;
    endTime: string;
  }>;
  policyDecision: {
    policy: MakeupConflictPolicy;
    canCreate: boolean;
    requiresManualResolution: boolean;
    thresholdUsed?: number;
    reason?: string;
  };
}

export interface CancelAndMakeupResult {
  previewOnly: boolean;
  message?: string;
  originalSessionId: string;
  makeupSessionId?: string;
  proposedMakeup?: {
    startTime: string;
    endTime: string;
  };
  report: MakeupConflictReport;
  makeupSession?: Session;
}

export interface CreateSessionData {
  classId?: string;
  teacherId?: string;
  subject?: string;
  title?: string;
  room?: string;
  startTime: string;
  endTime: string;
  type?: SessionType;
  note?: string;
}

export interface UpdateSessionData {
  classId?: string;
  teacherId?: string;
  subject?: string;
  title?: string;
  room?: string;
  startTime?: string;
  endTime?: string;
  type?: SessionType;
  status?: SessionStatus;
  note?: string;
}

export interface ScheduleQuery {
  startDate: string;
  endDate: string;
  teacherId?: string;
  classId?: string;
  branchId?: string;
  status?: SessionStatus;
}

export interface GenerateSessionsData {
  classId: string;
  startDate: string;
  endDate: string;
  type?: SessionType;
}

export interface ConflictCheckData {
  teacherId: string;
  startTime: string;
  endTime: string;
  excludeSessionId?: string;
}

export interface ConflictResult {
  hasConflict: boolean;
  conflicts: Session[];
}

export interface SessionStatistics {
  total: number;
  byStatus: Record<string, number>;
}

interface ScheduleState {
  sessions: Session[];
  selectedSession: Session | null;
  isLoading: boolean;
  error: string | null;
  statistics: SessionStatistics | null;
}

interface ScheduleActions {
  // Fetch operations
  fetchSchedule: (query: ScheduleQuery) => Promise<void>;
  fetchTeacherSchedule: (
    teacherId: string,
    startDate: string,
    endDate: string,
  ) => Promise<void>;
  fetchStudentSchedule: (
    studentId: string,
    startDate: string,
    endDate: string,
  ) => Promise<void>;
  fetchSessionById: (id: string) => Promise<Session>;
  fetchStatistics: (
    startDate: string,
    endDate: string,
    branchId?: string,
  ) => Promise<void>;

  // CRUD operations
  createSession: (data: CreateSessionData) => Promise<Session>;
  updateSession: (id: string, data: UpdateSessionData) => Promise<Session>;
  deleteSession: (id: string) => Promise<void>;

  // Bulk operations
  generateSessions: (
    data: GenerateSessionsData,
  ) => Promise<{ message: string; sessions: Session[] }>;
  bulkCreateSessions: (
    classId: string,
    sessions: Array<{
      startTime: string;
      endTime: string;
      type?: SessionType;
      note?: string;
    }>,
  ) => Promise<Session[]>;

  // Utility
  checkConflict: (data: ConflictCheckData) => Promise<ConflictResult>;
  cancelAndMakeupSession: (
    id: string,
    data: CancelAndMakeupData,
  ) => Promise<CancelAndMakeupResult>;
  setSelectedSession: (session: Session | null) => void;
  clearError: () => void;
}

export const useScheduleStore = create<ScheduleState & ScheduleActions>(
  (set, get) => ({
    sessions: [],
    selectedSession: null,
    isLoading: false,
    error: null,
    statistics: null,

    fetchSchedule: async (query: ScheduleQuery) => {
      set({ isLoading: true, error: null });
      try {
        const params = new URLSearchParams();
        params.append("startDate", query.startDate);
        params.append("endDate", query.endDate);
        if (query.teacherId) params.append("teacherId", query.teacherId);
        if (query.classId) params.append("classId", query.classId);
        if (query.branchId) params.append("branchId", query.branchId);
        if (query.status) params.append("status", query.status);

        const response = await api.get(
          `/sessions/schedule?${params.toString()}`,
        );
        set({ sessions: response.data, isLoading: false });
      } catch (error: any) {
        set({
          error: error.response?.data?.message || "Failed to fetch schedule",
          isLoading: false,
        });
        throw error;
      }
    },

    fetchTeacherSchedule: async (
      teacherId: string,
      startDate: string,
      endDate: string,
    ) => {
      set({ isLoading: true, error: null });
      try {
        const response = await api.get(
          `/sessions/teacher/${teacherId}?startDate=${startDate}&endDate=${endDate}`,
        );
        set({ sessions: response.data, isLoading: false });
      } catch (error: any) {
        set({
          error:
            error.response?.data?.message || "Failed to fetch teacher schedule",
          isLoading: false,
        });
        throw error;
      }
    },

    fetchStudentSchedule: async (
      studentId: string,
      startDate: string,
      endDate: string,
    ) => {
      set({ isLoading: true, error: null });
      try {
        const response = await api.get(
          `/sessions/student/${studentId}?startDate=${startDate}&endDate=${endDate}`,
        );
        set({ sessions: response.data, isLoading: false });
      } catch (error: any) {
        set({
          error:
            error.response?.data?.message || "Failed to fetch student schedule",
          isLoading: false,
        });
        throw error;
      }
    },

    fetchSessionById: async (id: string) => {
      set({ isLoading: true, error: null });
      try {
        const response = await api.get(`/sessions/${id}`);
        set({ selectedSession: response.data, isLoading: false });
        return response.data;
      } catch (error: any) {
        set({
          error: error.response?.data?.message || "Failed to fetch session",
          isLoading: false,
        });
        throw error;
      }
    },

    fetchStatistics: async (
      startDate: string,
      endDate: string,
      branchId?: string,
    ) => {
      set({ isLoading: true, error: null });
      try {
        let url = `/sessions/statistics?startDate=${startDate}&endDate=${endDate}`;
        if (branchId) url += `&branchId=${branchId}`;
        const response = await api.get(url);
        set({ statistics: response.data, isLoading: false });
      } catch (error: any) {
        set({
          error: error.response?.data?.message || "Failed to fetch statistics",
          isLoading: false,
        });
        throw error;
      }
    },

    createSession: async (data: CreateSessionData) => {
      set({ isLoading: true, error: null });
      try {
        const response = await api.post("/sessions", data);
        const newSession = response.data;
        set((state) => ({
          sessions: [...state.sessions, newSession],
          isLoading: false,
        }));
        return newSession;
      } catch (error: any) {
        set({
          error: error.response?.data?.message || "Failed to create session",
          isLoading: false,
        });
        throw error;
      }
    },

    updateSession: async (id: string, data: UpdateSessionData) => {
      set({ isLoading: true, error: null });
      try {
        const response = await api.patch(`/sessions/${id}`, data);
        const updatedSession = response.data;
        set((state) => ({
          sessions: state.sessions.map((s) =>
            s._id === id ? updatedSession : s,
          ),
          selectedSession:
            state.selectedSession?._id === id
              ? updatedSession
              : state.selectedSession,
          isLoading: false,
        }));
        return updatedSession;
      } catch (error: any) {
        set({
          error: error.response?.data?.message || "Failed to update session",
          isLoading: false,
        });
        throw error;
      }
    },

    deleteSession: async (id: string) => {
      set({ isLoading: true, error: null });
      try {
        await api.delete(`/sessions/${id}`);
        set((state) => ({
          sessions: state.sessions.filter((s) => s._id !== id),
          selectedSession:
            state.selectedSession?._id === id ? null : state.selectedSession,
          isLoading: false,
        }));
      } catch (error: any) {
        set({
          error: error.response?.data?.message || "Failed to delete session",
          isLoading: false,
        });
        throw error;
      }
    },

    generateSessions: async (data: GenerateSessionsData) => {
      set({ isLoading: true, error: null });
      try {
        const response = await api.post("/sessions/generate", data);
        const result = response.data;
        set((state) => ({
          sessions: [...state.sessions, ...result.sessions],
          isLoading: false,
        }));
        return result;
      } catch (error: any) {
        set({
          error: error.response?.data?.message || "Failed to generate sessions",
          isLoading: false,
        });
        throw error;
      }
    },

    bulkCreateSessions: async (
      classId: string,
      sessions: Array<{
        startTime: string;
        endTime: string;
        type?: SessionType;
        note?: string;
      }>,
    ) => {
      set({ isLoading: true, error: null });
      try {
        const response = await api.post("/sessions/bulk", {
          classId,
          sessions,
        });
        const createdSessions = response.data;
        set((state) => ({
          sessions: [...state.sessions, ...createdSessions],
          isLoading: false,
        }));
        return createdSessions;
      } catch (error: any) {
        set({
          error:
            error.response?.data?.message || "Failed to bulk create sessions",
          isLoading: false,
        });
        throw error;
      }
    },

    checkConflict: async (data: ConflictCheckData) => {
      try {
        const response = await api.post("/sessions/check-conflict", data);
        return response.data;
      } catch (error: any) {
        throw error;
      }
    },

    cancelAndMakeupSession: async (id: string, data: CancelAndMakeupData) => {
      set({ isLoading: true, error: null });
      try {
        const response = await api.post(
          `/sessions/${id}/cancel-and-makeup`,
          data,
        );
        const result = response.data as CancelAndMakeupResult;
        if (!result.previewOnly && result.makeupSession) {
          set((state) => ({
            sessions: state.sessions
              .map((s) =>
                s._id === result.originalSessionId
                  ? { ...s, status: SessionStatus.Cancelled }
                  : s,
              )
              .concat(result.makeupSession as Session),
            isLoading: false,
          }));
        } else {
          set({ isLoading: false });
        }
        return result;
      } catch (error: any) {
        const responseMessage = error?.response?.data?.message;
        const message =
          typeof responseMessage === "string"
            ? responseMessage
            : responseMessage?.message ||
              "Failed to cancel and create make-up session";
        set({
          error: message,
          isLoading: false,
        });
        throw error;
      }
    },

    setSelectedSession: (session: Session | null) => {
      set({ selectedSession: session });
    },

    clearError: () => {
      set({ error: null });
    },
  }),
);

// Helper functions
export const getSessionClassName = (session: Session): string => {
  // First check for title (new format)
  if (session.title) {
    return session.title;
  }
  // Then check for subject (new format)
  if (session.subject) {
    return session.subject;
  }
  // Fallback to classId (old format)
  if (typeof session.classId === "string") {
    return session.classId;
  }
  return session.classId?.name || "Unknown";
};

export const getSessionTeacherName = (session: Session): string => {
  // First check for teacherId directly on session (new format)
  if (session.teacherId) {
    if (typeof session.teacherId === "string") {
      return session.teacherId;
    }
    return session.teacherId.name || "Unknown";
  }
  // Fallback to classId.teacherId (old format)
  if (typeof session.classId === "string") {
    return "Unknown";
  }
  return session.classId?.teacherId?.name || "Unknown";
};

export const formatSessionTime = (session: Session): string => {
  const start = new Date(session.startTime);
  const end = new Date(session.endTime);
  return `${start.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  })} - ${end.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

export const getStatusColor = (status: SessionStatus): string => {
  switch (status) {
    case SessionStatus.Approved:
      return "bg-green-100 text-green-800";
    case SessionStatus.Pending:
      return "bg-yellow-100 text-yellow-800";
    case SessionStatus.Cancelled:
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

export const getTypeColor = (type: SessionType): string => {
  switch (type) {
    case SessionType.Regular:
      return "bg-blue-100 text-blue-800";
    case SessionType.Makeup:
      return "bg-purple-100 text-purple-800";
    case SessionType.Exam:
      return "bg-orange-100 text-orange-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};
