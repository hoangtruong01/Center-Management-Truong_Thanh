import { create } from "zustand";
import api from "../api";

interface ApiErrorShape {
  response?: {
    data?: {
      message?: string;
    };
  };
}

export interface Payment {
  _id: string;
  requestIds: string[];
  paidBy: string | { _id: string; name?: string; email?: string };
  studentId: string | { _id: string; name?: string; email?: string };
  amount: number;
  method: "PAYOS" | "CASH" | "SCHOLARSHIP" | "FAKE";
  status:
    | "init"
    | "pending"
    | "success"
    | "failed"
    | "cancelled"
    | "pending_cash";
  vnpTxnRef?: string;
  paidAt?: string;
  createdAt: string;
  branchName?: string;
  subjectName?: string;
}

export interface FinanceOverview {
  summary: {
    totalRevenue: number;
    totalPaymentsCount: number;
    vnpayRevenue: number;
    cashRevenue: number;
    scholarshipRevenue: number;
    previousPeriodRevenue?: number;
    growthRate?: number;
  };
  monthlyData: Array<{
    month: string;
    revenue: number;
    count: number;
  }>;
  byMethod: {
    PAYOS: number;
    CASH: number;
    SCHOLARSHIP: number;
    FAKE?: number;
  };
}

interface PaymentsState {
  payments: Payment[];
  allPayments: Payment[];
  pendingCashPayments: Payment[];
  financeOverview: FinanceOverview | null;
  isLoading: boolean;
  error: string | null;

  // Create payment
  createPayment: (data: {
    requestIds: string[];
    method: "PAYOS" | "CASH" | "FAKE";
    studentId?: string;
  }) => Promise<{
    paymentId: string;
    paymentUrl?: string;
    checkoutUrl?: string;
    message?: string;
  }>;

  // Admin
  fetchPendingCashPayments: () => Promise<void>;
  fetchAllPayments: () => Promise<void>;
  fetchFinanceOverview: (from?: string, to?: string) => Promise<void>;
  confirmCashPayment: (paymentId: string) => Promise<void>;

  // Common
  fetchMyPayments: () => Promise<void>;

  clearError: () => void;
}

export const usePaymentsStore = create<PaymentsState>((set) => ({
  payments: [],
  allPayments: [],
  pendingCashPayments: [],
  financeOverview: null,
  isLoading: false,
  error: null,

  createPayment: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post("/payments/create", data);
      set({ isLoading: false });
      return response.data;
    } catch (error: unknown) {
      const message =
        (error as ApiErrorShape).response?.data?.message ||
        "Lỗi tạo thanh toán";
      set({ isLoading: false, error: message });
      throw new Error(message);
    }
  },

  fetchAllPayments: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get("/payments/admin/all");
      set({ allPayments: response.data, isLoading: false });
    } catch (error: unknown) {
      const message =
        (error as ApiErrorShape).response?.data?.message ||
        "Lỗi tải tất cả thanh toán";
      set({ isLoading: false, error: message });
    }
  },

  fetchFinanceOverview: async (from?: string, to?: string) => {
    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (from) params.append("from", from);
      if (to) params.append("to", to);

      const url = `/payments/admin/finance-overview${params.toString() ? `?${params.toString()}` : ""}`;

      const response = await api.get(url);

      set({ financeOverview: response.data, isLoading: false });
    } catch (error: unknown) {
      const message =
        (error as ApiErrorShape).response?.data?.message ||
        "Lỗi tải dữ liệu tài chính";
      set({ isLoading: false, error: message });
    }
  },

  fetchPendingCashPayments: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get("/payments/cash/pending");
      set({ pendingCashPayments: response.data, isLoading: false });
    } catch (error: unknown) {
      const message =
        (error as ApiErrorShape).response?.data?.message || "Lỗi tải danh sách";
      set({ isLoading: false, error: message });
    }
  },

  confirmCashPayment: async (paymentId: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.post("/payments/cash/confirm", { paymentId });
      set({ isLoading: false });
    } catch (error: unknown) {
      const message =
        (error as ApiErrorShape).response?.data?.message || "Lỗi xác nhận";
      set({ isLoading: false, error: message });
      throw new Error(message);
    }
  },

  fetchMyPayments: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get("/payments/my");
      set({ payments: response.data, isLoading: false });
    } catch (error: unknown) {
      const message =
        (error as ApiErrorShape).response?.data?.message ||
        "Lỗi tải thanh toán";
      set({ isLoading: false, error: message });
    }
  },

  clearError: () => set({ error: null }),
}));
