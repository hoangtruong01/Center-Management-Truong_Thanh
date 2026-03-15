import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import {
  useIncidentsStore,
  type Incident as StoreIncident,
  type IncidentStatus,
} from "@/lib/stores";
import { notificationService } from "@/lib/services/notification.service";

type IncidentType =
  | "bug_error"
  | "ui_issue"
  | "feature_request"
  | "data_issue"
  | "other";

const statusConfig: Record<
  string,
  { label: string; color: string; bg: string; icon: string }
> = {
  pending: {
    label: "Chờ xử lý",
    color: "#F59E0B",
    bg: "#FEF3C7",
    icon: "time",
  },
  in_progress: {
    label: "Đang xử lý",
    color: "#3B82F6",
    bg: "#DBEAFE",
    icon: "construct",
  },
  resolved: {
    label: "Đã giải quyết",
    color: "#10B981",
    bg: "#D1FAE5",
    icon: "checkmark-circle",
  },
  rejected: {
    label: "Đã từ chối",
    color: "#6B7280",
    bg: "#F3F4F6",
    icon: "close-circle",
  },
};

const typeConfig: Record<
  string,
  { label: string; icon: string; color: string }
> = {
  bug_error: { label: "Lỗi hệ thống", icon: "bug", color: "#EF4444" },
  ui_issue: { label: "Lỗi giao diện", icon: "desktop", color: "#8B5CF6" },
  feature_request: {
    label: "Yêu cầu tính năng",
    icon: "bulb",
    color: "#10B981",
  },
  data_issue: { label: "Lỗi dữ liệu", icon: "server", color: "#F59E0B" },
  performance_issue: {
    label: "Hiệu suất chậm",
    icon: "speedometer",
    color: "#3B82F6",
  },
  login_issue: { label: "Lỗi đăng nhập", icon: "log-in", color: "#EC4899" },
  payment_issue: { label: "Vấn đề thanh toán", icon: "card", color: "#22C55E" },
  other: { label: "Khác", icon: "help-circle", color: "#6B7280" },
};

const priorityConfig: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  low: { label: "Thấp", color: "#10B981", bg: "#D1FAE5" },
  medium: { label: "Trung bình", color: "#F59E0B", bg: "#FEF3C7" },
  high: { label: "Cao", color: "#EF4444", bg: "#FEE2E2" },
  critical: { label: "Nghiêm trọng", color: "#DC2626", bg: "#FEE2E2" },
};

const statusTabs = [
  { key: "all", label: "Tất cả" },
  { key: "pending", label: "Chờ xử lý" },
  { key: "in_progress", label: "Đang xử lý" },
  { key: "resolved", label: "Đã xử lý" },
];

