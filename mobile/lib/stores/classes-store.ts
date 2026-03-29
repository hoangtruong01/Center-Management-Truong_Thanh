import { create } from "zustand";
import api from "@/lib/api";
import { translateErrorMessage } from "./auth-store";

export interface ClassSchedule {
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  room?: string;
}

export interface Class {
  _id: string;
  name: string;
  description?: string;
  subject: string;
  grade?: string;
  branchId: string;
  teacherId: string;
  studentIds: string[];
  schedule: ClassSchedule[];
  startDate: Date;
  endDate: Date;
  maxStudents: number;
  tuitionFee: number;
  status: "active" | "inactive" | "completed";
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Populated fields
  teacher?: {
    _id: string;
    fullName: string;
    name?: string;
    email: string;
  };
  branch?: {
    _id: string;
    name: string;
  };
  students?: Array<{
    _id: string;
    fullName?: string;
    name?: string;
    email: string;
  }>;
}

export interface StudentScheduleConflict {
  classId: string;
  className: string;
  subject?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface ClassTransferRequest {
  _id: string;
  type: string;
  status: "pending" | "approved" | "rejected";
  approvedBy?: string;
  createdAt?: string;
  updatedAt?: string;
  metadata?: {
    studentId: string;
    studentName?: string;
    fromClassId: string;
    fromClassName?: string;
    toClassId: string;
    toClassName?: string;
    reason?: string;
    requestedBy?: string;
    requestedAt?: string;
    rejectReason?: string;
    approvedAt?: string;
    rejectedAt?: string;
    notifiedUsers?: string[];
    auditLogs?: Array<{
      action: "requested" | "approved" | "rejected" | "executed";
      by?: string;
      at: string;
      note?: string;
    }>;
  };
}

interface CreateClassData {
  name: string;
  description?: string;
  subject?: string;
  grade?: string;
  teacherId: string;
  branchId: string;
  schedule?: ClassSchedule[];
  maxStudents?: number;
  startDate?: string;
  endDate?: string;
}

interface UpdateClassData {
  name?: string;
  description?: string;
  subject?: string;
  grade?: string;
  teacherId?: string;
  branchId?: string;
  schedule?: ClassSchedule[];
  maxStudents?: number;
  status?: "active" | "inactive" | "completed";
  startDate?: string;
  endDate?: string;
}

interface ClassesState {
  classes: Class[];
  currentClass: Class | null;
  isLoading: boolean;
  error: string | null;

  fetchClasses: (branchId?: string, studentId?: string) => Promise<void>;
  fetchClassById: (id: string) => Promise<void>;
  createClass: (data: CreateClassData) => Promise<Class>;
  updateClass: (id: string, data: UpdateClassData) => Promise<Class>;
  deleteClass: (id: string) => Promise<void>;
  checkStudentScheduleConflicts: (
    classId: string,
    studentId: string,
    excludeClassId?: string,
  ) => Promise<{
    hasConflict: boolean;
    conflictingClasses: string[];
    conflicts: StudentScheduleConflict[];
  }>;
  createClassTransferRequest: (data: {
    studentId: string;
    fromClassId: string;
    toClassId: string;
    reason?: string;
  }) => Promise<ClassTransferRequest>;
  fetchClassTransferRequests: (
    status?: "pending" | "approved" | "rejected",
  ) => Promise<ClassTransferRequest[]>;
  approveClassTransferRequest: (requestId: string) => Promise<void>;
  rejectClassTransferRequest: (
    requestId: string,
    reason?: string,
  ) => Promise<void>;
  bulkApproveClassTransferRequests: (requestIds: string[]) => Promise<{
    total: number;
    success: number;
    failed: number;
    failures: Array<{ requestId: string; error: string }>;
  }>;
  bulkRejectClassTransferRequests: (
    requestIds: string[],
    reason?: string,
  ) => Promise<{
    total: number;
    success: number;
    failed: number;
    failures: Array<{ requestId: string; error: string }>;
  }>;
  clearError: () => void;
}

// Helper function to normalize class data
const normalizeClass = (c: any): Class => {
  const normalized: any = { ...c };

  // Compute isActive from the status field returned by the backend
  normalized.isActive = c.status === "active";

  if (c.teacherId && typeof c.teacherId === "object" && c.teacherId._id) {
    normalized.teacher = c.teacherId;
  }

  if (c.branchId && typeof c.branchId === "object" && c.branchId._id) {
    normalized.branch = c.branchId;
  }

  if (c.studentIds && Array.isArray(c.studentIds)) {
    if (c.studentIds.length > 0 && typeof c.studentIds[0] === "object") {
      normalized.students = c.studentIds;
      normalized.studentIds = c.studentIds.map((s: any) => s._id);
    }
  }

  return normalized as Class;
};

export const useClassesStore = create<ClassesState>((set, get) => ({
  classes: [],
  currentClass: null,
  isLoading: false,
  error: null,

  fetchClasses: async (branchId?: string, studentId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const params: Record<string, string> = {};
      if (branchId) params.branchId = branchId;
      if (studentId) params.studentId = studentId;

      const response = await api.get("/classes", { params });
      const classes = Array.isArray(response.data)
        ? response.data
        : response.data.classes || [];
      const normalizedClasses = classes.map(normalizeClass);
      set({ classes: normalizedClasses, isLoading: false });
    } catch (error: any) {
      const errorMessage = translateErrorMessage(
        error,
        "Không thể tải danh sách lớp học",
      );
      set({ error: errorMessage, isLoading: false });
    }
  },

  fetchClassById: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get(`/classes/${id}`);
      const classData = normalizeClass(response.data);
      set({ currentClass: classData, isLoading: false });
    } catch (error: any) {
      const errorMessage = translateErrorMessage(
        error,
        "Không thể tải thông tin lớp học",
      );
      set({ error: errorMessage, isLoading: false });
    }
  },

