import { create } from "zustand";
import { persist } from "zustand/middleware";
import api from "@/lib/api";

export type UserRole = "student" | "teacher" | "parent" | "admin";

// Helper function to translate error messages to Vietnamese
export function translateErrorMessage(
  error: any,
  defaultMessage: string,
): string {
  const status = error?.response?.status;
  const message = error?.response?.data?.message || error?.message || "";
  const msgLower = (typeof message === "string" ? message : "").toLowerCase();

  // HTTP status code based errors
  if (status === 401) {
    if (msgLower.includes("password") || msgLower.includes("mật khẩu")) {
      return "Mật khẩu không chính xác";
    }
    if (
      msgLower.includes("invalid credentials") ||
      msgLower.includes("unauthorized")
    ) {
      return "Email hoặc mật khẩu không chính xác";
    }
    return "Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại";
  }

  if (status === 403) {
    return "Bạn không có quyền thực hiện thao tác này";
  }

  if (status === 404) {
    if (
      msgLower.includes("user") ||
      msgLower.includes("account") ||
      msgLower.includes("tài khoản")
    ) {
      return "Tài khoản không tồn tại";
    }
    return "Không tìm thấy dữ liệu";
  }

  if (status === 409) {
    if (msgLower.includes("email")) {
      return "Email này đã được sử dụng. Vui lòng dùng email khác";
    }
    if (
      msgLower.includes("phone") ||
      msgLower.includes("điện thoại") ||
      msgLower.includes("sđt")
    ) {
      return "Số điện thoại này đã được sử dụng. Vui lòng dùng số khác";
    }
    if (
      msgLower.includes("already exists") ||
      msgLower.includes("duplicate") ||
      msgLower.includes("tồn tại")
    ) {
      return "Thông tin này đã tồn tại trong hệ thống";
    }
    return "Dữ liệu bị trùng lặp. Vui lòng kiểm tra lại";
  }

  if (status === 400) {
    if (msgLower.includes("email") && msgLower.includes("invalid")) {
      return "Email không hợp lệ";
    }
    if (msgLower.includes("phone") && msgLower.includes("invalid")) {
      return "Số điện thoại không hợp lệ";
    }
    if (msgLower.includes("password")) {
      if (
        msgLower.includes("weak") ||
        msgLower.includes("short") ||
        msgLower.includes("6")
      ) {
        return "Mật khẩu phải có ít nhất 6 ký tự";
      }
      return "Mật khẩu không hợp lệ";
    }
    if (msgLower.includes("required") || msgLower.includes("bắt buộc")) {
      return "Vui lòng điền đầy đủ thông tin bắt buộc";
    }
    return "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại";
  }

  if (status === 500) {
    return "Lỗi hệ thống. Vui lòng thử lại sau";
  }

  // Message content based translation
  if (
    msgLower.includes("user already exists") ||
    msgLower.includes("already exists")
  ) {
    return "Tài khoản đã tồn tại";
  }
  if (
    msgLower.includes("invalid credentials") ||
    msgLower.includes("wrong password")
  ) {
    return "Email hoặc mật khẩu không chính xác";
  }
  if (
    msgLower.includes("user not found") ||
    msgLower.includes("account not found")
  ) {
    return "Tài khoản không tồn tại";
  }
  if (msgLower.includes("email already") || msgLower.includes("email exists")) {
    return "Email này đã được sử dụng";
  }
  if (msgLower.includes("phone already") || msgLower.includes("phone exists")) {
    return "Số điện thoại này đã được sử dụng";
  }
  if (msgLower.includes("network") || msgLower.includes("connection")) {
    return "Lỗi kết nối mạng. Vui lòng kiểm tra internet";
  }
  if (msgLower.includes("timeout")) {
    return "Yêu cầu quá thời gian. Vui lòng thử lại";
  }

  // Return the original message if it's already in Vietnamese or return default
  if (message && typeof message === "string" && message.length > 0) {
    // Check if message contains Vietnamese characters
    if (/[à-ỹÀ-Ỹ]/.test(message)) {
      return Array.isArray(message) ? message.join(", ") : message;
    }
  }

  return defaultMessage;
}

export interface User {
  _id: string;
  id?: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  branchId?: string;
  avatarUrl?: string;
  dateOfBirth?: string;
  status: "active" | "pending" | "inactive";
  mustChangePassword?: boolean;
  createdAt?: string;
  updatedAt?: string;
  // Thông tin dành cho giáo viên
  subjects?: string[]; // Danh sách môn dạy
  teacherNote?: string; // Ghi chú về giáo viên
  qualification?: string; // Trình độ học vấn
  experienceYears?: number; // Số năm kinh nghiệm

  // Thông tin chung/bổ sung
  studentCode?: string;
  teacherCode?: string;
  parentCode?: string;
  gender?: string;
  parentName?: string;
  parentPhone?: string;
  childEmail?: string;
  hasScholarship?: boolean;
  scholarshipType?: "teacher_child" | "poor_family" | "orphan";
  scholarshipPercent?: number;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  mustChangePassword: boolean;
}