export default function AdminIncidentsScreen() {
  const { incidents, fetchIncidents, updateIncident, isLoading } =
    useIncidentsStore();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedIncident, setSelectedIncident] =
    useState<StoreIncident | null>(null);
  const [isDetailVisible, setIsDetailVisible] = useState(false);
  const [resolution, setResolution] = useState("");

  useEffect(() => {
    fetchIncidents();
  }, []);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await fetchIncidents();
    setIsRefreshing(false);
  };

  const filteredIncidents = incidents.filter((incident) =>
    selectedStatus === "all" ? true : incident.status === selectedStatus,
  );

  // Calculate stats
  const stats = {
    total: incidents.length,
    pending: incidents.filter((i) => i.status === "pending").length,
    inProgress: incidents.filter((i) => i.status === "in_progress").length,
    resolved: incidents.filter(
      (i) => i.status === "resolved" || i.status === "rejected",
    ).length,
  };

  const handleUpdateStatus = async (
    incident: StoreIncident,
    newStatus: IncidentStatus,
  ) => {
    try {
      await updateIncident(incident._id, { status: newStatus });

      // Gửi thông báo cho người báo cáo
      const reporterId =
        typeof incident.reporterId === "object"
          ? incident.reporterId._id
          : incident.reporterId;

      if (reporterId) {
        let title = "[Phản hồi sự cố]";
        let type: "info" | "success" | "error" | "warning" = "info";
        let body = "";

        switch (newStatus) {
          case "in_progress":
            title = "[Phản hồi sự cố] Đang xử lý";
            body = `Báo cáo sự cố của bạn đang được chúng tôi xử lý.`;
            type = "info";
            break;
          case "rejected":
            title = "[Phản hồi sự cố] Từ chối";
            body = `Rất tiếc, báo cáo sự cố của bạn đã bị từ chối.`;
            type = "error";
            break;
        }

        if (body) {
          await notificationService
            .send({
              userId: reporterId,
              title,
              body,
              type,
            })
            .catch((err) =>
              console.error("Lỗi gửi thông báo cho người báo cáo:", err),
            );
        }
      }

      Alert.alert("Thành công", "Đã cập nhật trạng thái sự cố");
      setIsDetailVisible(false);
    } catch (error) {
      Alert.alert("Lỗi", "Không thể cập nhật trạng thái");
    }
  };

  const handleResolve = async () => {
    if (!selectedIncident) return;

    if (!resolution.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập nội dung giải quyết");
      return;
    }

    try {
      await updateIncident(selectedIncident._id, {
        status: "resolved",
        adminNote: resolution,
      });

      // Gửi thông báo cho người báo cáo
      const reporterId =
        typeof selectedIncident.reporterId === "object"
          ? selectedIncident.reporterId._id
          : selectedIncident.reporterId;

      if (reporterId) {
        await notificationService
          .send({
            userId: reporterId,
            title: "[Phản hồi sự cố] Đã giải quyết",
            body: `Sự cố đã được giải quyết: ${resolution}`,
            type: "success",
          })
          .catch((err) =>
            console.error("Lỗi gửi thông báo giải quyết sự cố:", err),
          );
      }

      Alert.alert("Thành công", "Đã giải quyết sự cố");
      setIsDetailVisible(false);
      setResolution("");
    } catch (error) {
      Alert.alert("Lỗi", "Không thể cập nhật sự cố");
    }
  };

  const openDetail = (incident: StoreIncident) => {
    setSelectedIncident(incident);
    setResolution(incident.adminNote || "");
    setIsDetailVisible(true);
  };

  // Helper to get reporter info
  const getReporterName = (incident: StoreIncident): string => {
    if (typeof incident.reporterId === "object" && incident.reporterId?.name) {
      return incident.reporterId.name;
    }
    return incident.reporterName || "Không xác định";
  };

  const getReporterRole = (incident: StoreIncident): string => {
    if (typeof incident.reporterId === "object" && incident.reporterId?.role) {
      return incident.reporterId.role;
    }
    return incident.reporterRole || "user";
  };

  const renderIncidentCard = ({ item: incident }: { item: StoreIncident }) => {
    const status = statusConfig[incident.status] || statusConfig.pending;
    const type = typeConfig[incident.type] || typeConfig.other;
    
    return (
      <TouchableOpacity
        style={styles.incidentCard}
        onPress={() => openDetail(incident)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View
            style={[styles.typeIcon, { backgroundColor: `${type.color}20` }]}
          >
            <Ionicons name={type.icon as any} size={20} color={type.color} />
          </View>
          <View style={styles.cardHeaderInfo}>
            <Text style={styles.incidentTitle} numberOfLines={1}>
              {type.label}
            </Text>
            <Text style={styles.incidentType}>{incident.platform}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Ionicons
              name={status.icon as any}
              size={12}
              color={status.color}
            />
            <Text style={[styles.statusText, { color: status.color }]}>
              {status.label}
            </Text>
          </View>
        </View>

        {incident.description && (
          <Text style={styles.incidentDescription} numberOfLines={2}>
            {incident.description}
          </Text>
        )}

        <View style={styles.cardFooter}>
          <View style={styles.footerLeft}>
            <View style={styles.reporterInfo}>
              <Ionicons name="person-outline" size={14} color="#6B7280" />
              <Text style={styles.reporterText}>
                {getReporterName(incident)} ({getReporterRole(incident)})
              </Text>
            </View>
            {incident.createdAt && (
              <Text style={styles.dateText}>
                {new Date(incident.createdAt).toLocaleDateString("vi-VN")}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      {/* Header */}
      <LinearGradient colors={["#F97316", "#EA580C"]} style={styles.header}>
        <View style={styles.headerContent}>
          <Ionicons name="bug" size={28} color="#FFFFFF" />
          <View style={styles.headerInfo}>
            <Text style={styles.headerValue}>{stats.total}</Text>
            <Text style={styles.headerSubtitle}>
              Sự cố • {stats.pending} chờ xử lý
            </Text>
          </View>
        </View>
      </LinearGradient>

      <View style={{ backgroundColor: "#F3F4F6" }}>
        {/* Stats Cards */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.statsScrollView}
          contentContainerStyle={[
            styles.statsContainer,
            { alignItems: "center" } 
          ]}
        >
          <View style={[styles.statCard, { borderColor: "#6366F1" }]}>
            <Text style={[styles.statValue, { color: "#6366F1" }]}>
              {stats.total}
            </Text>
            <Text style={styles.statLabel}>Tổng số</Text>
          </View>
          <View style={[styles.statCard, { borderColor: "#F59E0B" }]}>
            <Text style={[styles.statValue, { color: "#F59E0B" }]}>
              {stats.pending}
            </Text>
            <Text numberOfLines={1} style={styles.statLabel}>Chờ xử lý</Text>
          </View>
          <View style={[styles.statCard, { borderColor: "#3B82F6" }]}>
            <Text style={[styles.statValue, { color: "#3B82F6" }]}>
              {stats.inProgress}
            </Text>
            <Text numberOfLines={1} style={styles.statLabel}>Đang xử lý</Text>
          </View>
          <View style={[styles.statCard, { borderColor: "#10B981" }]}>
            <Text style={[styles.statValue, { color: "#10B981" }]}>
              {stats.resolved}
            </Text>
            <Text numberOfLines={1} style={styles.statLabel}>Đã xử lý</Text>
          </View>
        </ScrollView>

        {/* Status Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsScrollView}
          contentContainerStyle={[
            styles.statsContainer,
            { alignItems: "center" }
          ]}
        >
          {statusTabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.statusTab,
                selectedStatus === tab.key && styles.statusTabActive,
              ]}
              onPress={() => setSelectedStatus(tab.key)}
            >
              <Text
                style={[
                  styles.statusTabText,
                  selectedStatus === tab.key && styles.statusTabTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Incidents List */}
      {isLoading && !isRefreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F97316" />
          <Text style={styles.loadingText}>Đang tải...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredIncidents}
          renderItem={renderIncidentCard}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Ionicons
                name="checkmark-circle-outline"
                size={48}
                color="#10B981"
              />
              <Text style={styles.emptyText}>Không có sự cố nào cần xử lý</Text>
            </View>
          )}
        />
      )}

      {/* Detail Modal */}
      <Modal
        visible={isDetailVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsDetailVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setIsDetailVisible(false)}>
              <Ionicons name="close" size={24} color="#1F2937" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Chi tiết sự cố</Text>
            <View style={{ width: 24 }} />
          </View>

          {selectedIncident && (
            <ScrollView style={styles.modalContent}>
              {/* Incident Info */}
              <View style={styles.incidentHeader}>
                <View
                  style={[
                    styles.typeIconLarge,
                    {
                      backgroundColor: `${
                        typeConfig[selectedIncident.type]?.color || "#6B7280"
                      }20`,
                    },
                  ]}
                >
                  <Ionicons
                    name={
                      (typeConfig[selectedIncident.type]?.icon as any) ||
                      "help-circle"
                    }
                    size={32}
                    color={
                      typeConfig[selectedIncident.type]?.color || "#6B7280"
                    }
                  />
                </View>
                <Text style={styles.modalIncidentTitle}>
                  {typeConfig[selectedIncident.type]?.label || "Sự cố"}
                </Text>
                <View
                  style={[
                    styles.statusBadgeLarge,
                    {
                      backgroundColor:
                        statusConfig[selectedIncident.status]?.bg || "#F3F4F6",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusTextLarge,
                      {
                        color:
                          statusConfig[selectedIncident.status]?.color ||
                          "#6B7280",
                      },
                    ]}
                  >
                    {statusConfig[selectedIncident.status]?.label ||
                      "Không xác định"}
                  </Text>
                </View>
              </View>

              {/* Description */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Mô tả</Text>
                <Text style={styles.descriptionText}>
                  {selectedIncident.description || "Không có mô tả"}
                </Text>
              </View>

              {/* Reporter Info */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Người báo cáo</Text>
                <View style={styles.reporterCard}>
                  <View style={styles.reporterAvatar}>
                    <Text style={styles.reporterAvatarText}>
                      {getReporterName(selectedIncident).charAt(0) || "?"}
                    </Text>
                  </View>
                  <View style={styles.reporterDetails}>
                    <Text style={styles.reporterName}>
                      {getReporterName(selectedIncident)}
                    </Text>
                    <Text style={styles.reporterEmail}>
                      {selectedIncident.reporterEmail || ""}
                    </Text>
                    <Text style={styles.reporterRole}>
                      {getReporterRole(selectedIncident)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Resolution Input */}
              {selectedIncident.status !== "resolved" &&
                selectedIncident.status !== "rejected" && (
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Ghi chú xử lý</Text>
                    <TextInput
                      style={styles.resolutionInput}
                      value={resolution}
                      onChangeText={setResolution}
                      placeholder="Nhập nội dung giải quyết..."
                      placeholderTextColor="#9CA3AF"
                      multiline
                      numberOfLines={4}
                    />
                  </View>
                )}

              {/* Show resolution if exists */}
              {selectedIncident.adminNote && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Ghi chú admin</Text>
                  <View style={styles.resolutionCard}>
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color="#10B981"
                    />
                    <Text style={styles.resolutionText}>
                      {selectedIncident.adminNote}
                    </Text>
                  </View>
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.actionButtons}>
                {selectedIncident.status === "pending" && (
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      { backgroundColor: "#DBEAFE" },
                    ]}
                    onPress={() =>
                      handleUpdateStatus(selectedIncident, "in_progress")
                    }
                  >
                    <Ionicons name="construct" size={20} color="#3B82F6" />
                    <Text
                      style={[styles.actionButtonText, { color: "#3B82F6" }]}
                    >
                      Bắt đầu xử lý
                    </Text>
                  </TouchableOpacity>
                )}

                {selectedIncident.status === "in_progress" && (
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      { backgroundColor: "#D1FAE5" },
                    ]}
                    onPress={handleResolve}
                  >
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color="#059669"
                    />
                    <Text
                      style={[styles.actionButtonText, { color: "#059669" }]}
                    >
                      Đánh dấu đã xử lý
                    </Text>
                  </TouchableOpacity>
                )}

                {selectedIncident.status === "in_progress" && (
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      { backgroundColor: "#FEE2E2" },
                    ]}
                    onPress={() =>
                      handleUpdateStatus(selectedIncident, "rejected")
                    }
                  >
                    <Ionicons name="close-circle" size={20} color="#DC2626" />
                    <Text
                      style={[styles.actionButtonText, { color: "#DC2626" }]}
                    >
                      Từ chối
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  // Header
  header: {
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerInfo: {
    flex: 1,
  },
  headerValue: {
    fontSize: 28,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
  },
  // Stats
  statsScrollView: {
    marginTop: 16,
  },
  statsContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  // statCard: {
  //   backgroundColor: "#FFFFFF",
  //   borderRadius: 14,
  //   padding: 14,
  //   minWidth: 75,
  //   alignItems: "center",
  //   borderWidth: 2,
  //   shadowColor: "#000",
  //   shadowOffset: { width: 0, height: 1 },
  //   shadowOpacity: 0.05,
  //   shadowRadius: 4,
  //   elevation: 2,
  // },
  statCard: {
  height: 40,            
  flexDirection: "row",
  alignItems: "center",
  gap: 6,
  paddingHorizontal: 12,
  borderRadius: 14,
  backgroundColor: "#fff",
  borderWidth: 2,
},
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 20,
  },
  statLabel: {
    fontSize: 12,
    color: "#6B7280",
    // marginTop: 4,
    // textAlign: "center",
  },
  // Tabs
  tabsScrollView: {
    marginVertical: 12,
  },
  tabsContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  // statusTab: {
  //   paddingHorizontal: 16,
  //   paddingVertical: 8,
  //   borderRadius: 20,
  //   backgroundColor: "#FFFFFF",
  //   marginRight: 8,
  // },
  statusTab: {
  height: 42  ,              
  paddingHorizontal: 16,
  justifyContent: "center",
  borderRadius: 14,
  backgroundColor: "#FFFFFF",
},
  statusTabActive: {
    backgroundColor: "#F97316",
  },
  statusTabText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4B5563",
  },
  statusTabTextActive: {
    color: "#FFFFFF",
  },
  // List
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  incidentCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  cardHeaderInfo: {
    flex: 1,
  },
  incidentTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1F2937",
  },
  incidentType: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  incidentDescription: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 12,
    lineHeight: 20,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  footerLeft: {
    flex: 1,
  },
  reporterInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  reporterText: {
    fontSize: 12,
    color: "#6B7280",
  },
  dateText: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 4,
  },
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: "600",
  },
  // Loading & Empty
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6B7280",
  },
  emptyContainer: {
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 40,
  },
  emptyText: {
    fontSize: 14,
    color: "#10B981",
    marginTop: 12,
    fontWeight: "600",
  },
  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1F2937",
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  incidentHeader: {
    alignItems: "center",
    marginBottom: 24,
  },
  typeIconLarge: {
    width: 64,
    height: 64,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  modalIncidentTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
    textAlign: "center",
    marginBottom: 12,
  },
  statusBadgeLarge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusTextLarge: {
    fontSize: 14,
    fontWeight: "600",
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 15,
    color: "#4B5563",
    lineHeight: 22,
    backgroundColor: "#F9FAFB",
    padding: 14,
    borderRadius: 12,
  },
  reporterCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    padding: 14,
    borderRadius: 12,
  },
  reporterAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#E0E7FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  reporterAvatarText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#6366F1",
  },
  reporterDetails: {
    flex: 1,
  },
  reporterName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1F2937",
  },
  reporterEmail: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  reporterRole: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
    textTransform: "capitalize",
  },
  resolutionInput: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: "#1F2937",
    height: 100,
    textAlignVertical: "top",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  resolutionCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#D1FAE5",
    padding: 14,
    borderRadius: 12,
    gap: 10,
  },
  resolutionText: {
    flex: 1,
    fontSize: 14,
    color: "#065F46",
    lineHeight: 20,
  },
  actionButtons: {
    gap: 12,
    marginTop: 8,
    marginBottom: 32,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
