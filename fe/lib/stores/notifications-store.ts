import { create } from "zustand";
import api from "@/lib/api";
import { notificationService } from "@/lib/services/notificationService.service";

export interface Notification {
  _id: string;
  id?: string;
  userId: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error" | "reminder";
  category?:
  | "attendance"
  | "tuition"
  | "assessment"
  | "class"
  | "system"
  | "chat";
  isRead: boolean;
  link?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt?: string;
}

interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
}

interface NotificationsActions {
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  clearError: () => void;
}

export const useNotificationsStore = create<
  NotificationsState & NotificationsActions
>((set, get) => ({
  // State
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  error: null,

  // Actions
  fetchNotifications: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get("/notifications");
      const notifications = Array.isArray(response.data)
        ? response.data
        : response.data.notifications || [];
      const unreadCount = notifications.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (n: any) => n.read === false || n.isRead === false
      ).length;

      set({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        notifications: notifications.map((n: any) => ({
          ...n,
          id: n._id,
          message: n.body || n.message,
          isRead: n.read !== undefined ? n.read : n.isRead,
        })),
        unreadCount,
        isLoading: false,
      });
    } catch (error: any) {
      const message = error.response?.data?.message || "Lỗi khi tải thông báo";
      set({ isLoading: false, error: message });
      throw new Error(message);
    }
  },

  markAsRead: async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);

      set((state) => {
        const notifications = state.notifications.map((n) =>
          n._id === id ? { ...n, isRead: true } : n
        );
        const unreadCount = notifications.filter((n) => !n.isRead).length;

        return { notifications, unreadCount };
      });
    } catch (error: any) {
      const message = error.response?.data?.message || "Lỗi khi đánh dấu đã đọc";
      set({ error: message });
      throw new Error(message);
    }
  },

  markAllAsRead: async () => {
    try {
      await api.patch("/notifications/read-all");

      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
        unreadCount: 0,
      }));
    } catch (error: any) {
      const message = error.response?.data?.message || "Lỗi khi đánh dấu tất cả đã đọc";
      set({ error: message });
      throw new Error(message);
    }
  },

  deleteNotification: async (id: string) => {
    try {
      await notificationService.delete(id);

      set((state) => {
        const notification = state.notifications.find((n) => n._id === id);
        const notifications = state.notifications.filter((n) => n._id !== id);
        const unreadCount =
          notification && !notification.isRead
            ? state.unreadCount - 1
            : state.unreadCount;

        return { notifications, unreadCount };
      });
    } catch (error: any) {
      const message = error.response?.data?.message || "Lỗi khi xóa thông báo";
      set({ error: message });
      throw new Error(message);
    }
  },

  clearAll: async () => {
    try {
      await notificationService.deleteAll();
      set({ notifications: [], unreadCount: 0 });
    } catch (error: any) {
      const message =
        error.response?.data?.message || "Lỗi khi xóa tất cả thông báo";
      set({ error: message });
      throw new Error(message);
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));
