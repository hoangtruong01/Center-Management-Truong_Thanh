"use client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import ExpenseModal from "@/components/modals/expense-modal";

interface FinanceTabProps {
  selectedBranch: string;
  setSelectedBranch: (id: string) => void;
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  branches: any[];
  financeLoading: boolean;
  financeError: string | null;
  clearFinanceError: () => void;
  fetchDashboard: (branch: string, year: number) => Promise<void>;
  financeDashboard: any;
  weeklyClassReport: any;
  classHealthRiskFilter: "all" | "green" | "yellow" | "red";
  setClassHealthRiskFilter: (filter: "all" | "green" | "yellow" | "red") => void;
  classHealth: any[];
  setShowExpenseModal: (show: boolean) => void;
  expenses: any[];
  handleDeleteExpense: (id: string) => Promise<void>;
  showExpenseModal: boolean;
  handleAddExpense: (data: any) => Promise<void>;
}

export default function FinanceTab({
  selectedBranch,
  setSelectedBranch,
  selectedYear,
  setSelectedYear,
  branches,
  financeLoading,
  financeError,
  clearFinanceError,
  fetchDashboard,
  financeDashboard,
  weeklyClassReport,
  classHealthRiskFilter,
  setClassHealthRiskFilter,
  classHealth,
  setShowExpenseModal,
  expenses,
  handleDeleteExpense,
  showExpenseModal,
  handleAddExpense,
}: FinanceTabProps) {
  // === Finance Helper Functions ===
  const formatCurrency = (amount: number): string => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)} Tr`;
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(0)}K`;
    }
    return amount.toLocaleString("vi-VN");
  };

  const getMonthName = (month: number): string => {
    const names = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"];
    return names[month - 1] || `T${month}`;
  };

  const getRiskBadgeClass = (risk: "green" | "yellow" | "red") => {
    if (risk === "red") return "bg-red-100 text-red-700";
    if (risk === "yellow") return "bg-amber-100 text-amber-700";
    return "bg-emerald-100 text-emerald-700";
  };

  const getRiskLabel = (risk: "green" | "yellow" | "red") => {
    if (risk === "red") return "Nguy cơ cao";
    if (risk === "yellow") return "Cần theo dõi";
    return "Ổn định";
  };

  return (
    <div className="mt-6">
      {/* Branch Selector & Year Selector */}
      <div className="mb-6 flex gap-4 items-center">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700 mb-2">Chọn cơ sở</label>
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="nice-select w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="ALL">Tất cả cơ sở</option>
            {branches.map((branch) => (
              <option key={branch._id} value={branch._id}>
                {branch.name}
              </option>
            ))}
          </select>
        </div>

        <div className="w-40">
          <label className="block text-sm font-medium text-gray-700 mb-2">Năm</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="nice-select w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={2026}>2026</option>
            <option value={2025}>2025</option>
            <option value={2024}>2024</option>
          </select>
        </div>
      </div>

      {/* Loading State */}
      {financeLoading && (
        <Card className="p-12 text-center bg-white border-0 shadow-lg">
          <div className="text-6xl mb-4 animate-pulse">💰</div>
          <p className="text-gray-500 text-lg font-medium">Đang tải dữ liệu tài chính...</p>
        </Card>
      )}

      {/* Error State */}
      {financeError && !financeLoading && (
        <Card className="p-12 text-center bg-white border-0 shadow-lg">
          <div className="text-6xl mb-4">❌</div>
          <p className="text-red-600 text-lg font-medium mb-2">{financeError}</p>
          <Button
            onClick={() => {
              clearFinanceError();
              fetchDashboard(selectedBranch, selectedYear);
            }}
            className="mt-4"
          >
            Thử lại
          </Button>
        </Card>
      )}

      {/* Dashboard Content */}
      {!financeLoading && !financeError && financeDashboard && (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-3 mb-6">
            {/* Total Revenue */}
            <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="absolute inset-0 bg-linear-to-br from-green-500 to-emerald-600 opacity-90" />
              <div className="relative p-5 text-white">
                <div className="flex items-start justify-between">
                  <div className="text-sm">
                    <p className="text-white/80 font-medium">💰 Tổng Thu</p>
                    <p className="text-3xl font-bold mt-2">{formatCurrency(financeDashboard.summary.totalRevenue)}</p>
                    <p className="text-white/70 text-[10px] mt-1">
                      {financeDashboard.summary.totalRevenue > 0 ? (selectedBranch === "ALL" ? "Tất cả cơ sở" : "Cơ sở này") : "Chưa có dữ liệu"}
                    </p>
                  </div>
                  <span className="text-4xl opacity-80">📈</span>
                </div>
              </div>
            </Card>

            {/* Total Expense */}
            <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="absolute inset-0 bg-linear-to-br from-red-500 to-pink-600 opacity-90" />
              <div className="relative p-5 text-white">
                <div className="flex items-start justify-between">
                  <div className="flex-1 text-sm">
                    <div className="flex items-center justify-between">
                      <p className="text-white/80 font-medium">💸 Tổng Chi</p>
                      {selectedBranch !== "ALL" && (
                        <button
                          onClick={() => setShowExpenseModal(true)}
                          className="px-3 py-1 bg-white text-pink-600 hover:bg-pink-50 border border-white/40 rounded-lg text-xs font-bold transition-all shadow-sm"
                        >
                          + Thêm
                        </button>
                      )}
                    </div>
                    <p className="text-3xl font-bold mt-2">{formatCurrency(financeDashboard.summary.totalExpense)}</p>
                    <p className="text-white/70 text-[10px] mt-1">{financeDashboard.summary.totalExpense > 0 ? `Chi phí vận hành` : "Chưa có chi phí"}</p>
                  </div>
                  <span className="text-4xl opacity-80">💸</span>
                </div>
              </div>
            </Card>

            {/* Profit */}
            <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div
                className={`absolute inset-0 bg-linear-to-br ${
                  financeDashboard.summary.profit >= 0 ? "from-blue-500 to-indigo-600" : "from-orange-500 to-red-600"
                } opacity-90`}
              />
              <div className="relative p-5 text-white text-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-white/80 font-medium">💎 Lợi nhuận</p>
                    <p className="text-3xl font-bold mt-2">{formatCurrency(financeDashboard.summary.profit)}</p>
                    <p className="text-white/70 text-[10px] mt-1">= Thu - Chi</p>
                  </div>
                  <span className="text-4xl opacity-80">{financeDashboard.summary.profit >= 0 ? "📊" : "📉"}</span>
                </div>
              </div>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3 mb-6">
            <Card className="p-5 bg-white border-0 shadow-lg lg:col-span-1">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-gray-900">Báo cáo lớp theo tuần</p>
                <span className="text-[10px] text-gray-500">
                  {weeklyClassReport?.generatedAt ? new Date(weeklyClassReport.generatedAt).toLocaleString("vi-VN") : "-"}
                </span>
              </div>
              <div className="space-y-2 text-xs">
                <p>
                  Tổng lớp: <strong>{weeklyClassReport?.summary.totalClasses || 0}</strong>
                </p>
                <p>
                  Rủi ro cao: <strong className="text-red-600">{weeklyClassReport?.summary.red || 0}</strong>
                </p>
                <p>
                  Cần theo dõi: <strong className="text-amber-600">{weeklyClassReport?.summary.yellow || 0}</strong>
                </p>
                <p>
                  Ổn định: <strong className="text-emerald-600">{weeklyClassReport?.summary.green || 0}</strong>
                </p>
                <p>
                  Công nợ: <strong>{formatCurrency(weeklyClassReport?.summary.totalOutstanding || 0)}</strong>
                </p>
                <p>
                  Nợ quá hạn: <strong className="text-red-600">{formatCurrency(weeklyClassReport?.summary.totalOverdueDebt || 0)}</strong>
                </p>
              </div>
            </Card>

            <Card className="p-5 bg-white border-0 shadow-lg lg:col-span-2">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-3">
                <div>
                  <p className="font-bold text-gray-900 text-sm">Sức khỏe tài chính lớp</p>
                </div>
                <select
                  value={classHealthRiskFilter}
                  onChange={(e) => setClassHealthRiskFilter(e.target.value as any)}
                  className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs"
                >
                  <option value="all">Tất cả mức rủi ro</option>
                  <option value="red">Nguy cơ cao</option>
                  <option value="yellow">Cần theo dõi</option>
                  <option value="green">Ổn định</option>
                </select>
              </div>

              <div className="overflow-x-auto text-[11px]">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-2 font-semibold text-gray-600">Lớp</th>
                      <th className="text-right py-2 px-2 font-semibold text-gray-600">Thu</th>
                      <th className="text-right py-2 px-2 font-semibold text-gray-600">Lãi</th>
                      <th className="text-right py-2 px-2 font-semibold text-gray-600">Nợ</th>
                      <th className="text-right py-2 px-2 font-semibold text-gray-600">Rủi ro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {classHealth.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-gray-500">
                          Chưa có dữ liệu.
                        </td>
                      </tr>
                    ) : (
                      classHealth.slice(0, 10).map((item) => (
                        <tr key={item.classRequestId} className="border-b border-gray-100">
                          <td className="py-2 px-2">
                            <p className="font-semibold text-gray-900">{item.className}</p>
                          </td>
                          <td className="py-2 px-2 text-right text-blue-700">{formatCurrency(item.snapshot.collectedRevenue)}</td>
                          <td className="py-2 px-2 text-right">
                            <span className={item.snapshot.actualProfit >= 0 ? "text-emerald-700" : "text-red-600"}>
                              {formatCurrency(item.snapshot.actualProfit)}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-right text-red-600">{formatCurrency(item.snapshot.overdueDebtAmount)}</td>
                          <td className="py-2 px-2 text-right">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${getRiskBadgeClass(item.snapshot.riskLevel)}`}>
                              {getRiskLabel(item.snapshot.riskLevel)}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Charts */}
          <div className="grid gap-6 lg:grid-cols-2 mb-6">
            {/* Revenue/Expense by Month Chart */}
            <Card className="p-6 bg-white border-0 shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">📈</span>
                <div className="text-sm">
                  <p className="font-bold text-gray-900">Thu/Chi theo tháng</p>
                  <p className="text-[10px] text-gray-500">Năm {selectedYear}</p>
                </div>
              </div>
              <div className="h-72">
                {financeDashboard.chart.revenueByMonth.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={financeDashboard.chart.revenueByMonth.map((item, idx) => ({
                        month: getMonthName(item.month),
                        thu: item.amount / 1000000,
                        chi: (financeDashboard.chart.expenseByMonth[idx]?.amount || 0) / 1000000,
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#6b7280" }} />
                      <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} />
                      <Tooltip formatter={(value: number) => [`${value.toFixed(1)} Tr`]} />
                      <Bar dataKey="thu" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Thu" />
                      <Bar dataKey="chi" fill="#ef4444" radius={[4, 4, 0, 0]} name="Chi" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400">📊 Chưa có dữ liệu</div>
                )}
              </div>
            </Card>

            {/* Revenue by Subject Chart */}
            <Card className="p-6 bg-white border-0 shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">🎯</span>
                <div className="text-sm">
                  <p className="font-bold text-gray-900">Thu theo môn học</p>
                </div>
              </div>
              <div className="h-72">
                {financeDashboard.revenueBySubject.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={financeDashboard.revenueBySubject.map((item) => ({
                          name: item.subject,
                          value: item.amount,
                        }))}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {financeDashboard.revenueBySubject.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"][index % 5]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => `${formatCurrency(value)}`} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400">🎯 Chưa có dữ liệu</div>
                )}
              </div>
            </Card>
          </div>

          {/* Detail Table */}
          <Card className="p-6 bg-white border-0 shadow-lg mb-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">📋</span>
              <div className="text-sm">
                <p className="font-bold text-gray-900">Chi tiết theo tháng</p>
              </div>
            </div>
            <div className="overflow-x-auto text-xs">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="py-3 px-4 font-semibold text-gray-600">Tháng</th>
                    <th className="py-3 px-4 text-right font-semibold text-gray-600">Thu</th>
                    <th className="py-3 px-4 text-right font-semibold text-gray-600">Chi</th>
                    <th className="py-3 px-4 text-right font-semibold text-gray-600">Lợi nhuận</th>
                  </tr>
                </thead>
                <tbody>
                  {financeDashboard.detailByMonth.map((row) => (
                    <tr key={row.month} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium text-gray-900">Tháng {row.month}</td>
                      <td className="py-3 px-4 text-right text-blue-600 font-semibold">{formatCurrency(row.revenue)}</td>
                      <td className="py-3 px-4 text-right text-red-500 font-semibold">{formatCurrency(row.expense)}</td>
                      <td className="py-3 px-4 text-right">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            row.profit >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                          }`}
                        >
                          {formatCurrency(row.profit)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* Expense Modal */}
      <ExpenseModal isOpen={showExpenseModal} branchId={selectedBranch} onClose={() => setShowExpenseModal(false)} onSubmit={handleAddExpense} />
    </div>
  );
}
