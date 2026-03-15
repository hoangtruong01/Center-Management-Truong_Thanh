import api from "../api";

export interface SendNotificationParams {
    userId?: string;
    title: string;
    body: string;
    type?: "info" | "success" | "warning" | "error";
}

export const notificationService = {
    send: async (params: SendNotificationParams) => {
        try {
            const response = await api.post("/notifications", params);
            return response.data;
        } catch (error) {
            console.error("Lỗi thông báo:", error);
            throw error;
        }
    },
    notifyAdmin: async (params: SendNotificationParams) => {
        try {
            const response = await api.post("/notifications/notify-admin", params);
            return response.data;
        } catch (error) {
            console.error("Lỗi thông báo Admin:", error);
            throw error;
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
    notifyMakeUpClass: async (dto: {
        classId: string;
        className: string;
        subject: string;
        date: string;
        startTime: string;
        endTime: string;
        room?: string;
    }) => {
        try {
            const response = await api.post("/notifications/notify-makeup-class", dto);
            return response.data;
        } catch (error) {
            console.error("Lỗi thông báo học bù:", error);
            throw error;
        }
    },
    notifyAttendance: async (params: {
        studentId: string;
        studentName: string;
        status: string;
        className: string;
        date: string;
    }) => {
        const statusMap: any = {
            present: "có mặt",
            absent: "vắng mặt",
            late: "đi trễ",
            excused: "vắng có phép"
        };
        const statusText = statusMap[params.status] || params.status;
        
        return notificationService.send({
            userId: params.studentId,
            title: "Cập nhật điểm danh",
            body: `Học sinh ${params.studentName} đã được điểm danh ${statusText} lớp ${params.className} ngày ${params.date}`,
            type: params.status === "present" ? "success" : "warning"
        });
    }
};
