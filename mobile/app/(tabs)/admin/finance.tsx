import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useFinanceStore } from "@/lib/stores/finance-store";
import { useBranchesStore } from "@/lib/stores/branches-store";

const { width } = Dimensions.get("window");

const SUBJECT_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#EC4899", "#14B8A6", "#F97316"];

const getMonthName = (month: number): string => {
  const names = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"];
  return names[month - 1] || `T${month}`;
};

const formatCurrency = (amount: number): string => {
  if (amount >= 1000000) {
    return `${(amount / 1000000).toFixed(1)} Tr`;
  } else if (amount >= 1000) {
    return `${(amount / 1000).toFixed(0)}K`;
  }
  return amount.toLocaleString("vi-VN");
};

const formatFullCurrency = (amount: number): string => {
  return amount.toLocaleString("vi-VN") + " ₫";
};

// =================== Expense Modal Component ===================
function ExpenseModal({
  visible,
  branchId,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  branchId: string;
  onClose: () => void;
  onSubmit: (data: { amount: number; description: string; expenseDate: string }) => Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    const numAmount = Number(amount.replace(/[.,]/g, ""));
    if (!numAmount || numAmount <= 0) {
      setError("Số tiền phải lớn hơn 0");
      return;
    }
    if (!description.trim()) {
      setError("Vui lòng nhập nội dung chi phí");
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit({ amount: numAmount, description: description.trim(), expenseDate });
      setAmount("");
      setDescription("");
      setExpenseDate(new Date().toISOString().split("T")[0]);
      onClose();
    } catch (err: any) {
      setError(err.message || "Có lỗi xảy ra");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setAmount("");
    setDescription("");
    setExpenseDate(new Date().toISOString().split("T")[0]);
    setError("");
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.container}>
          {/* Header */}
          <View style={modalStyles.header}>
            <Text style={modalStyles.headerTitle}>💸 Thêm chi phí</Text>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close-circle" size={28} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {/* Amount */}
          <View style={modalStyles.field}>
            <Text style={modalStyles.label}>Số tiền (VNĐ) *</Text>
            <TextInput
              style={modalStyles.input}
              value={amount}
              onChangeText={setAmount}
              placeholder="Nhập số tiền..."
              keyboardType="numeric"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Description */}
          <View style={modalStyles.field}>
            <Text style={modalStyles.label}>Nội dung *</Text>
            <TextInput
              style={[modalStyles.input, { height: 80, textAlignVertical: "top" }]}
              value={description}
              onChangeText={setDescription}
              placeholder="Nhập nội dung chi phí..."
              multiline
              numberOfLines={3}
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Date */}
          <View style={modalStyles.field}>
            <Text style={modalStyles.label}>Ngày chi</Text>
            <TextInput
              style={modalStyles.input}
              value={expenseDate}
              onChangeText={setExpenseDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Error */}
          {error ? (
            <View style={modalStyles.errorBox}>
              <Ionicons name="alert-circle" size={16} color="#DC2626" />
              <Text style={modalStyles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Actions */}
          <View style={modalStyles.actions}>
            <TouchableOpacity style={modalStyles.cancelBtn} onPress={handleClose}>
              <Text style={modalStyles.cancelBtnText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[modalStyles.submitBtn, isSubmitting && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={modalStyles.submitBtnText}>Thêm chi phí</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// =================== Branch Picker Component ===================
function BranchPicker({
  branches,
  selectedBranch,
  onSelect,
}: {
  branches: { _id: string; name: string }[];
  selectedBranch: string;
  onSelect: (id: string) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const selectedName = selectedBranch === "ALL"
    ? "Tất cả cơ sở"
    : branches.find((b) => b._id === selectedBranch)?.name || "Chọn cơ sở";

  return (
    <>
      <TouchableOpacity style={pickerStyles.trigger} onPress={() => setShowPicker(true)}>
        <Ionicons name="business" size={16} color="#10B981" />
        <Text style={pickerStyles.triggerText} numberOfLines={1}>{selectedName}</Text>
        <Ionicons name="chevron-down" size={16} color="#6B7280" />
      </TouchableOpacity>

      <Modal visible={showPicker} transparent animationType="fade" onRequestClose={() => setShowPicker(false)}>
        <TouchableOpacity style={pickerStyles.overlay} activeOpacity={1} onPress={() => setShowPicker(false)}>
          <View style={pickerStyles.container}>
            <Text style={pickerStyles.title}>Chọn cơ sở</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              <TouchableOpacity
                style={[pickerStyles.option, selectedBranch === "ALL" && pickerStyles.optionActive]}
                onPress={() => { onSelect("ALL"); setShowPicker(false); }}
              >
                <Text style={[pickerStyles.optionText, selectedBranch === "ALL" && pickerStyles.optionTextActive]}>
                  🏢 Tất cả cơ sở
                </Text>
                {selectedBranch === "ALL" && <Ionicons name="checkmark-circle" size={20} color="#10B981" />}
              </TouchableOpacity>
              {branches.map((branch) => (
                <TouchableOpacity
                  key={branch._id}
                  style={[pickerStyles.option, selectedBranch === branch._id && pickerStyles.optionActive]}
                  onPress={() => { onSelect(branch._id); setShowPicker(false); }}
                >
                  <Text style={[pickerStyles.optionText, selectedBranch === branch._id && pickerStyles.optionTextActive]}>
                    📍 {branch.name}
                  </Text>
                  {selectedBranch === branch._id && <Ionicons name="checkmark-circle" size={20} color="#10B981" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// =================== Year Picker Component ===================
function YearPicker({
  selectedYear,
  onSelect,
}: {
  selectedYear: number;
  onSelect: (year: number) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const years = [2026, 2025, 2024, 2023];

  return (
    <>
      <TouchableOpacity style={pickerStyles.triggerSmall} onPress={() => setShowPicker(true)}>
        <Ionicons name="calendar" size={16} color="#10B981" />
        <Text style={pickerStyles.triggerText}>{selectedYear}</Text>
        <Ionicons name="chevron-down" size={16} color="#6B7280" />
      </TouchableOpacity>

      <Modal visible={showPicker} transparent animationType="fade" onRequestClose={() => setShowPicker(false)}>
        <TouchableOpacity style={pickerStyles.overlay} activeOpacity={1} onPress={() => setShowPicker(false)}>
          <View style={pickerStyles.container}>
            <Text style={pickerStyles.title}>Chọn năm</Text>
            {years.map((year) => (
              <TouchableOpacity
                key={year}
                style={[pickerStyles.option, selectedYear === year && pickerStyles.optionActive]}
                onPress={() => { onSelect(year); setShowPicker(false); }}
              >
                <Text style={[pickerStyles.optionText, selectedYear === year && pickerStyles.optionTextActive]}>
                  📅 {year}
                </Text>
                {selectedYear === year && <Ionicons name="checkmark-circle" size={20} color="#10B981" />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// =================== Main Finance Screen ===================
export default function FinanceScreen() {
  const {
    dashboard: financeDashboard,
    expenses,
    classHealth,
    weeklyClassReport,
    isLoading: financeLoading,
    error: financeError,
    fetchDashboard,
    fetchClassHealth,
    fetchWeeklyClassReport,
    fetchExpenses,
    createExpense,
    deleteExpense,
    clearError: clearFinanceError,
  } = useFinanceStore();

  const { branches, fetchBranches } = useBranchesStore();

  const [selectedBranch, setSelectedBranch] = useState<string>("ALL");
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch branches on mount
  useEffect(() => {
    fetchBranches();
  }, []);

  // Fetch data when filters change
  useEffect(() => {
    fetchDashboard(selectedBranch, selectedYear);
    fetchWeeklyClassReport(selectedBranch);
    fetchClassHealth(selectedBranch);
    if (selectedBranch !== "ALL") {
      fetchExpenses(selectedBranch);
    }
  }, [selectedBranch, selectedYear]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      fetchDashboard(selectedBranch, selectedYear),
      fetchWeeklyClassReport(selectedBranch),
      fetchClassHealth(selectedBranch),
      selectedBranch !== "ALL" ? fetchExpenses(selectedBranch) : Promise.resolve(),
    ]);
    setRefreshing(false);
  }, [selectedBranch, selectedYear]);

  const handleAddExpense = async (data: { amount: number; description: string; expenseDate: string }) => {
    try {
      await createExpense({ branchId: selectedBranch, ...data });
      await Promise.all([
        fetchDashboard(selectedBranch, selectedYear),
        selectedBranch !== "ALL" ? fetchExpenses(selectedBranch) : Promise.resolve(),
      ]);
    } catch (error) {
      console.error("Failed to create expense:", error);
      throw error;
    }
  };

  const handleDeleteExpense = (id: string) => {
    Alert.alert("Xác nhận", "Bạn có chắc muốn xóa chi phí này?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Xóa",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteExpense(id);
            await fetchDashboard(selectedBranch, selectedYear);
            await fetchExpenses(selectedBranch);
          } catch (error) {
            console.error("Failed to delete expense:", error);
            Alert.alert("Lỗi", "Không thể xóa chi phí");
          }
        },
      },
    ]);
  };

  // Chart helpers
  const revenueByMonth = financeDashboard?.chart?.revenueByMonth || [];
  const expenseByMonth = financeDashboard?.chart?.expenseByMonth || [];
  const chartData = Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const rev = revenueByMonth.find((r) => r.month === month)?.amount || 0;
    const exp = expenseByMonth.find((e) => e.month === month)?.amount || 0;
    return { month, revenue: rev, expense: exp };
  }).filter((d) => d.revenue > 0 || d.expense > 0);

  const maxChartValue = Math.max(...chartData.map((d) => Math.max(d.revenue, d.expense)), 1);

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#10B981"]} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <LinearGradient colors={["#10B981", "#059669"]} style={styles.header}>
          <View style={styles.headerContent}>
            <Ionicons name="wallet" size={28} color="#FFFFFF" />
            <View style={styles.headerInfo}>
              <Text style={styles.headerValue}>
                {financeDashboard ? formatCurrency(financeDashboard.summary.profit) : "---"}
              </Text>
              <Text style={styles.headerSubtitle}>
                Lợi nhuận năm {selectedYear}
              </Text>
            </View>
          </View>
        </LinearGradient>

        {/* Filters: Branch + Year */}
        <View style={styles.filterSection}>
          <View style={styles.filterRow}>
            <View style={{ flex: 2 }}>
              <BranchPicker branches={branches} selectedBranch={selectedBranch} onSelect={setSelectedBranch} />
            </View>
            <View style={{ flex: 1 }}>
              <YearPicker selectedYear={selectedYear} onSelect={setSelectedYear} />
            </View>
          </View>
        </View>

        {/* Loading State */}
        {financeLoading && !refreshing && (
          <View style={styles.stateCard}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={styles.stateText}>Đang tải dữ liệu tài chính...</Text>
          </View>
        )}

        {/* Error State */}
        {financeError && !financeLoading && (
          <View style={styles.stateCard}>
            <Text style={{ fontSize: 40, marginBottom: 8 }}>❌</Text>
            <Text style={[styles.stateText, { color: "#DC2626" }]}>{financeError}</Text>
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => {
                clearFinanceError();
                fetchDashboard(selectedBranch, selectedYear);
              }}
            >
              <Text style={styles.retryBtnText}>Thử lại</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Dashboard Content */}
        {!financeLoading && !financeError && financeDashboard && (
          <>
            {/* Summary Cards */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>💰 Tổng quan tài chính</Text>
              <View style={styles.summaryGrid}>
                {/* Total Revenue */}
                <View style={styles.summaryCard}>
                  <LinearGradient colors={["#10B981", "#059669"]} style={styles.summaryCardGradient}>
                    <View style={styles.summaryCardHeader}>
                      <Ionicons name="trending-up" size={22} color="#FFFFFF" />
                      <Text style={{ fontSize: 20, opacity: 0.8 }}>📈</Text>
                    </View>
                    <Text style={styles.summaryValue}>{formatCurrency(financeDashboard.summary.totalRevenue)}</Text>
                    <Text style={styles.summaryLabel}>Tổng Thu</Text>
                    <Text style={styles.summarySubLabel}>
                      {financeDashboard.summary.totalRevenue > 0
                        ? selectedBranch === "ALL" ? "Tất cả cơ sở" : "Cơ sở này"
                        : "Chưa có dữ liệu"}
                    </Text>
                  </LinearGradient>
                </View>

                {/* Total Expense */}
                <View style={styles.summaryCard}>
                  <LinearGradient colors={["#EF4444", "#DC2626"]} style={styles.summaryCardGradient}>
                    <View style={styles.summaryCardHeader}>
                      <Ionicons name="trending-down" size={22} color="#FFFFFF" />
                      {selectedBranch !== "ALL" && (
                        <TouchableOpacity
                          style={styles.addExpenseBtn}
                          onPress={() => setShowExpenseModal(true)}
                        >
                          <Text style={styles.addExpenseBtnText}>+ Thêm</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    <Text style={styles.summaryValue}>{formatCurrency(financeDashboard.summary.totalExpense)}</Text>
                    <Text style={styles.summaryLabel}>Tổng Chi</Text>
                    <Text style={styles.summarySubLabel}>
                      {financeDashboard.summary.totalExpense > 0 ? "Chi phí vận hành" : "Chưa có chi phí"}
                    </Text>
                  </LinearGradient>
                </View>

                {/* Profit */}
                <View style={styles.summaryCard}>
                  <LinearGradient
                    colors={financeDashboard.summary.profit >= 0 ? ["#3B82F6", "#4F46E5"] : ["#F97316", "#DC2626"]}
                    style={styles.summaryCardGradient}
                  >
                    <View style={styles.summaryCardHeader}>
                      <Ionicons name="diamond" size={22} color="#FFFFFF" />
                      <Text style={{ fontSize: 20, opacity: 0.8 }}>
                        {financeDashboard.summary.profit >= 0 ? "📊" : "📉"}
                      </Text>
                    </View>
                    <Text style={styles.summaryValue}>{formatCurrency(financeDashboard.summary.profit)}</Text>
                    <Text style={styles.summaryLabel}>Lợi nhuận</Text>
                    <Text style={styles.summarySubLabel}>= Thu - Chi</Text>
                  </LinearGradient>
                </View>
              </View>
            </View>

            {/* Revenue/Expense Bar Chart */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📊 Thu/Chi theo tháng</Text>
              <View style={styles.chartCard}>
                {chartData.length > 0 ? (
                  <>
                    <View style={styles.barChartContainer}>
                      {chartData.map((item, index) => (
                        <View key={index} style={styles.barGroup}>
                          <View style={styles.barPair}>
                            {/* Revenue Bar */}
                            <View style={styles.barBackground}>
                              <LinearGradient
                                colors={["#10B981", "#059669"]}
                                style={[styles.bar, { height: `${(item.revenue / maxChartValue) * 100}%` }]}
                              />
                            </View>
                            {/* Expense Bar */}
                            <View style={styles.barBackground}>
                              <LinearGradient
                                colors={["#EF4444", "#DC2626"]}
                                style={[styles.bar, { height: `${(item.expense / maxChartValue) * 100}%` }]}
                              />
                            </View>
                          </View>
                          <Text style={styles.barLabel}>{getMonthName(item.month)}</Text>
                        </View>
                      ))}
                    </View>
                    <View style={styles.chartLegend}>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: "#10B981" }]} />
                        <Text style={styles.legendText}>Doanh thu</Text>
                      </View>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: "#EF4444" }]} />
                        <Text style={styles.legendText}>Chi phí</Text>
                      </View>
                    </View>
                  </>
                ) : (
                  <View style={styles.emptyChart}>
                    <Text style={{ fontSize: 32, marginBottom: 8 }}>📊</Text>
                    <Text style={styles.emptyText}>Chưa có dữ liệu</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Revenue by Subject */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🎯 Thu theo môn học</Text>
              <View style={styles.chartCard}>
                {financeDashboard.revenueBySubject.length > 0 ? (
                  <>
                    {financeDashboard.revenueBySubject.map((item, index) => {
                      const total = financeDashboard.revenueBySubject.reduce((s, i) => s + i.amount, 0);
                      const percent = total > 0 ? ((item.amount / total) * 100) : 0;
                      const color = SUBJECT_COLORS[index % SUBJECT_COLORS.length];
                      return (
                        <View key={index} style={styles.subjectRow}>
                          <View style={styles.subjectInfo}>
                            <View style={[styles.subjectDot, { backgroundColor: color }]} />
                            <Text style={styles.subjectName} numberOfLines={1}>{item.subject}</Text>
                          </View>
                          <View style={styles.subjectBarContainer}>
                            <View style={[styles.subjectBar, { width: `${percent}%`, backgroundColor: color }]} />
                          </View>
                          <View style={styles.subjectValues}>
                            <Text style={styles.subjectPercent}>{percent.toFixed(0)}%</Text>
                            <Text style={styles.subjectAmount}>{formatCurrency(item.amount)}</Text>
                          </View>
                        </View>
                      );
                    })}
                  </>
                ) : (
                  <View style={styles.emptyChart}>
                    <Text style={{ fontSize: 32, marginBottom: 8 }}>🎯</Text>
                    <Text style={styles.emptyText}>Chưa có dữ liệu phân bổ</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Weekly Report Summary */}
            {weeklyClassReport && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>📅 Báo cáo lớp hàng tuần</Text>
                <View style={styles.chartCard}>
                  <View style={styles.reportHeader}>
                    <Text style={styles.reportDate}>Cập nhật: {new Date(weeklyClassReport.generatedAt).toLocaleDateString("vi-VN")}</Text>
                    <View style={styles.reportBadge}>
                      <Text style={styles.reportBadgeText}>{weeklyClassReport.summary.totalClasses} Lớp</Text>
                    </View>
                  </View>
                  <View style={styles.reportGrid}>
                    <View style={styles.reportItem}>
                      <Text style={[styles.reportValue, { color: "#EF4444" }]}>{weeklyClassReport.summary.red}</Text>
                      <Text style={styles.reportLabel}>Rủi ro cao</Text>
                    </View>
                    <View style={styles.reportItem}>
                      <Text style={[styles.reportValue, { color: "#F59E0B" }]}>{weeklyClassReport.summary.yellow}</Text>
                      <Text style={styles.reportLabel}>Cảnh báo</Text>
                    </View>
                    <View style={styles.reportItem}>
                      <Text style={[styles.reportValue, { color: "#10B981" }]}>{weeklyClassReport.summary.green}</Text>
                      <Text style={styles.reportLabel}>An toàn</Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* Class Financial Health Table */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🏥 Sức khỏe tài chính lớp</Text>
              <View style={styles.tableCard}>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Lớp</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: "center" }]}>Học phí</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.2, textAlign: "right" }]}>LN thực tế</Text>
                </View>
                {classHealth.length > 0 ? (
                  classHealth.map((item) => (
                    <View key={item.classId} style={styles.tableRow}>
                      <View style={{ flex: 2 }}>
                        <Text style={[styles.tableCell, { fontWeight: "600", color: "#1F2937" }]} numberOfLines={1}>
                          {item.className}
                        </Text>
                        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
                          <View style={[styles.riskDot, { backgroundColor: item.snapshot.riskLevel === "red" ? "#EF4444" : item.snapshot.riskLevel === "yellow" ? "#F59E0B" : "#10B981" }]} />
                          <Text style={{ fontSize: 11, color: "#6B7280" }}>{item.paidCount}/{item.totalStudents} HS</Text>
                        </View>
                      </View>
                      <View style={{ flex: 1, alignItems: "center" }}>
                        <Text style={[styles.tableCell, { color: "#3B82F6", fontWeight: "600" }]}>
                          {item.paidRate}%
                        </Text>
                      </View>
                      <View style={{ flex: 1.2, alignItems: "flex-end" }}>
                        <Text style={[styles.tableCell, { fontWeight: "700", color: item.snapshot.actualProfit >= item.snapshot.minProfitTarget ? "#059669" : "#DC2626" }]}>
                          {formatCurrency(item.snapshot.actualProfit)}
                        </Text>
                      </View>
                    </View>
                  ))
                ) : (
                  <View style={{ padding: 20, alignItems: "center" }}>
                    <Text style={{ fontSize: 13, color: "#9CA3AF" }}>Chưa có dữ liệu sức khỏe lớp</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Monthly Detail Table */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📋 Chi tiết theo tháng</Text>
              <View style={styles.tableCard}>
                {/* Table Header */}
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Tháng</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.2, textAlign: "right" }]}>Thu</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.2, textAlign: "right" }]}>Chi</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.2, textAlign: "right" }]}>Lợi nhuận</Text>
                </View>
                {/* Table Rows */}
                {financeDashboard.detailByMonth.map((row) => (
                  <View key={row.month} style={styles.tableRow}>
                    <Text style={[styles.tableCell, { flex: 1, fontWeight: "600", color: "#1F2937" }]}>
                      T{row.month}
                    </Text>
                    <Text style={[styles.tableCell, { flex: 1.2, textAlign: "right", color: "#3B82F6", fontWeight: "600" }]}>
                      {formatCurrency(row.revenue)}
                    </Text>
                    <Text style={[styles.tableCell, { flex: 1.2, textAlign: "right", color: "#EF4444", fontWeight: "600" }]}>
                      {formatCurrency(row.expense)}
                    </Text>
                    <View style={{ flex: 1.2, alignItems: "flex-end" }}>
                      <View style={[styles.profitBadge, { backgroundColor: row.profit >= 0 ? "#D1FAE5" : "#FEE2E2" }]}>
                        <Text style={[styles.profitBadgeText, { color: row.profit >= 0 ? "#059669" : "#DC2626" }]}>
                          {formatCurrency(row.profit)}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Expense History (only when a specific branch is selected) */}
            {selectedBranch !== "ALL" && expenses.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>📜 Lịch sử chi phí</Text>
                <View style={styles.tableCard}>
                  {expenses.map((expense) => (
                    <View key={expense._id} style={styles.expenseItem}>
                      <View style={styles.expenseIcon}>
                        <Ionicons name="receipt-outline" size={20} color="#DC2626" />
                      </View>
                      <View style={styles.expenseInfo}>
                        <Text style={styles.expenseDesc} numberOfLines={2}>{expense.description}</Text>
                        <Text style={styles.expenseDate}>
                          {new Date(expense.expenseDate).toLocaleDateString("vi-VN")}
                        </Text>
                      </View>
                      <View style={styles.expenseRight}>
                        <Text style={styles.expenseAmount}>
                          {formatFullCurrency(expense.amount)}
                        </Text>
                        <TouchableOpacity
                          style={styles.deleteBtn}
                          onPress={() => handleDeleteExpense(expense._id)}
                        >
                          <Ionicons name="trash-outline" size={16} color="#EF4444" />
                          <Text style={styles.deleteBtnText}>Xóa</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Expense Modal */}
      <ExpenseModal
        visible={showExpenseModal}
        branchId={selectedBranch}
        onClose={() => setShowExpenseModal(false)}
        onSubmit={handleAddExpense}
      />
    </SafeAreaView>
  );
}

// =================== Styles ===================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 40 },

  // Header
  header: {
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerInfo: { flex: 1 },
  headerValue: { fontSize: 28, fontWeight: "700", color: "#FFFFFF" },
  headerSubtitle: { fontSize: 14, color: "rgba(255,255,255,0.8)", marginTop: 4 },

  // Filters
  filterSection: { paddingHorizontal: 16, marginTop: 16 },
  filterRow: { flexDirection: "row", gap: 10, alignItems: "center" },

  // State
  stateCard: {
    margin: 16,
    padding: 32,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  stateText: { fontSize: 15, color: "#6B7280", marginTop: 12, fontWeight: "500" },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: "#10B981",
    borderRadius: 12,
  },
  retryBtnText: { color: "#FFF", fontWeight: "700", fontSize: 14 },

  // Section
  section: { marginTop: 20, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: "#1F2937", marginBottom: 12 },

  // Summary Cards
  summaryGrid: { gap: 12 },
  summaryCard: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryCardGradient: { padding: 16 },
  summaryCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  summaryValue: { fontSize: 26, fontWeight: "800", color: "#FFFFFF" },
  summaryLabel: { fontSize: 14, fontWeight: "600", color: "rgba(255,255,255,0.9)", marginTop: 4 },
  summarySubLabel: { fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 2 },
  addExpenseBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 10,
  },
  addExpenseBtnText: { fontSize: 12, fontWeight: "700", color: "#DC2626" },

  // Bar Chart
  chartCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  barChartContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 160,
    paddingHorizontal: 4,
  },
  barGroup: { alignItems: "center", flex: 1 },
  barPair: { flexDirection: "row", alignItems: "flex-end", height: 130, gap: 3 },
  barBackground: {
    width: 12,
    height: 130,
    backgroundColor: "#F3F4F6",
    borderRadius: 6,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  bar: { width: "100%", borderRadius: 6 },
  barLabel: { fontSize: 10, color: "#6B7280", marginTop: 6, fontWeight: "500" },
  chartLegend: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    gap: 24,
  },
  legendItem: { flexDirection: "row", alignItems: "center" },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  legendText: { fontSize: 12, color: "#6B7280" },
  emptyChart: { alignItems: "center", paddingVertical: 32 },
  emptyText: { fontSize: 14, color: "#9CA3AF" },

  // Subject Breakdown
  subjectRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  subjectInfo: {
    flexDirection: "row",
    alignItems: "center",
    width: 90,
  },
  subjectDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  subjectName: { fontSize: 12, color: "#374151", fontWeight: "500", flex: 1 },
  subjectBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: "#F3F4F6",
    borderRadius: 4,
    marginHorizontal: 8,
    overflow: "hidden",
  },
  subjectBar: { height: "100%", borderRadius: 4 },
  subjectValues: { width: 70, alignItems: "flex-end" },
  subjectPercent: { fontSize: 11, fontWeight: "700", color: "#374151" },
  subjectAmount: { fontSize: 10, color: "#9CA3AF" },

  // Table
  tableCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  tableHeader: {
    flexDirection: "row",
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#F9FAFB",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  tableHeaderCell: { fontSize: 12, fontWeight: "700", color: "#6B7280" },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  tableCell: { fontSize: 13 },
  profitBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  profitBadgeText: { fontSize: 11, fontWeight: "700" },

  // Expense History
  expenseItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  expenseIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  expenseInfo: { flex: 1 },
  expenseDesc: { fontSize: 13, fontWeight: "600", color: "#1F2937" },
  expenseDate: { fontSize: 11, color: "#9CA3AF", marginTop: 2 },
  expenseRight: { alignItems: "flex-end" },
  expenseAmount: { fontSize: 13, fontWeight: "700", color: "#DC2626" },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "#FEF2F2",
  },
  deleteBtnText: { fontSize: 11, color: "#EF4444", fontWeight: "600" },

  // Weekly Report
  reportHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  reportDate: { fontSize: 12, color: "#6B7280" },
  reportBadge: { backgroundColor: "#EEF2FF", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  reportBadgeText: { fontSize: 12, fontWeight: "700", color: "#4F46E5" },
  reportGrid: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 },
  reportItem: { alignItems: "center", flex: 1 },
  reportValue: { fontSize: 20, fontWeight: "800", marginBottom: 4 },
  reportLabel: { fontSize: 11, color: "#6B7280", fontWeight: "500" },
  
  // Class Health
  riskDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
});

// =================== Modal Styles ===================
const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  container: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#1F2937" },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#1F2937",
    backgroundColor: "#F9FAFB",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF2F2",
    padding: 10,
    borderRadius: 10,
    marginBottom: 16,
  },
  errorText: { fontSize: 13, color: "#DC2626", flex: 1 },
  actions: { flexDirection: "row", gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
  },
  cancelBtnText: { fontSize: 14, fontWeight: "600", color: "#6B7280" },
  submitBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#DC2626",
    alignItems: "center",
  },
  submitBtnText: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
});

// =================== Picker Styles ===================
const pickerStyles = StyleSheet.create({
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: "#D1FAE5",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  triggerSmall: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: "#D1FAE5",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  triggerText: { fontSize: 14, fontWeight: "600", color: "#1F2937", flex: 1 },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  container: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 12,
    textAlign: "center",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 4,
  },
  optionActive: { backgroundColor: "#ECFDF5" },
  optionText: { fontSize: 14, color: "#374151", fontWeight: "500" },
  optionTextActive: { color: "#059669", fontWeight: "700" },
});
