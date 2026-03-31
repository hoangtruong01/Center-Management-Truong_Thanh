import { create } from "zustand";
import api from "../api";

interface ApiErrorShape {
  response?: {
    data?: {
      message?: string;
    };
  };
}

// Types
export interface StudentPaymentRequest {
  _id: string;
  classPaymentRequestId: string;
  classId: string;
  studentId: string;
  studentName: string;
  studentCode?: string;
  className: string;
  classSubject?: string;
  title: string;
  description?: string;
  dueDate?: string;
  baseAmount: number;
  scholarshipPercent: number;
  scholarshipType?: string;
  discountAmount: number;
  finalAmount: number;
  currency: string;
  status: "pending" | "paid" | "overdue" | "cancelled";
  paidAt?: string;
  createdAt: string;
}

export interface ClassPaymentRequest {
  _id: string;
  classId: string;
  title: string;
  description?: string;
  amount: number;
  currency: string;
  dueDate?: string;
  className: string;
  classSubject?: string;
  totalStudents: number;
  paidCount: number;
  totalCollected: number;
  status: "active" | "cancelled" | "pending_exception";
  financialSnapshot?: {
    listedRevenue: number;
    scholarshipDiscountTotal: number;
    scholarshipDiscountRatio: number;
    expectedCollectionRate: number;
    estimatedRevenue: number;
    estimatedCost: number;
    minProfitTarget: number;
    projectedProfit: number;
    discountCapAmount: number;
    discountCapPercent: number;
    collectedRevenue: number;
    outstandingAmount: number;
    overdueDebtAmount: number;
    actualCollectionRate: number;
    actualProfit: number;
    riskLevel: "green" | "yellow" | "red";
    isCapExceeded: boolean;
    capExceedPolicy: "block" | "request_exception";
    capExceedReason?: string;
  };
  createdAt: string;
}

export interface ChildPaymentRequests {
  studentId: string;
  studentName: string;
  requests: StudentPaymentRequest[];
}

interface PaymentRequestsState {
  // Student
  myRequests: StudentPaymentRequest[];
  // Parent
  childrenRequests: ChildPaymentRequests[];
  // Admin
  classRequests: ClassPaymentRequest[];

  isLoading: boolean;
  error: string | null;

  // Student actions
  fetchMyRequests: () => Promise<void>;
  fetchAllMyRequests: () => Promise<void>;

  // Parent actions
  fetchChildrenRequests: () => Promise<void>;

  // Admin actions
  fetchClassRequests: (classId?: string) => Promise<void>;
  createClassPaymentRequest: (data: {
    classId: string;
    title: string;
    description?: string;
    amount?: number;
    dueDate?: string;
    expectedCollectionRate?: number;
    estimatedCost?: number;
    minProfitTarget?: number;
    scholarshipCapPercent?: number;
    capExceedPolicy?: "block" | "request_exception";
    capExceedReason?: string;
  }) => Promise<{ classRequest: ClassPaymentRequest; studentCount: number }>;
  getClassRequestStudents: (classRequestId: string) => Promise<{
    total: number;
    paid: number;
    pending: number;
    students: StudentPaymentRequest[];
  }>;
  cancelClassRequest: (id: string) => Promise<void>;
  approveClassRequestException: (id: string) => Promise<void>;
  rejectClassRequestException: (id: string, reason?: string) => Promise<void>;

  clearError: () => void;
}

export const usePaymentRequestsStore = create<PaymentRequestsState>((set) => ({
  myRequests: [],
  childrenRequests: [],
  classRequests: [],
  isLoading: false,
  error: null,

  fetchMyRequests: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get("/payment-requests/my/all");
      set({ myRequests: response.data, isLoading: false });
    } catch (error: unknown) {
      const message =
        (error as ApiErrorShape).response?.data?.message || "Lỗi tải yêu cầu";
      set({ isLoading: false, error: message });
    }
  },

  fetchAllMyRequests: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get("/payment-requests/my/all");
      set({ myRequests: response.data, isLoading: false });
    } catch (error: unknown) {
      const message =
        (error as ApiErrorShape).response?.data?.message || "Lỗi tải yêu cầu";
      set({ isLoading: false, error: message });
    }
  },

  fetchChildrenRequests: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get("/payment-requests/my-children");
      set({ childrenRequests: response.data, isLoading: false });
    } catch (error: unknown) {
      const message =
        (error as ApiErrorShape).response?.data?.message || "Lỗi tải yêu cầu";
      set({ isLoading: false, error: message });
    }
  },

  fetchClassRequests: async (classId?: string) => {
    set({ isLoading: true, error: null });
    try {
      const url = classId
        ? `/payment-requests/class?classId=${classId}`
        : "/payment-requests/class";
      const response = await api.get(url);
      set({ classRequests: response.data, isLoading: false });
    } catch (error: unknown) {
      const message =
        (error as ApiErrorShape).response?.data?.message || "Lỗi tải yêu cầu";
      set({ isLoading: false, error: message });
    }
  },

  createClassPaymentRequest: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post("/payment-requests/class", data);
      set({ isLoading: false });
      return response.data;
    } catch (error: unknown) {
      const message =
        (error as ApiErrorShape).response?.data?.message || "Lỗi tạo yêu cầu";
      set({ isLoading: false, error: message });
      throw new Error(message);
    }
  },

  getClassRequestStudents: async (classRequestId: string) => {
    try {
      const response = await api.get(
        `/payment-requests/class/${classRequestId}/students`,
      );
      return response.data;
    } catch (error: unknown) {
      throw new Error(
        (error as ApiErrorShape).response?.data?.message || "Lỗi tải danh sách",
      );
    }
  },

  cancelClassRequest: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.delete(`/payment-requests/class/${id}`);
      set({ isLoading: false });
    } catch (error: unknown) {
      const message =
        (error as ApiErrorShape).response?.data?.message || "Lỗi hủy yêu cầu";
      set({ isLoading: false, error: message });
      throw new Error(message);
    }
  },

  approveClassRequestException: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.patch(`/payment-requests/class/${id}/exception/approve`);
      set({ isLoading: false });
    } catch (error: unknown) {
      const message =
        (error as ApiErrorShape).response?.data?.message ||
        "Lỗi duyệt ngoại lệ học bổng";
      set({ isLoading: false, error: message });
      throw new Error(message);
    }
  },

  rejectClassRequestException: async (id: string, reason?: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.patch(`/payment-requests/class/${id}/exception/reject`, {
        reason,
      });
      set({ isLoading: false });
    } catch (error: unknown) {
      const message =
        (error as ApiErrorShape).response?.data?.message ||
        "Lỗi từ chối ngoại lệ học bổng";
      set({ isLoading: false, error: message });
      throw new Error(message);
    }
  },

  clearError: () => set({ error: null }),
}));
