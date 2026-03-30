import { create } from "zustand";
import api from "@/lib/api";
import type { User, UserRole } from "./auth-store";
import { translateErrorMessage } from "./auth-store";

interface UsersState {
  users: User[];
  selectedUser: User | null;
  isLoading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

interface UsersActions {
  fetchUsers: (params?: FetchUsersParams) => Promise<void>;
  fetchUserById: (id: string) => Promise<User>;
  createUser: (data: CreateUserData) => Promise<User>;
  updateUser: (id: string, data: UpdateUserData) => Promise<User>;
  deleteUser: (id: string) => Promise<void>;
  importUsers: (
    file: File,
    role: UserRole,
    branchId: string,
  ) => Promise<ImportResponse>;
  downloadTemplate: (role: UserRole) => Promise<void>;
  setSelectedUser: (user: User | null) => void;
  clearError: () => void;
  // Thêm methods mới cho giáo viên và môn học
  fetchSubjects: () => Promise<string[]>;
  fetchTeachersBySubject: (subject: string) => Promise<User[]>;
  fetchTeacherStatsBySubject: () => Promise<
    Array<{ subject: string; count: number }>
  >;
  // Method mới cho phụ huynh
  fetchParentChildren: (parentId: string) => Promise<User[]>;
}

interface FetchUsersParams {
  page?: number;
  limit?: number;
  role?: UserRole;
  branchId?: string;
  search?: string;
  subject?: string; // Lọc giáo viên theo môn
}

// Loại học bổng
export type ScholarshipType = "teacher_child" | "poor_family" | "orphan";

interface CreateUserData {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role: UserRole;
  branchId?: string;
  // Thông tin giáo viên
  subjects?: string[];
  teacherNote?: string;
  qualification?: string;
  experienceYears?: number;
  // Thông tin học bổng (dành cho học sinh)
  hasScholarship?: boolean;
  scholarshipType?: ScholarshipType;
  scholarshipPercent?: number;
}

interface UpdateUserData {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  role?: UserRole;
  branchId?: string;
  status?: "active" | "pending" | "inactive";
  avatarUrl?: string;
  dateOfBirth?: string;
  // Thông tin giáo viên
  subjects?: string[];
  teacherNote?: string;
  qualification?: string;
  experienceYears?: number;
  // Thông tin học bổng (dành cho học sinh)
  hasScholarship?: boolean;
  scholarshipType?: ScholarshipType;
  scholarshipPercent?: number;
}

interface ImportResult {
  success: boolean;
  row: number;
  email?: string;
  name?: string;
  error?: string;
  tempPassword?: string;
}

export interface ImportResponse {
  total: number;
  successful: number;
  failed: number;
  results: ImportResult[];
}

export const useUsersStore = create<UsersState & UsersActions>((set, get) => ({
  // State
  users: [],
  selectedUser: null,
  isLoading: false,
  error: null,
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
  },

  // Actions
  fetchUsers: async (params?: FetchUsersParams) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get("/users", { params });
      const users = Array.isArray(response.data)
        ? response.data
        : response.data.users || [];

      set({
        users: users.map((u: User) => ({ ...u, id: u._id })),
        isLoading: false,
        pagination: {
          ...get().pagination,
          total: response.data.total || users.length,
        },
      });
    } catch (error: any) {
      const message = translateErrorMessage(
        error,
        "Lỗi khi tải danh sách người dùng",
      );
      set({ isLoading: false, error: message });
      throw new Error(message);
    }
  },

  fetchUserById: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get(`/users/${id}`);
      const user = { ...response.data, id: response.data._id };
      set({ selectedUser: user, isLoading: false });
      return user;
    } catch (error: any) {
      const message = translateErrorMessage(
        error,
        "Lỗi khi tải thông tin người dùng",
      );
      set({ isLoading: false, error: message });
      throw new Error(message);
    }
  },

  createUser: async (data: CreateUserData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post("/users", data);
      const newUser = { ...response.data, id: response.data._id };

      set((state) => ({
        users: [...state.users, newUser],
        isLoading: false,
      }));

      return newUser;
    } catch (error: any) {
      const message = translateErrorMessage(error, "Lỗi khi tạo người dùng");
      set({ isLoading: false, error: message });
      // Throw error với message đã dịch
      const translatedError = new Error(message);
      (translatedError as any).originalError = error;
      throw translatedError;
    }
  },

  updateUser: async (id: string, data: UpdateUserData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.patch(`/users/${id}`, data);
      const updatedUser = { ...response.data, id: response.data._id };

      set((state) => ({
        users: state.users.map((u) => (u._id === id ? updatedUser : u)),
        selectedUser:
          state.selectedUser?._id === id ? updatedUser : state.selectedUser,
        isLoading: false,
      }));

      return updatedUser;
    } catch (error: any) {
      const message = translateErrorMessage(
        error,
        "Lỗi khi cập nhật người dùng",
      );
      set({ isLoading: false, error: message });
      throw new Error(message);
    }
  },

  deleteUser: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.delete(`/users/${id}`);

      set((state) => ({
        users: state.users.filter((u) => u._id !== id),
        selectedUser:
          state.selectedUser?._id === id ? null : state.selectedUser,
        isLoading: false,
      }));
    } catch (error: any) {
      const message = translateErrorMessage(error, "Lỗi khi xóa người dùng");
      set({ isLoading: false, error: message });
      throw new Error(message);
    }
  },

  importUsers: async (file: File, role: UserRole, branchId: string) => {
    set({ isLoading: true, error: null });
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("role", role);
      formData.append("branchId", branchId);

      const response = await api.post("/imports/users", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      // Refresh users list after import
      await get().fetchUsers();

      set({ isLoading: false });
      return response.data as ImportResponse;
    } catch (error: any) {
      const message = translateErrorMessage(error, "Lỗi khi import người dùng");
      set({ isLoading: false, error: message });
      throw new Error(message);
    }
  },

  downloadTemplate: async (role: UserRole) => {
    try {
      const response = await api.get(`/imports/template?role=${role}`, {
        responseType: "blob",
      });

      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `template_${role}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      const message = translateErrorMessage(error, "Lỗi khi tải template");
      set({ error: message });
      throw new Error(message);
    }
  },

  setSelectedUser: (user: User | null) => {
    set({ selectedUser: user });
  },

  clearError: () => {
    set({ error: null });
  },

  // Lấy danh sách môn học có sẵn
  fetchSubjects: async () => {
    try {
      const response = await api.get("/users/subjects/list");
      return response.data;
    } catch (error: any) {
      console.error("Error fetching subjects:", error);
      return [];
    }
  },

  // Lấy giáo viên theo môn học
  fetchTeachersBySubject: async (subject: string) => {
    try {
      const response = await api.get(
        `/users/teachers/by-subject/${encodeURIComponent(subject)}`,
      );
      return response.data.map((u: User) => ({ ...u, id: u._id }));
    } catch (error: any) {
      console.error("Error fetching teachers by subject:", error);
      return [];
    }
  },

  // Thống kê giáo viên theo môn học
  fetchTeacherStatsBySubject: async () => {
    try {
      const response = await api.get("/users/teachers/stats-by-subject");
      return response.data;
    } catch (error: any) {
      console.error("Error fetching teacher stats:", error);
      return [];
    }
  },

  // Lấy thông tin con của phụ huynh
  fetchParentChildren: async (parentId: string) => {
    try {
      const response = await api.get(`/users/parent/${parentId}/children`);
      return response.data.map((u: User) => ({ ...u, id: u._id }));
    } catch (error: any) {
      console.error("Error fetching parent children:", error);
      return [];
    }
  },
}));
