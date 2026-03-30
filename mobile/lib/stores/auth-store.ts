import { create } from "zustand";
import api, { setAuthData, clearAuthData, getAuthData } from "@/lib/api";

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
    return "Dữ liệu không hợp lệ. Vui lòng kiểm tra lại";
  }

  if (status === 500) {
    return "Lỗi hệ thống. Vui lòng thử lại sau";
  }

  return defaultMessage;
}

export interface User {
  _id: string;
  email: string;
  name?: string;
  fullName?: string;
  phone?: string;
  role: UserRole;
  branchId?: string;
  studentIds?: string[];
  avatarUrl?: string;
  isActive: boolean;
  childEmail?: string; // Email của con (dành cho phụ huynh)
  childId?: string; // ID của con (dành cho phụ huynh)
}

// Helper to get display name from user
export const getUserDisplayName = (user: User | null): string => {
  if (!user) return "Người dùng";
  return user.fullName || user.name || "Người dùng";
};

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;

  // Actions
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  loadAuthFromStorage: () => Promise<void>;
  updateUser: (user: User) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isLoading: false,
  error: null,
  isAuthenticated: false,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post("/auth/login", { email, password });
      const { accessToken, refreshToken, user } = response.data;

      const authData = {
        state: {
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
        },
      };
      await setAuthData(authData);

      set({
        user,
        accessToken,
        refreshToken,
        isAuthenticated: true,
        isLoading: false,
      });

      return user;
    } catch (error: any) {
      const errorMessage = translateErrorMessage(
        error,
        "Đăng nhập thất bại. Vui lòng thử lại",
      );
      set({
        error: errorMessage,
        isLoading: false,
        isAuthenticated: false,
      });
      throw new Error(errorMessage);
    }
  },

  logout: async () => {
    await clearAuthData();
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      error: null,
    });
  },

  loadAuthFromStorage: async () => {
    set({ isLoading: true });
    try {
      const authData = await getAuthData();
      if (authData?.state) {
        set({
          user: authData.state.user,
          accessToken: authData.state.accessToken,
          refreshToken: authData.state.refreshToken,
          isAuthenticated: authData.state.isAuthenticated,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  updateUser: (user: User) => {
    set({ user });
    // Also update in storage
    getAuthData().then((authData) => {
      if (authData?.state) {
        setAuthData({
          state: {
            ...authData.state,
            user,
          },
        });
      }
    });
  },

  setError: (error: string | null) => set({ error }),
  clearError: () => set({ error: null }),
}));
