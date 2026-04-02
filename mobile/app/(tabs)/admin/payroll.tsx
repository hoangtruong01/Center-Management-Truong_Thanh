import { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useFinanceStore, ClassPayrollSummary, PayrollBlock } from "@/lib/stores/finance-store";
import { useBranchesStore } from "@/lib/stores/branches-store";

const { width } = Dimensions.get("window");

const formatCurrency = (amount: number): string => {
  return amount.toLocaleString("vi-VN") + " ₫";
};

export default function PayrollScreen() {
  const {
    payrollSummaries,
    isLoading,
    error,
    fetchPayroll,
    clearError,
  } = useFinanceStore();

  const { branches, fetchBranches } = useBranchesStore();
  const [selectedBranch, setSelectedBranch] = useState<string>("ALL");
  const [expandedClassId, setExpandedClassId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchBranches();
  }, []);

  useEffect(() => {
    fetchPayroll(selectedBranch);
  }, [selectedBranch]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPayroll(selectedBranch);
    setRefreshing(false);
  }, [selectedBranch]);

  const toggleExpand = (classId: string) => {
    setExpandedClassId(expandedClassId === classId ? null : classId);
  };

  const renderBlock = (block: PayrollBlock) => (
    <View key={block.blockNumber} style={styles.blockCard}>
      <View style={styles.blockHeader}>
        <View style={styles.blockBadge}>
          <Text style={styles.blockBadgeText}>Buổi {block.sessionRange}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: block.paymentStatus === "fully_paid" ? "#D1FAE5" : "#FEE2E2" }]}>
          <Text style={[styles.statusBadgeText, { color: block.paymentStatus === "fully_paid" ? "#059669" : "#DC2626" }]}>
            {block.paymentStatus === "fully_paid" ? "Đã thu đủ" : "Chưa đủ"}
          </Text>
        </View>
      </View>
      
      <View style={styles.blockMetrics}>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Doanh thu</Text>
          <Text style={styles.metricValue}>{formatCurrency(block.totalRevenue)}</Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Lương GV (70%)</Text>
          <Text style={[styles.metricValue, { color: "#10B981" }]}>{formatCurrency(block.teacherShare)}</Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Trung tâm (30%)</Text>
          <Text style={[styles.metricValue, { color: "#3B82F6" }]}>{formatCurrency(block.centerShare)}</Text>
        </View>
      </View>
      <View style={styles.blockFooter}>
        <Text style={styles.blockFooterText}>
          👥 {block.paidStudentCount}/{block.studentCount} học sinh đã đóng phí
        </Text>
      </View>
    </View>
  );

  const renderClassItem = ({ item }: { item: ClassPayrollSummary }) => {
    const isExpanded = expandedClassId === item.classId;
    return (
      <View style={styles.classCard}>
        <TouchableOpacity 
          style={styles.classCardHeader} 
          onPress={() => toggleExpand(item.classId)}
          activeOpacity={0.7}
        >
          <View style={styles.classInfo}>
            <Text style={styles.className}>{item.className}</Text>
            <Text style={styles.teacherName}>👨‍🏫 {item.teacherName}</Text>
          </View>
          <View style={styles.classTotals}>
            <Text style={styles.totalLabel}>Tổng lương GV</Text>
            <Text style={styles.totalValue}>{formatCurrency(item.totalTeacherShare)}</Text>
          </View>
          <Ionicons 
            name={isExpanded ? "chevron-up" : "chevron-down"} 
            size={20} 
            color="#6B7280" 
          />
        </TouchableOpacity>

        {isExpanded && (
          <View style={styles.expandedContent}>
            <View style={styles.divider} />
            <Text style={styles.blocksTitle}>Chi tiết theo đợt (10 buổi)</Text>
            {item.blocks.map(renderBlock)}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      <LinearGradient colors={["#8B5CF6", "#7C3AED"]} style={styles.header}>
        <View style={styles.headerContent}>
          <Ionicons name="cash" size={24} color="#FFFFFF" />
          <Text style={styles.headerTitle}>Tính lương giáo viên (70/30)</Text>
        </View>
        <Text style={styles.headerSubtitle}>
          Dựa trên số tiền học sinh đã thực đóng
        </Text>
      </LinearGradient>

      <View style={styles.filterBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          <TouchableOpacity 
            style={[styles.filterChip, selectedBranch === "ALL" && styles.filterChipActive]}
            onPress={() => setSelectedBranch("ALL")}
          >
            <Text style={[styles.filterChipText, selectedBranch === "ALL" && styles.filterChipTextActive]}>Tất cả cơ sở</Text>
          </TouchableOpacity>
          {branches.map(branch => (
            <TouchableOpacity 
              key={branch._id}
              style={[styles.filterChip, selectedBranch === branch._id && styles.filterChipActive]}
              onPress={() => setSelectedBranch(branch._id)}
            >
              <Text style={[styles.filterChipText, selectedBranch === branch._id && styles.filterChipTextActive]}>{branch.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {isLoading && !refreshing ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={styles.loadingText}>Đang tính toán bảng lương...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerBox}>
          <Ionicons name="alert-circle" size={48} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchPayroll(selectedBranch)}>
            <Text style={styles.retryText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : payrollSummaries.length === 0 ? (
        <View style={styles.centerBox}>
          <Ionicons name="receipt-outline" size={48} color="#9CA3AF" />
          <Text style={styles.emptyText}>Chưa có dữ liệu lương trong kỳ này</Text>
        </View>
      ) : (
        <FlatList
          data={payrollSummaries}
          renderItem={renderClassItem}
          keyExtractor={item => item.classId}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#8B5CF6"]} />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  header: { padding: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerContent: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#FFFFFF" },
  headerSubtitle: { fontSize: 13, color: "rgba(255,255,255,0.8)", marginTop: 4 },
  
  filterBar: { paddingVertical: 12, backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  filterScroll: { paddingHorizontal: 16, gap: 8 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: "#F3F4F6", borderWidth: 1, borderColor: "#E5E7EB" },
  filterChipActive: { backgroundColor: "#8B5CF6", borderColor: "#8B5CF6" },
  filterChipText: { fontSize: 13, color: "#4B5563", fontWeight: "500" },
  filterChipTextActive: { color: "#FFFFFF" },

  listContent: { padding: 16, gap: 16 },
  classCard: { backgroundColor: "#FFFFFF", borderRadius: 16, overflow: "hidden", elevation: 2, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 5 },
  classCardHeader: { padding: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  classInfo: { flex: 1 },
  className: { fontSize: 16, fontWeight: "700", color: "#111827" },
  teacherName: { fontSize: 13, color: "#6B7280", marginTop: 2 },
  classTotals: { alignItems: "flex-end", marginRight: 8 },
  totalLabel: { fontSize: 10, color: "#6B7280", textTransform: "uppercase" },
  totalValue: { fontSize: 15, fontWeight: "700", color: "#10B981" },
  
  expandedContent: { padding: 16, paddingTop: 0, backgroundColor: "#F9FAFB" },
  divider: { height: 1, backgroundColor: "#E5E7EB", marginBottom: 16 },
  blocksTitle: { fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 12 },
  blockCard: { backgroundColor: "#FFFFFF", borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: "#E5E7EB" },
  blockHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  blockBadge: { backgroundColor: "#EEF2FF", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  blockBadgeText: { fontSize: 11, fontWeight: "600", color: "#4F46E5" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  statusBadgeText: { fontSize: 11, fontWeight: "600" },
  
  blockMetrics: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  metricItem: { flex: 1 },
  metricLabel: { fontSize: 10, color: "#6B7280", marginBottom: 2 },
  metricValue: { fontSize: 12, fontWeight: "700", color: "#111827" },
  blockFooter: { marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: "#F3F4F6" },
  blockFooterText: { fontSize: 11, color: "#6B7280" },

  centerBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  loadingText: { marginTop: 16, fontSize: 14, color: "#6B7280" },
  errorText: { marginTop: 12, fontSize: 14, color: "#DC2626", textAlign: "center" },
  retryBtn: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 10, backgroundColor: "#8B5CF6", borderRadius: 12 },
  retryText: { color: "#FFFFFF", fontWeight: "600" },
  emptyText: { marginTop: 12, fontSize: 14, color: "#6B7280" },
});