  createClass: async (data: CreateClassData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post("/classes", data);
      const newClass = normalizeClass(response.data);
      set((state) => ({
        classes: [...state.classes, newClass],
        isLoading: false,
      }));
      return newClass;
    } catch (error: any) {
      const errorMessage = translateErrorMessage(error, "Lỗi khi tạo lớp học");
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  updateClass: async (id: string, data: UpdateClassData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.patch(`/classes/${id}`, data);
      const updatedClass = normalizeClass(response.data);
      set((state) => ({
        classes: state.classes.map((c) => (c._id === id ? updatedClass : c)),
        currentClass:
          state.currentClass?._id === id ? updatedClass : state.currentClass,
        isLoading: false,
      }));
      return updatedClass;
    } catch (error: any) {
      const errorMessage = translateErrorMessage(
        error,
        "Lỗi khi cập nhật lớp học",
      );
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  deleteClass: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.delete(`/classes/${id}`);
      set((state) => ({
        classes: state.classes.filter((c) => c._id !== id),
        currentClass:
          state.currentClass?._id === id ? null : state.currentClass,
        isLoading: false,
      }));
    } catch (error: any) {
      const errorMessage = translateErrorMessage(error, "Lỗi khi xóa lớp học");
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  checkStudentScheduleConflicts: async (
    classId: string,
    studentId: string,
    excludeClassId?: string,
  ) => {
    try {
      const query = excludeClassId
        ? `?excludeClassId=${encodeURIComponent(excludeClassId)}`
        : "";
      const response = await api.get(
        `/classes/${classId}/students/${studentId}/conflicts${query}`,
      );
      return response.data;
    } catch (error: any) {
      const errorMessage = translateErrorMessage(
        error,
        "Lỗi khi kiểm tra trùng lịch",
      );
      throw new Error(errorMessage);
    }
  },

  createClassTransferRequest: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post("/admin/class-transfer-requests", data);
      set({ isLoading: false });
      return response.data;
    } catch (error: any) {
      const errorMessage = translateErrorMessage(
        error,
        "Lỗi khi tạo yêu cầu chuyển lớp",
      );
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  fetchClassTransferRequests: async (status) => {
    try {
      const response = await api.get("/admin/class-transfer-requests", {
        params: status ? { status } : undefined,
      });
      return Array.isArray(response.data) ? response.data : [];
    } catch (error: any) {
      const errorMessage = translateErrorMessage(
        error,
        "Lỗi khi tải danh sách yêu cầu chuyển lớp",
      );
      throw new Error(errorMessage);
    }
  },

  approveClassTransferRequest: async (requestId: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.post(`/admin/class-transfer-requests/${requestId}/approve`);
      set({ isLoading: false });
    } catch (error: any) {
      const errorMessage = translateErrorMessage(
        error,
        "Lỗi khi duyệt yêu cầu chuyển lớp",
      );
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  rejectClassTransferRequest: async (requestId: string, reason?: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.post(`/admin/class-transfer-requests/${requestId}/reject`, {
        reason,
      });
      set({ isLoading: false });
    } catch (error: any) {
      const errorMessage = translateErrorMessage(
        error,
        "Lỗi khi từ chối yêu cầu chuyển lớp",
      );
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  bulkApproveClassTransferRequests: async (requestIds: string[]) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post(
        "/admin/class-transfer-requests/bulk-approve",
        { requestIds },
      );
      set({ isLoading: false });
      return response.data;
    } catch (error: any) {
      const errorMessage = translateErrorMessage(
        error,
        "Lỗi khi duyệt hàng loạt yêu cầu chuyển lớp",
      );
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  bulkRejectClassTransferRequests: async (
    requestIds: string[],
    reason?: string,
  ) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post(
        "/admin/class-transfer-requests/bulk-reject",
        {
          requestIds,
          reason,
        },
      );
      set({ isLoading: false });
      return response.data;
    } catch (error: any) {
      const errorMessage = translateErrorMessage(
        error,
        "Lỗi khi từ chối hàng loạt yêu cầu chuyển lớp",
      );
      set({ error: errorMessage, isLoading: false });
      throw new Error(errorMessage);
    }
  },

  clearError: () => set({ error: null }),
}));
