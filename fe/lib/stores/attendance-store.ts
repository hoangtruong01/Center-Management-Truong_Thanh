import { create } from "zustand";
import api from "@/lib/api";

export interface AttendanceRecord {
  _id: string;
  id?: string;
  studentId: string;
  classId: string;
  sessionId:
    | string
    | {
        _id: string;
        startTime: string;
        endTime: string;
        classId: string | { _id: string; name: string };
        status: string;
      };
  status: "present" | "absent" | "late" | "excused";
  checkInTime?: string;
  notes?: string;
  note?: string;
  isMakeup?: boolean;
  markedBy: string;
  createdAt: string;
  // Populated
  student?: {
    _id: string;
    name: string;
  };
  class?: {
    _id: string;
    name: string;
  };
}

interface AttendanceState {
  records: AttendanceRecord[];
  isLoading: boolean;
  error: string | null;
  statistics: {
    present: number;
    absent: number;
    late: number;
    excused: number;
    total: number;
    attendanceRate: number;
  } | null;
}

interface AttendanceActions {
  fetchAttendance: (params?: FetchAttendanceParams) => Promise<void>;
  markAttendance: (data: MarkAttendanceData) => Promise<void>;
  markTimetableAttendance: (data: MarkTimetableAttendanceData) => Promise<void>;
  updateAttendance: (id: string, data: UpdateAttendanceData) => Promise<void>;
  fetchStatistics: (params: FetchStatisticsParams) => Promise<void>;
  clearError: () => void;
}

interface FetchAttendanceParams {
  studentId?: string;
  classId?: string;
  sessionId?: string;
  startDate?: string;
  endDate?: string;
}

interface MarkAttendanceData {
  studentId: string;
  classId: string;
  sessionId: string;
  status: "present" | "absent" | "late" | "excused";
  notes?: string;
}

interface TimetableAttendanceRecord {
  studentId: string;
  status: "present" | "absent" | "late" | "excused";
}

interface MarkTimetableAttendanceData {
  classId: string;
  date: string;
  records: TimetableAttendanceRecord[];
  note?: string;
}

interface UpdateAttendanceData {
  status?: "present" | "absent" | "late" | "excused";
  notes?: string;
}

interface FetchStatisticsParams {
  studentId?: string;
  classId?: string;
  startDate?: string;
  endDate?: string;
}

export const useAttendanceStore = create<AttendanceState & AttendanceActions>(
  (set) => ({
    // State
    records: [],
    isLoading: false,
    error: null,
    statistics: null,

    // Actions
    fetchAttendance: async (params?: FetchAttendanceParams) => {
      set({ isLoading: true, error: null });
      try {
        const response = await api.get("/attendance", { params });
        const records = Array.isArray(response.data)
          ? response.data
          : response.data.attendance || [];

        set({
          records: records.map((r: AttendanceRecord) => ({ ...r, id: r._id })),
          isLoading: false,
        });
      } catch (error: any) {
        const message =
          error.response?.data?.message || "Lỗi khi tải dữ liệu điểm danh";
        set({ isLoading: false, error: message });
        throw new Error(message);
      }
    },

    markAttendance: async (data: MarkAttendanceData) => {
      set({ isLoading: true, error: null });
      try {
        const response = await api.post("/attendance", data);
        const newRecord = { ...response.data, id: response.data._id };

        set((state) => ({
          records: [...state.records, newRecord],
          isLoading: false,
        }));
      } catch (error: any) {
        const message = error.response?.data?.message || "Lỗi khi điểm danh";
        set({ isLoading: false, error: message });
        throw new Error(message);
      }
    },

    markTimetableAttendance: async (data: MarkTimetableAttendanceData) => {
      set({ isLoading: true, error: null });
      try {
        const response = await api.post("/attendance/timetable", data);
        const newRecords =
          response.data.attendanceRecords?.map((r: any) => ({
            ...r,
            id: r._id,
          })) || [];

        set((state) => ({
          records: [...state.records, ...newRecords],
          isLoading: false,
        }));

        return response.data;
      } catch (error: any) {
        const message = error.response?.data?.message || "Lỗi khi điểm danh";
        set({ isLoading: false, error: message });
        throw new Error(message);
      }
    },

    updateAttendance: async (id: string, data: UpdateAttendanceData) => {
      set({ isLoading: true, error: null });
      try {
        const response = await api.patch(`/attendance/${id}`, data);
        const updatedRecord = { ...response.data, id: response.data._id };

        set((state) => ({
          records: state.records.map((r) => (r._id === id ? updatedRecord : r)),
          isLoading: false,
        }));
      } catch (error: any) {
        const message =
          error.response?.data?.message || "Lỗi khi cập nhật điểm danh";
        set({ isLoading: false, error: message });
        throw new Error(message);
      }
    },

    fetchStatistics: async (params: FetchStatisticsParams) => {
      set({ isLoading: true, error: null });
      try {
        const response = await api.get("/attendance/statistics", { params });
        set({
          statistics: response.data,
          isLoading: false,
        });
      } catch (error: any) {
        const message =
          error.response?.data?.message || "Lỗi khi tải thống kê điểm danh";
        set({ isLoading: false, error: message });
        throw new Error(message);
      }
    },

    clearError: () => {
      set({ error: null });
    },
  })
);
