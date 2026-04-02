import { create } from "zustand";
import api from "../api";

export interface FinanceDashboard {
  branchId: string;
  year: number;
  summary: {
    totalRevenue: number;
    totalExpense: number;
    profit: number;
  };
  chart: {
    revenueByMonth: Array<{ month: number; amount: number }>;
    expenseByMonth: Array<{ month: number; amount: number }>;
  };
  revenueBySubject: Array<{ subject: string; amount: number }>;
  detailByMonth: Array<{
    month: number;
    revenue: number;
    expense: number;
    profit: number;
  }>;
}

export interface Expense {
  _id: string;
  branchId: string;
  amount: number;
  description: string;
  expenseDate: string;
  createdAt: string;
  createdBy?: { _id: string; name: string };
}

export interface CreateExpenseDto {
  branchId: string;
  amount: number;
  description: string;
  expenseDate?: string;
}

export interface ClassFinancialHealthItem {
  classRequestId: string;
  classId: string;
  className: string;
  classSubject?: string;
  status: string;
  dueDate?: string;
  totalStudents: number;
  paidCount: number;
  paidRate: number;
  snapshot: {
    listedRevenue: number;
    scholarshipDiscountTotal: number;
    scholarshipDiscountRatio: number;
    estimatedRevenue: number;
    estimatedCost: number;
    projectedProfit: number;
    collectedRevenue: number;
    outstandingAmount: number;
    overdueDebtAmount: number;
    actualCollectionRate: number;
    actualProfit: number;
    minProfitTarget: number;
    riskLevel: "green" | "yellow" | "red";
    isCapExceeded: boolean;
  };
}

export interface TeacherPayout {
  _id: string;
  teacherId: string;
  classId: {
    _id: string;
    name: string;
  };
  blockNumber: number;
  amount: number;
  status: "notified" | "confirmed";
  notifiedAt: string;
  confirmedAt?: string;
  paymentMethod: string;
  notes?: string;
}

export interface PayrollBlock {
  blockNumber: number;
  sessionRange: string;
  totalRevenue: number;
  teacherShare: number;
  centerShare: number;
  paymentStatus: "fully_paid" | "partially_paid" | "unpaid";
  studentCount: number;
  paidStudentCount: number;
}

export interface ClassPayrollSummary {
  classId: string;
  className: string;
  teacherName: string;
  totalRevenue: number;
  totalTeacherShare: number;
  blocks: PayrollBlock[];
}

export interface WeeklyClassFinancialReport {
  generatedAt: string;
  branchId: string;
  summary: {
    totalClasses: number;
    red: number;
    yellow: number;
    green: number;
    totalOutstanding: number;
    totalOverdueDebt: number;
  };
  topRisks: Array<{
    classRequestId: string;
    className: string;
    riskLevel: "green" | "yellow" | "red";
    outstandingAmount: number;
    overdueDebtAmount: number;
    actualProfit: number;
    minProfitTarget: number;
    isCapExceeded: boolean;
  }>;
}

interface FinanceState {
  dashboard: FinanceDashboard | null;
  expenses: Expense[];
  classHealth: ClassFinancialHealthItem[];
  weeklyClassReport: WeeklyClassFinancialReport | null;
  payrollSummaries: ClassPayrollSummary[];
  myPayouts: TeacherPayout[];
  isLoading: boolean;
  error: string | null;
  fetchDashboard: (branchId: string, year: number) => Promise<void>;
  fetchClassHealth: (branchId: string, risk?: "all" | "green" | "yellow" | "red") => Promise<void>;
  fetchWeeklyClassReport: (branchId: string) => Promise<void>;
  fetchExpenses: (branchId: string) => Promise<void>;
  fetchPayroll: (branchId: string, month?: number, year?: number) => Promise<void>;
  fetchMyPayouts: () => Promise<void>;
  confirmPayout: (payoutId: string) => Promise<void>;
  payTeacher: (data: any) => Promise<void>;
  createExpense: (data: CreateExpenseDto) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  clearError: () => void;
}

export const useFinanceStore = create<FinanceState>((set) => ({
  dashboard: null,
  expenses: [],
  classHealth: [],
  weeklyClassReport: null,
  payrollSummaries: [],
  myPayouts: [],
  isLoading: false,
  error: null,

  fetchDashboard: async (branchId, year) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get(
        `/admin/finance/dashboard?branchId=${branchId}&year=${year}`
      );
      set({ dashboard: response.data, isLoading: false });
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.message || "Lỗi tải dashboard tài chính",
      });
    }
  },

  fetchClassHealth: async (branchId, risk = "all") => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get(
        `/admin/finance/class-health?branchId=${branchId}&risk=${risk}`
      );
      set({ classHealth: response.data || [], isLoading: false });
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.message || "Lỗi tải sức khỏe tài chính lớp",
      });
    }
  },

  fetchWeeklyClassReport: async (branchId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get(
        `/admin/finance/weekly-class-report?branchId=${branchId}`
      );
      set({ weeklyClassReport: response.data || null, isLoading: false });
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.message || "Lỗi tải báo cáo lớp hàng tuần",
      });
    }
  },

  fetchExpenses: async (branchId) => {
    if (branchId === "ALL") {
      set({ expenses: [] });
      return;
    }
    set({ isLoading: true, error: null });
    try {
      const response = await api.get(
        `/admin/finance/expenses?branchId=${branchId}`
      );
      set({ expenses: response.data.expenses || [], isLoading: false });
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.message || "Lỗi tải danh sách chi phí",
      });
    }
  },

  fetchPayroll: async (branchId, month, year) => {
    set({ isLoading: true, error: null });
    try {
      const params: any = { branchId };
      if (month) params.month = month;
      if (year) params.year = year;
      const response = await api.get("/admin/finance/payroll", { params });
      set({ payrollSummaries: response.data || [], isLoading: false });
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.message || "Lỗi tải dữ liệu tính lương",
      });
    }
  },

  createExpense: async (data) => {
    set({ isLoading: true, error: null });
    try {
      await api.post("/admin/finance/expenses", data);
      set({ isLoading: false });
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.message || "Lỗi tạo chi phí",
      });
      throw error;
    }
  },

  fetchMyPayouts: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get("/admin/finance/payroll/my-payouts");
      set({ myPayouts: response.data || [], isLoading: false });
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.message || "Lỗi tải lịch sử nhận lương",
      });
    }
  },

  confirmPayout: async (payoutId) => {
    set({ isLoading: true, error: null });
    try {
      await api.post(`/admin/finance/payroll/confirm/${payoutId}`);
      // Refresh after confirmation
      const response = await api.get("/admin/finance/payroll/my-payouts");
      set({ myPayouts: response.data || [], isLoading: false });
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.message || "Lỗi khi xác nhận nhận tiền",
      });
      throw error;
    }
  },

  payTeacher: async (data) => {
    set({ isLoading: true, error: null });
    try {
      await api.post("/admin/finance/payroll/payout", data);
      set({ isLoading: false });
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.message || "Lỗi khi thông báo lương",
      });
      throw error;
    }
  },

  deleteExpense: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await api.delete(`/admin/finance/expenses/${id}`);
      set({ isLoading: false });
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.response?.data?.message || "Lỗi xóa chi phí",
      });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));
