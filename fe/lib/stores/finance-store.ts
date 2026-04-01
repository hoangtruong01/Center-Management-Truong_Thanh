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
  createdBy?: {
    _id: string;
    name: string;
  };
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

export interface PayrollBlock {
  blockNumber: number;
  sessionRange: string; // e.g. "1-10"
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
  // State
  dashboard: FinanceDashboard | null;
  expenses: Expense[];
  classHealth: ClassFinancialHealthItem[];
  weeklyClassReport: WeeklyClassFinancialReport | null;
  payrollSummaries: ClassPayrollSummary[];
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchDashboard: (branchId: string, year: number) => Promise<void>;
  fetchClassHealth: (
    branchId: string,
    risk?: "all" | "green" | "yellow" | "red",
  ) => Promise<void>;
  fetchWeeklyClassReport: (branchId: string) => Promise<void>;
  fetchExpenses: (branchId: string) => Promise<void>;
  fetchPayroll: (branchId: string, month?: number, year?: number) => Promise<void>;
  createExpense: (data: CreateExpenseDto) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  clearError: () => void;
}

export const useFinanceStore = create<FinanceState>((set) => ({
  // Initial state
  dashboard: null,
  expenses: [],
  classHealth: [],
  weeklyClassReport: null,
  payrollSummaries: [],
  isLoading: false,
  error: null,

  // Fetch dashboard
  fetchDashboard: async (branchId: string, year: number) => {
    set({ isLoading: true, error: null });
    try {
      console.log(`📊 Fetching dashboard: branchId=${branchId}, year=${year}`);
      const response = await api.get(
        `/admin/finance/dashboard?branchId=${branchId}&year=${year}`,
      );
      console.log("✅ Dashboard data:", response.data);
      set({ dashboard: response.data, isLoading: false });
    } catch (error: any) {
      const message =
        error.response?.data?.message || "Lỗi tải dashboard tài chính";
      console.error("❌ Dashboard error:", error);
      set({ isLoading: false, error: message });
    }
  },

  fetchClassHealth: async (branchId, risk = "all") => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get(
        `/admin/finance/class-health?branchId=${branchId}&risk=${risk}`,
      );
      set({ classHealth: response.data || [], isLoading: false });
    } catch (error: any) {
      const message =
        error.response?.data?.message || "Lỗi tải sức khỏe tài chính lớp";
      set({ isLoading: false, error: message });
    }
  },

  fetchWeeklyClassReport: async (branchId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get(
        `/admin/finance/weekly-class-report?branchId=${branchId}`,
      );
      set({ weeklyClassReport: response.data || null, isLoading: false });
    } catch (error: any) {
      const message =
        error.response?.data?.message || "Lỗi tải báo cáo lớp hàng tuần";
      set({ isLoading: false, error: message });
    }
  },

  // Fetch expenses (only for specific branch)
  fetchExpenses: async (branchId: string) => {
    if (branchId === "ALL") {
      set({ expenses: [] });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      console.log(`📜 Fetching expenses: branchId=${branchId}`);
      const response = await api.get(
        `/admin/finance/expenses?branchId=${branchId}`,
      );
      console.log("✅ Expenses data:", response.data);
      set({ expenses: response.data.expenses || [], isLoading: false });
    } catch (error: any) {
      const message =
        error.response?.data?.message || "Lỗi tải danh sách chi phí";
      console.error("❌ Expenses error:", error);
      set({ isLoading: false, error: message });
    }
  },

  // Fetch payroll data
  fetchPayroll: async (branchId: string, month?: number, year?: number) => {
    set({ isLoading: true, error: null });
    try {
      const params: any = { branchId };
      if (month) params.month = month;
      if (year) params.year = year;

      const response = await api.get("/admin/finance/payroll", { params });
      set({ payrollSummaries: response.data || [], isLoading: false });
    } catch (error: any) {
      const message =
        error.response?.data?.message || "Lỗi tải dữ liệu tính lương";
      set({ isLoading: false, error: message });
    }
  },

  // Create expense
  createExpense: async (data: CreateExpenseDto) => {
    set({ isLoading: true, error: null });
    try {
      console.log("💰 Creating expense:", data);
      await api.post("/admin/finance/expenses", data);
      console.log("✅ Expense created successfully");
      set({ isLoading: false });
    } catch (error: any) {
      const message = error.response?.data?.message || "Lỗi tạo chi phí";
      console.error("❌ Create expense error:", error);
      set({ isLoading: false, error: message });
      throw error; // Re-throw để component xử lý
    }
  },

  // Delete expense
  deleteExpense: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      console.log(`🗑️ Deleting expense: ${id}`);
      await api.delete(`/admin/finance/expenses/${id}`);
      console.log("✅ Expense deleted successfully");
      set({ isLoading: false });
    } catch (error: any) {
      const message = error.response?.data?.message || "Lỗi xóa chi phí";
      console.error("❌ Delete expense error:", error);
      set({ isLoading: false, error: message });
      throw error;
    }
  },

  // Clear error
  clearError: () => set({ error: null }),
}));
