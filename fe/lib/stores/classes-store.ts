import { create } from "zustand";
import api from "@/lib/api";

export interface Class {
  _id: string;
  id?: string;
  name: string;
  description?: string;
  subject?: string;
  grade?: string;
  // teacherId and branchId can be string (ID) or populated object
  teacherId: string | { _id: string; name: string; email: string };
  branchId: string | { _id: string; name: string };
  schedule: ClassSchedule[];
  studentIds: string[];
  maxStudents: number;
  status: "active" | "inactive" | "completed";
  startDate?: string;
  endDate?: string;
  createdAt?: string;
  updatedAt?: string;
  // Populated fields (aliases when populated)
  teacher?: {
    _id: string;
    name: string;
    email: string;
  };
  branch?: {
    _id: string;
    name: string;
  };
  students?: Array<{
    _id: string;
    name: string;
    email: string;
  }>;
}

export interface ClassSchedule {
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  room?: string;
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

interface ClassesState {
  classes: Class[];
  selectedClass: Class | null;
  isLoading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

interface ClassesActions {
  fetchClasses: (params?: FetchClassesParams) => Promise<void>;
  fetchClassById: (id: string) => Promise<Class>;
  createClass: (data: CreateClassData) => Promise<Class>;
  updateClass: (id: string, data: UpdateClassData) => Promise<Class>;
  deleteClass: (id: string) => Promise<void>;
  addStudentToClass: (classId: string, studentId: string) => Promise<void>;
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
  transferStudentToClass: (
    toClassId: string,
    fromClassId: string,
    studentId: string,
  ) => Promise<void>;
  removeStudentFromClass: (classId: string, studentId: string) => Promise<void>;
  setSelectedClass: (classData: Class | null) => void;
  clearError: () => void;
}

interface FetchClassesParams {
  page?: number;
  limit?: number;
  teacherId?: string;
  branchId?: string;
  status?: "active" | "inactive" | "completed";
  search?: string;
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

// Helper function to normalize class data from API
const normalizeClass = (c: any): Class => {
  const normalized: any = { ...c, id: c._id };

  // Set teacher alias from populated teacherId
  if (c.teacherId && typeof c.teacherId === "object" && c.teacherId._id) {
    normalized.teacher = c.teacherId;
  }

  // Set branch alias from populated branchId
  if (c.branchId && typeof c.branchId === "object" && c.branchId._id) {
    normalized.branch = c.branchId;
  }

  // Set students alias and normalize studentIds to string array
  if (c.studentIds && Array.isArray(c.studentIds)) {
    if (c.studentIds.length > 0 && typeof c.studentIds[0] === "object") {
      // studentIds is populated with full user objects
      normalized.students = c.studentIds;
      normalized.studentIds = c.studentIds.map((s: any) => s._id);
    } else {
      // studentIds is already string array
      normalized.studentIds = c.studentIds;
    }
  }

  return normalized as Class;
};

export const useClassesStore = create<ClassesState & ClassesActions>(
  (set, get) => ({
    // State
    classes: [],
    selectedClass: null,
    isLoading: false,
    error: null,
    pagination: {
      page: 1,
      limit: 20,
      total: 0,
    },

    // Actions
    fetchClasses: async (params?: FetchClassesParams) => {
      set({ isLoading: true, error: null });
      try {
        const response = await api.get("/classes", { params });
        const classes = Array.isArray(response.data)
          ? response.data
          : response.data.classes || [];

        // Normalize class data using helper function
        const normalizedClasses = classes.map(normalizeClass);

        set({
          classes: normalizedClasses,
          isLoading: false,
          pagination: {
            ...get().pagination,
            total: response.data.total || classes.length,
          },
        });
      } catch (error: any) {
        const message =
          error.response?.data?.message || "Lỗi khi tải danh sách lớp học";
        set({ isLoading: false, error: message });
        throw new Error(message);
      }
    },

    fetchClassById: async (id: string) => {
      set({ isLoading: true, error: null });
      try {
        const response = await api.get(`/classes/${id}`);
        const classData = normalizeClass(response.data);
        set({ selectedClass: classData, isLoading: false });
        return classData;
      } catch (error: any) {
        const message =
          error.response?.data?.message || "Lỗi khi tải thông tin lớp học";
        set({ isLoading: false, error: message });
        throw new Error(message);
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
        const message = error.response?.data?.message || "Lỗi khi tạo lớp học";
        set({ isLoading: false, error: message });
        throw new Error(message);
      }
    },

    updateClass: async (id: string, data: UpdateClassData) => {
      set({ isLoading: true, error: null });
      try {
        const response = await api.patch(`/classes/${id}`, data);
        const updatedClass = normalizeClass(response.data);

        set((state) => ({
          classes: state.classes.map((c) => (c._id === id ? updatedClass : c)),
          selectedClass:
            state.selectedClass?._id === id
              ? updatedClass
              : state.selectedClass,
          isLoading: false,
        }));

        return updatedClass;
      } catch (error: any) {
        const message =
          error.response?.data?.message || "Lỗi khi cập nhật lớp học";
        set({ isLoading: false, error: message });
        throw new Error(message);
      }
    },

    deleteClass: async (id: string) => {
      set({ isLoading: true, error: null });
      try {
        await api.delete(`/classes/${id}`);

        set((state) => ({
          classes: state.classes.filter((c) => c._id !== id),
          selectedClass:
            state.selectedClass?._id === id ? null : state.selectedClass,
          isLoading: false,
        }));
      } catch (error: any) {
        const message = error.response?.data?.message || "Lỗi khi xóa lớp học";
        set({ isLoading: false, error: message });
        throw new Error(message);
      }
    },

    addStudentToClass: async (classId: string, studentId: string) => {
      set({ isLoading: true, error: null });
      try {
        await api.post(`/classes/${classId}/students`, { studentId });

        // Refetch the class to get updated student list
        const response = await api.get(`/classes/${classId}`);
        const updatedClass = normalizeClass(response.data);

        set((state) => ({
          classes: state.classes.map((c) =>
            c._id === classId ? updatedClass : c,
          ),
          selectedClass:
            state.selectedClass?._id === classId
              ? updatedClass
              : state.selectedClass,
          isLoading: false,
        }));
      } catch (error: any) {
        const message =
          error.response?.data?.message || "Lỗi khi thêm học sinh vào lớp";
        set({ isLoading: false, error: message });
        throw new Error(message);
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
        const message =
          error.response?.data?.message || "Lỗi khi kiểm tra trùng lịch";
        throw new Error(message);
      }
    },

    createClassTransferRequest: async (data) => {
      set({ isLoading: true, error: null });
      try {
        const response = await api.post("/admin/class-transfer-requests", data);
        set({ isLoading: false });
        return response.data;
      } catch (error: any) {
        const message =
          error.response?.data?.message || "Lỗi khi tạo yêu cầu chuyển lớp";
        set({ isLoading: false, error: message });
        throw new Error(message);
      }
    },

    fetchClassTransferRequests: async (status) => {
      try {
        const response = await api.get("/admin/class-transfer-requests", {
          params: status ? { status } : undefined,
        });
        return Array.isArray(response.data) ? response.data : [];
      } catch (error: any) {
        const message =
          error.response?.data?.message ||
          "Lỗi khi tải danh sách yêu cầu chuyển lớp";
        throw new Error(message);
      }
    },

    approveClassTransferRequest: async (requestId: string) => {
      set({ isLoading: true, error: null });
      try {
        await api.post(`/admin/class-transfer-requests/${requestId}/approve`);
        set({ isLoading: false });
      } catch (error: any) {
        const message =
          error.response?.data?.message || "Lỗi khi duyệt yêu cầu chuyển lớp";
        set({ isLoading: false, error: message });
        throw new Error(message);
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
        const message =
          error.response?.data?.message || "Lỗi khi từ chối yêu cầu chuyển lớp";
        set({ isLoading: false, error: message });
        throw new Error(message);
      }
    },

    transferStudentToClass: async (
      toClassId: string,
      fromClassId: string,
      studentId: string,
    ) => {
      set({ isLoading: true, error: null });
      try {
        await api.post(`/classes/${toClassId}/students/transfer`, {
          fromClassId,
          studentId,
        });

        const response = await api.get(`/classes/${toClassId}`);
        const updatedClass = normalizeClass(response.data);

        set((state) => ({
          classes: state.classes.map((c) =>
            c._id === toClassId ? updatedClass : c,
          ),
          selectedClass:
            state.selectedClass?._id === toClassId
              ? updatedClass
              : state.selectedClass,
          isLoading: false,
        }));
      } catch (error: any) {
        const message =
          error.response?.data?.message || "Lỗi khi chuyển học sinh sang lớp";
        set({ isLoading: false, error: message });
        throw new Error(message);
      }
    },

    removeStudentFromClass: async (classId: string, studentId: string) => {
      set({ isLoading: true, error: null });
      try {
        await api.delete(`/classes/${classId}/students/${studentId}`);

        // Refetch the class to get updated student list
        const response = await api.get(`/classes/${classId}`);
        const updatedClass = normalizeClass(response.data);

        set((state) => ({
          classes: state.classes.map((c) =>
            c._id === classId ? updatedClass : c,
          ),
          selectedClass:
            state.selectedClass?._id === classId
              ? updatedClass
              : state.selectedClass,
          isLoading: false,
        }));
      } catch (error: any) {
        const message =
          error.response?.data?.message || "Lỗi khi xóa học sinh khỏi lớp";
        set({ isLoading: false, error: message });
        throw new Error(message);
      }
    },

    setSelectedClass: (classData: Class | null) => {
      set({ selectedClass: classData });
    },

    clearError: () => {
      set({ error: null });
    },
  }),
);
