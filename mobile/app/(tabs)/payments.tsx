import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import {
  useAuthStore,
  usePaymentRequestsStore,
  StudentPaymentRequest,
  ChildPaymentRequests,
} from "@/lib/stores";
import PaymentModal from "@/components/PaymentModal";
import { notificationService } from "@/lib/services/notification.service";

const { width } = Dimensions.get("window");

// Status config matching web
const getStatusConfig = (status: string) => {
  switch (status) {
    case "paid":
      return {
        colors: ["#10B981", "#059669"],
        icon: "checkmark-circle" as const,
        label: "Đã thanh toán",
        bgColor: "#D1FAE5",
        textColor: "#059669",
      };
    case "pending":
      return {
        colors: ["#F59E0B", "#D97706"],
        icon: "time" as const,
        label: "Chờ thanh toán",
        bgColor: "#FEF3C7",
        textColor: "#D97706",
      };
    case "overdue":
      return {
        colors: ["#EF4444", "#DC2626"],
        icon: "alert-circle" as const,
        label: "Quá hạn",
        bgColor: "#FEE2E2",
        textColor: "#DC2626",
      };
    case "cancelled":
      return {
        colors: ["#6B7280", "#4B5563"],
        icon: "close-circle" as const,
        label: "Đã hủy",
        bgColor: "#F3F4F6",
        textColor: "#6B7280",
      };
    default:
      return {
        colors: ["#6B7280", "#4B5563"],
        icon: "help-circle" as const,
        label: status,
        bgColor: "#F3F4F6",
        textColor: "#6B7280",
      };
  }
};

// Format currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);
};

