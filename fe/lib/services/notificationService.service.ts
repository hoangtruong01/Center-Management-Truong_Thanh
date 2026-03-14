import api from "../api"

export interface SendNotificationParams {
    userIds: string | string[]
    title: string
    body: string
    type?: "info" | "success" | "warning" | "error"
}

export const notificationService = {
    send: async (params: SendNotificationParams) => {
        try {
            // Nếu userIds là mảng (gửi nhiều người 1 lúc)
            if (Array.isArray(params.userIds)) {
                // Tuỳ vào API Backend của bro hỗ trợ gửi 1 list ID không. 
                // Nếu không thì dùng Promise.all để gửi từng cái.
                const promises = params.userIds.map(id =>
                    api.post("/notifications", { ...params, userId: id })
                );
                await Promise.all(promises);
            } else {
                // Gửi cho 1 người
                await api.post("/notifications", { ...params, userId: params.userIds });
            }
            return true;
        } catch (error) {
            console.error("Lỗi khi gửi thông báo:", error);
            throw error;
        }
    }
}