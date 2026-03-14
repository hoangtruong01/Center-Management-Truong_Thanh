import api from "../api"

export interface SendNotificationParams {
    userId?: string
    title: string
    body: string
    type?: "info" | "success" | "warning" | "error"
}

export const notificationService = {
    send: async (params: SendNotificationParams) => {
        try {
            const response = await api.post("/notifications", params)
            return response.data
        } catch (error) {
            console.error("Lỗi thông báo:", error)
            throw error
        }
    },
    delete: async (id: string) => {
        try {
            const response = await api.delete(`/notifications/${id}`);
            return response.data;
        } catch (error) {
            console.error("Lỗi xóa thông báo:", error);
            throw error;
        }
    },
    deleteAll: async () => {
        try {
            const response = await api.delete("/notifications");
            return response.data;
        } catch (error) {
            console.error("Lỗi xóa tất cả thông báo:", error);
            throw error;
        }
    },
    notifyAdmin: async (params: SendNotificationParams) => {
        try {
            const response = await api.post("/notifications/notify-admin", params)
            return response.data
        } catch (error) {
            console.error("Lỗi thông báo Admin:", error)
            throw error
        }
    }
};