// Format date
const formatDate = (dateString?: string) => {
  if (!dateString) return "Không xác định";
  const date = new Date(dateString);
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

// Payment Request Card Component
function PaymentRequestCard({
  request,
  onPay,
}: {
  request: StudentPaymentRequest;
  onPay?: (request: StudentPaymentRequest) => void;
}) {
  const statusConfig = getStatusConfig(request.status);
  const isPending =
    request.status === "pending" || request.status === "overdue";

  return (
    <View style={styles.paymentCard}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <LinearGradient
            colors={statusConfig.colors as [string, string]}
            style={styles.cardIcon}
          >
            <Ionicons name="receipt" size={18} color="#FFFFFF" />
          </LinearGradient>
          <View style={styles.cardTitleInfo}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {request.title}
            </Text>
            <Text style={styles.cardSubtitle}>{request.className}</Text>
          </View>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: statusConfig.bgColor },
          ]}
        >
          <Ionicons
            name={statusConfig.icon}
            size={12}
            color={statusConfig.textColor}
          />
          <Text style={[styles.statusText, { color: statusConfig.textColor }]}>
            {statusConfig.label}
          </Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.amountSection}>
          <Text style={styles.amountLabel}>Số tiền cần thanh toán</Text>
          <Text style={styles.amountValue}>
            {formatCurrency(request.finalAmount)}
          </Text>
          {request.scholarshipPercent > 0 && (
            <View style={styles.discountInfo}>
              <Ionicons name="pricetag" size={12} color="#10B981" />
              <Text style={styles.discountText}>
                Giảm {request.scholarshipPercent}% học bổng
              </Text>
            </View>
          )}
        </View>

        <View style={styles.detailsSection}>
          <View style={styles.detailRow}>
            <Ionicons name="calendar-outline" size={14} color="#6B7280" />
            <Text style={styles.detailLabel}>Hạn nộp:</Text>
            <Text style={styles.detailValue}>
              {formatDate(request.dueDate)}
            </Text>
          </View>
          {request.paidAt && (
            <View style={styles.detailRow}>
              <Ionicons
                name="checkmark-circle-outline"
                size={14}
                color="#10B981"
              />
              <Text style={styles.detailLabel}>Đã thanh toán:</Text>
              <Text style={[styles.detailValue, { color: "#10B981" }]}>
                {formatDate(request.paidAt)}
              </Text>
            </View>
          )}
        </View>
      </View>

      {isPending && onPay && (
        <TouchableOpacity
          style={styles.payButton}
          onPress={() => onPay(request)}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={["#3B82F6", "#2563EB"]}
            style={styles.payButtonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Ionicons name="wallet" size={18} color="#FFFFFF" />
            <Text style={styles.payButtonText}>Thanh toán ngay</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );
}

// Child Section Component (for Parent view)
function ChildPaymentSection({
  childData,
  onPay,
}: {
  childData: ChildPaymentRequests;
  onPay?: (request: StudentPaymentRequest) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const pendingCount = childData.requests.filter(
    (r) => r.status === "pending" || r.status === "overdue"
  ).length;

  return (
    <View style={styles.childSection}>
      <TouchableOpacity
        style={styles.childHeader}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.childInfo}>
          <LinearGradient
            colors={["#F59E0B", "#D97706"]}
            style={styles.childAvatar}
          >
            <Ionicons name="person" size={20} color="#FFFFFF" />
          </LinearGradient>
          <View>
            <Text style={styles.childName}>{childData.studentName}</Text>
            <Text style={styles.childMeta}>
              {childData.requests.length} khoản phí
              {pendingCount > 0 && (
                <Text style={{ color: "#EF4444" }}>
                  {" "}
                  • {pendingCount} chưa thanh toán
                </Text>
              )}
            </Text>
          </View>
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={20}
          color="#6B7280"
        />
      </TouchableOpacity>

      {expanded && (
        <View style={styles.childRequests}>
          {childData.requests.map((request) => (
            <PaymentRequestCard
              key={request._id}
              request={request}
              onPay={onPay}
            />
          ))}
        </View>
      )}
    </View>
  );
}

export default function PaymentsScreen() {
  const { user } = useAuthStore();
  const {
    myRequests,
    childrenRequests,
    isLoading,
    error,
    fetchMyRequests,
    fetchAllMyRequests,
    fetchChildrenRequests,
    clearError,
  } = usePaymentRequestsStore();

  const [activeTab, setActiveTab] = useState<"pending" | "all">("pending");
  const [payModalVisible, setPayModalVisible] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<StudentPaymentRequest | null>(null);

  const isStudent = user?.role === "student";
  const isParent = user?.role === "parent";

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = useCallback(async () => {
    if (!user) return;

    if (isStudent) {
      if (activeTab === "pending") {
        await fetchMyRequests();
      } else {
        await fetchAllMyRequests();
      }
    } else if (isParent) {
      await fetchChildrenRequests();
    }
  }, [user, activeTab, isStudent, isParent]);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const onRefresh = async () => {
    await loadData();
  };

  // Open PaymentModal instead of hardcoded alert
  const handlePay = (request: StudentPaymentRequest) => {
    setSelectedRequest(request);
    setPayModalVisible(true);
  };

  const handlePaymentSuccess = () => {
    setPayModalVisible(false);
    setSelectedRequest(null);
    // Reload data to reflect new payment status
    loadData();

    // Send notification
    if (selectedRequest) {
      notificationService.send({
        title: "Thanh toán thành công",
        body: `Bạn đã thanh toán thành công số tiền ${formatCurrency(selectedRequest.finalAmount)} cho ${selectedRequest.title}`,
        type: "success"
      }).catch(err => console.error("Failed to send payment notification:", err));
    }
  };

  // Calculate summary stats
  const getStudentSummary = () => {
    const pending = myRequests.filter(
      (r) => r.status === "pending" || r.status === "overdue"
    );
    const totalPending = pending.reduce((sum, r) => sum + r.finalAmount, 0);
    const overdue = myRequests.filter((r) => r.status === "overdue").length;

    return { pending: pending.length, totalPending, overdue };
  };

  const getParentSummary = () => {
    const allRequests = childrenRequests.flatMap((c) => c.requests);
    const pending = allRequests.filter(
      (r) => r.status === "pending" || r.status === "overdue"
    );
    const totalPending = pending.reduce((sum, r) => sum + r.finalAmount, 0);
    const overdue = allRequests.filter((r) => r.status === "overdue").length;

    return {
      pending: pending.length,
      totalPending,
      overdue,
      children: childrenRequests.length,
    };
  };

  const summary = isStudent ? getStudentSummary() : getParentSummary();

  // Filter requests for tabs (student only)
  const displayRequests =
    activeTab === "pending"
      ? myRequests.filter(
        (r) => r.status === "pending" || r.status === "overdue"
      )
      : myRequests;

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Summary Section */}
        <LinearGradient
          colors={
            summary.overdue > 0
              ? ["#EF4444", "#DC2626"]
              : summary.pending > 0
                ? ["#F59E0B", "#D97706"]
                : ["#10B981", "#059669"]
          }
          style={styles.summaryCard}
        >
          <View style={styles.summaryContent}>
            <View style={styles.summaryMain}>
              <Text style={styles.summaryLabel}>
                {summary.pending > 0 ? "Tổng cần thanh toán" : "Đã hoàn thành"}
              </Text>
              <Text style={styles.summaryAmount}>
                {formatCurrency(summary.totalPending)}
              </Text>
              <Text style={styles.summaryNote}>
                {summary.pending} khoản chưa thanh toán
                {summary.overdue > 0 && ` • ${summary.overdue} quá hạn`}
              </Text>
            </View>
            <View style={styles.summaryIcon}>
              <Ionicons
                name={summary.pending > 0 ? "wallet" : "checkmark-circle"}
                size={48}
                color="rgba(255,255,255,0.3)"
              />
            </View>
          </View>
        </LinearGradient>

        {/* Tabs for Student */}
        {isStudent && (
          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === "pending" && styles.activeTab]}
              onPress={() => setActiveTab("pending")}
            >
              <Ionicons
                name="time"
                size={16}
                color={activeTab === "pending" ? "#3B82F6" : "#6B7280"}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === "pending" && styles.activeTabText,
                ]}
              >
                Chờ thanh toán
              </Text>
              {summary.pending > 0 && (
                <View
                  style={[
                    styles.tabBadge,
                    activeTab === "pending" && styles.activeTabBadge,
                  ]}
                >
                  <Text
                    style={[
                      styles.tabBadgeText,
                      activeTab === "pending" && styles.activeTabBadgeText,
                    ]}
                  >
                    {summary.pending}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === "all" && styles.activeTab]}
              onPress={() => setActiveTab("all")}
            >
              <Ionicons
                name="list"
                size={16}
                color={activeTab === "all" ? "#3B82F6" : "#6B7280"}
              />
              <Text
                style={[
                  styles.tabText,
                  activeTab === "all" && styles.activeTabText,
                ]}
              >
                Tất cả
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Content */}
        <View style={styles.content}>
          {isStudent ? (
            // Student view
            displayRequests.length === 0 ? (
              <View style={styles.emptyState}>
                <LinearGradient
                  colors={["#F3F4F6", "#E5E7EB"]}
                  style={styles.emptyIcon}
                >
                  <Ionicons name="receipt-outline" size={48} color="#9CA3AF" />
                </LinearGradient>
                <Text style={styles.emptyTitle}>
                  {activeTab === "pending"
                    ? "Không có khoản nào cần thanh toán"
                    : "Chưa có yêu cầu thanh toán"}
                </Text>
                <Text style={styles.emptySubtitle}>
                  Các yêu cầu thanh toán sẽ hiển thị tại đây
                </Text>
              </View>
            ) : (
              displayRequests.map((request) => (
                <PaymentRequestCard
                  key={request._id}
                  request={request}
                  onPay={handlePay}
                />
              ))
            )
          ) : isParent ? (
            // Parent view
            childrenRequests.length === 0 ? (
              <View style={styles.emptyState}>
                <LinearGradient
                  colors={["#F3F4F6", "#E5E7EB"]}
                  style={styles.emptyIcon}
                >
                  <Ionicons name="people-outline" size={48} color="#9CA3AF" />
                </LinearGradient>
                <Text style={styles.emptyTitle}>Chưa có thông tin</Text>
                <Text style={styles.emptySubtitle}>
                  Thông tin thanh toán của con sẽ hiển thị tại đây
                </Text>
              </View>
            ) : (
              childrenRequests.map((child) => (
                <ChildPaymentSection
                  key={child.studentId}
                  childData={child}
                  onPay={handlePay}
                />
              ))
            )
          ) : (
            // Other roles (teacher, admin) - show message
            <View style={styles.emptyState}>
              <LinearGradient
                colors={["#F3F4F6", "#E5E7EB"]}
                style={styles.emptyIcon}
              >
                <Ionicons
                  name="information-circle-outline"
                  size={48}
                  color="#9CA3AF"
                />
              </LinearGradient>
              <Text style={styles.emptyTitle}>Không khả dụng</Text>
              <Text style={styles.emptySubtitle}>
                Tính năng này dành cho học sinh và phụ huynh
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* PayOS Payment Modal */}
      <PaymentModal
        visible={payModalVisible}
        onClose={() => {
          setPayModalVisible(false);
          setSelectedRequest(null);
        }}
        request={selectedRequest}
        onSuccess={handlePaymentSuccess}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  // Summary Card
  summaryCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 20,
  },
  summaryContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  summaryMain: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    marginBottom: 4,
  },
  summaryAmount: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  summaryNote: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
  },
  summaryIcon: {
    marginLeft: 16,
  },
  // Tabs
  tabsContainer: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 6,
  },
  activeTab: {
    backgroundColor: "#EFF6FF",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
  },
  activeTabText: {
    color: "#3B82F6",
  },
  tabBadge: {
    backgroundColor: "#E5E7EB",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: "center",
  },
  activeTabBadge: {
    backgroundColor: "#3B82F6",
  },
  tabBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6B7280",
  },
  activeTabBadgeText: {
    color: "#FFFFFF",
  },
  // Content
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  // Payment Card
  paymentCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  cardTitleInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 13,
    color: "#6B7280",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  // Card Body
  cardBody: {
    padding: 16,
  },
  amountSection: {
    marginBottom: 12,
  },
  amountLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
  },
  discountInfo: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 4,
  },
  discountText: {
    fontSize: 12,
    color: "#10B981",
  },
  detailsSection: {
    gap: 8,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  detailLabel: {
    fontSize: 13,
    color: "#6B7280",
  },
  detailValue: {
    fontSize: 13,
    color: "#111827",
    fontWeight: "500",
  },
  // Pay Button
  payButton: {
    marginTop: 0,
  },
  payButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    gap: 8,
  },
  payButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  // Child Section (Parent)
  childSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    overflow: "hidden",
  },
  childHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  childInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  childAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  childName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  childMeta: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  childRequests: {
    padding: 12,
  },
  // Empty State
  emptyState: {
    alignItems: "center",
    paddingVertical: 48,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
  },
});