interface AuthActions {
  login: (email: string, password: string) => Promise<User>;
  register: (data: RegisterData) => Promise<User>;
  registerByInvite: (
    data: RegisterByInviteData,
  ) => Promise<{ message: string }>;
  logout: () => void;
  clearError: () => void;
  setUser: (user: User) => void;
  refreshTokens: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
  clearMustChangePassword: () => void;
}

interface RegisterData {
  name: string;
  email: string;
  phone?: string;
  password: string;
}

interface RegisterByInviteData {
  token: string;
  name: string;
  email: string;
  phone?: string;
  password: string;
}

interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  mustChangePassword?: boolean;
}

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set, get) => ({
      // State
      user: null,
      accessToken: null,
      refreshToken: null,
      isLoading: false,
      error: null,
      isAuthenticated: false,
      mustChangePassword: false,

      // Actions
      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post<LoginResponse>("/auth/login", {
            email,
            password,
          });

          const { user, accessToken, refreshToken, mustChangePassword } =
            response.data;
          const userWithId = { ...user, id: user._id };

          set({
            user: userWithId,
            accessToken,
            refreshToken,
            isAuthenticated: true,
            isLoading: false,
            error: null,
            mustChangePassword: mustChangePassword || false,
          });

          return userWithId;
        } catch (error: any) {
          const message = translateErrorMessage(error, "Đăng nhập thất bại");
          set({
            isLoading: false,
            error: message,
            isAuthenticated: false,
          });
          throw new Error(message);
        }
      },

      register: async (data: RegisterData) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post<LoginResponse>(
            "/auth/register",
            data,
          );

          const { user, accessToken, refreshToken } = response.data;
          const userWithId = { ...user, id: user._id };

          set({
            user: userWithId,
            accessToken,
            refreshToken,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });

          return userWithId;
        } catch (error: any) {
          const message = translateErrorMessage(error, "Đăng ký thất bại");
          set({
            isLoading: false,
            error: message,
          });
          throw new Error(message);
        }
      },

      registerByInvite: async (data: RegisterByInviteData) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post("/auth/register/by-invite", data);
          set({ isLoading: false });
          return response.data;
        } catch (error: any) {
          const message = error.response?.data?.message || "Đăng ký thất bại";
          set({
            isLoading: false,
            error: message,
          });
          throw new Error(message);
        }
      },

      logout: () => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          error: null,
          mustChangePassword: false,
        });
      },

      clearError: () => {
        set({ error: null });
      },

      setUser: (user: User) => {
        set({ user });
      },

      changePassword: async (newPassword: string) => {
        set({ isLoading: true, error: null });
        try {
          await api.post("/auth/change-password", { newPassword });
          set({
            isLoading: false,
            mustChangePassword: false,
            user: get().user
              ? { ...get().user!, mustChangePassword: false }
              : null,
          });
        } catch (error: any) {
          const message =
            error.response?.data?.message || "Đổi mật khẩu thất bại";
          set({ isLoading: false, error: message });
          throw new Error(message);
        }
      },

      clearMustChangePassword: () => {
        set({ mustChangePassword: false });
      },

      refreshTokens: async () => {
        const { refreshToken } = get();
        if (!refreshToken) {
          get().logout();
          return;
        }

        try {
          const response = await api.post<LoginResponse>("/auth/refresh", {
            refreshToken,
          });

          const {
            user,
            accessToken,
            refreshToken: newRefreshToken,
          } = response.data;

          set({
            user: { ...user, id: user._id },
            accessToken,
            refreshToken: newRefreshToken,
          });
        } catch (error) {
          get().logout();
        }
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);

// API functions for forgot password and contact admin (không cần authentication)
export async function forgotPassword(
  email: string,
): Promise<{ success: boolean; message: string }> {
  try {
    const response = await api.post("/auth/forgot-password", { email });
    return response.data;
  } catch (error: any) {
    const message = translateErrorMessage(
      error,
      "Có lỗi xảy ra. Vui lòng thử lại.",
    );
    throw new Error(message);
  }
}

export async function contactAdmin(data: {
  name: string;
  email: string;
  phone?: string;
  message: string;
  type: "register" | "support" | "other";
}): Promise<{ success: boolean; message: string }> {
  try {
    const response = await api.post("/auth/contact-admin", data);
    return response.data;
  } catch (error: any) {
    const message = translateErrorMessage(
      error,
      "Có lỗi xảy ra. Vui lòng thử lại.",
    );
    throw new Error(message);
  }
}

export async function validateLogin(data: {
  email: string;
  role: string;
  branchId: string;
}): Promise<{ valid: boolean; errors?: string[] }> {
  try {
    const response = await api.post("/auth/validate-login", data);
    return response.data;
  } catch (error: any) {
    // If validation fails, just return valid=true to proceed with login
    return { valid: true };
  }
}
