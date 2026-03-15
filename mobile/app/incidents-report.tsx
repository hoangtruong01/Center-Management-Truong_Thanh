import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import {
  useIncidentsStore,
  getIncidentTypeLabel,
  getIncidentStatusLabel,
  getIncidentStatusColor,
} from "@/lib/stores";
import type { IncidentType, IncidentStatus, Incident } from "@/lib/stores";
import { notificationService } from "@/lib/services/notification.service";

const safeGoBack = () => {
  router.replace("/(tabs)");
};

// ============ HELPERS ============

const incidentTypeOptions: {
  value: IncidentType;
  label: string;
  icon: string;
}[] = [
    { value: "bug_error", label: "Lỗi hệ thống", icon: "bug" },
    { value: "ui_issue", label: "Vấn đề giao diện", icon: "phone-portrait" },
    { value: "performance_issue", label: "Hiệu suất chậm", icon: "speedometer" },
    { value: "login_issue", label: "Lỗi đăng nhập", icon: "log-in" },
    { value: "data_issue", label: "Vấn đề dữ liệu", icon: "server" },
    { value: "payment_issue", label: "Vấn đề thanh toán", icon: "card" },
    { value: "feature_request", label: "Yêu cầu tính năng", icon: "bulb" },
    { value: "other", label: "Khác", icon: "ellipsis-horizontal" },
  ];

const getIncidentTypeIcon = (type: IncidentType): string => {
  const option = incidentTypeOptions.find((o) => o.value === type);
  return option?.icon || "alert-circle";
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// ============ REPORT INCIDENT MODAL ============

function ReportIncidentModal({
  visible,
  onClose,
  onSubmit,
  isLoading,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (type: IncidentType, description: string) => void;
  isLoading: boolean;
}) {
  const [selectedType, setSelectedType] = useState<IncidentType | null>(null);
  const [description, setDescription] = useState("");
  const [step, setStep] = useState<"type" | "description">("type");

  const resetForm = () => {
    setSelectedType(null);
    setDescription("");
    setStep("type");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = () => {
    if (selectedType && description.trim().length >= 10) {
      onSubmit(selectedType, description.trim());
      resetForm();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.modalContainer}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          {/* Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Báo cáo sự cố</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView
            style={styles.modalContent}
            contentContainerStyle={styles.modalContentInner}
            showsVerticalScrollIndicator={false}
          >
            {step === "type" ? (
              <>
                <Text style={styles.stepTitle}>Chọn loại sự cố</Text>
                <Text style={styles.stepSubtitle}>
                  Chọn một trong các loại sự cố dưới đây
                </Text>

                <View style={styles.typeGrid}>
                  {incidentTypeOptions.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.typeOption,
                        selectedType === option.value &&
                        styles.typeOptionSelected,
                      ]}
                      onPress={() => setSelectedType(option.value)}
                      activeOpacity={0.7}
                    >
                      <LinearGradient
                        colors={
                          selectedType === option.value
                            ? ["#3B82F6", "#2563EB"]
                            : ["#F3F4F6", "#E5E7EB"]
                        }
                        style={styles.typeOptionIcon}
                      >
                        <Ionicons
                          name={option.icon as any}
                          size={24}
                          color={
                            selectedType === option.value
                              ? "#FFFFFF"
                              : "#6B7280"
                          }
                        />
                      </LinearGradient>
                      <Text
                        style={[
                          styles.typeOptionLabel,
                          selectedType === option.value &&
                          styles.typeOptionLabelSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TouchableOpacity
                  style={[
                    styles.nextButton,
                    !selectedType && styles.nextButtonDisabled,
                  ]}
                  onPress={() => setStep("description")}
                  disabled={!selectedType}
                  activeOpacity={0.8}
                >
                  <Text style={styles.nextButtonText}>Tiếp tục</Text>
                  <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.backStepButton}
                  onPress={() => setStep("type")}
                >
                  <Ionicons name="arrow-back" size={20} color="#3B82F6" />
                  <Text style={styles.backStepButtonText}>Quay lại</Text>
                </TouchableOpacity>

                <View style={styles.selectedTypePreview}>
                  <LinearGradient
                    colors={["#3B82F6", "#2563EB"]}
                    style={styles.selectedTypeIconBox}
                  >
                    <Ionicons
                      name={getIncidentTypeIcon(selectedType!) as any}
                      size={20}
                      color="#FFFFFF"
                    />
                  </LinearGradient>
                  <Text style={styles.selectedTypeLabel}>
                    {getIncidentTypeLabel(selectedType!)}
                  </Text>
                </View>

                <Text style={styles.stepTitle}>Mô tả chi tiết</Text>
                <Text style={styles.stepSubtitle}>
                  Mô tả sự cố bạn gặp phải (ít nhất 10 ký tự)
                </Text>

                <TextInput
                  style={styles.descriptionInput}
                  placeholder="Vui lòng mô tả chi tiết sự cố bạn gặp phải..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                  value={description}
                  onChangeText={setDescription}
                  maxLength={1000}
                />

                <Text style={styles.charCount}>
                  {description.length}/1000 ký tự
                </Text>

                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    (description.trim().length < 10 || isLoading) &&
                    styles.submitButtonDisabled,
                  ]}
                  onPress={handleSubmit}
                  disabled={description.trim().length < 10 || isLoading}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={
                      description.trim().length < 10 || isLoading
                        ? ["#D1D5DB", "#9CA3AF"]
                        : ["#10B981", "#059669"]
                    }
                    style={styles.submitButtonGradient}
                  >
                    {isLoading ? (
                      <Text style={styles.submitButtonText}>Đang gửi...</Text>
                    ) : (
                      <>
                        <Ionicons name="send" size={20} color="#FFFFFF" />
                        <Text style={styles.submitButtonText}>Gửi báo cáo</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

// ============ INCIDENT DETAIL MODAL ============

function IncidentDetailModal({
  incident,
  visible,
  onClose,
}: {
  incident: Incident | null;
  visible: boolean;
  onClose: () => void;
}) {
  if (!incident) return null;

  const statusColors = getIncidentStatusColor(incident.status);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color="#6B7280" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Chi tiết sự cố</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.modalContent}
          contentContainerStyle={styles.modalContentInner}
          showsVerticalScrollIndicator={false}
        >
          {/* Status Badge */}
          <View style={styles.detailStatusSection}>
            <View
              style={[
                styles.detailStatusBadge,
                { backgroundColor: statusColors.bg },
              ]}
            >
              <Ionicons name="flag" size={16} color={statusColors.text} />
              <Text
                style={[styles.detailStatusText, { color: statusColors.text }]}
              >
                {getIncidentStatusLabel(incident.status)}
              </Text>
            </View>
          </View>

          {/* Type & Date */}
          <View style={styles.detailInfoCard}>
            <View style={styles.detailInfoRow}>
              <View style={styles.detailInfoIcon}>
                <Ionicons
                  name={getIncidentTypeIcon(incident.type) as any}
                  size={20}
                  color="#3B82F6"
                />
              </View>
              <View style={styles.detailInfoContent}>
                <Text style={styles.detailInfoLabel}>Loại sự cố</Text>
                <Text style={styles.detailInfoValue}>
                  {getIncidentTypeLabel(incident.type)}
                </Text>
              </View>
            </View>

            <View style={styles.detailDivider} />

            <View style={styles.detailInfoRow}>
              <View style={styles.detailInfoIcon}>
                <Ionicons name="calendar" size={20} color="#10B981" />
              </View>
              <View style={styles.detailInfoContent}>
                <Text style={styles.detailInfoLabel}>Thời gian báo cáo</Text>
                <Text style={styles.detailInfoValue}>
                  {formatDate(incident.createdAt)}
                </Text>
              </View>
            </View>

            <View style={styles.detailDivider} />

            <View style={styles.detailInfoRow}>
              <View style={styles.detailInfoIcon}>
                <Ionicons
                  name={
                    incident.platform === "mobile"
                      ? "phone-portrait"
                      : "desktop"
                  }
                  size={20}
                  color="#F59E0B"
                />
              </View>
              <View style={styles.detailInfoContent}>
                <Text style={styles.detailInfoLabel}>Nền tảng</Text>
                <Text style={styles.detailInfoValue}>
                  {incident.platform === "mobile" ? "Di động" : "Web"}
                </Text>
              </View>
            </View>
          </View>

          {/* Description */}
          <View style={styles.detailSection}>
            <Text style={styles.detailSectionTitle}>Mô tả sự cố</Text>
            <View style={styles.detailDescriptionCard}>
              <Text style={styles.detailDescription}>
                {incident.description}
              </Text>
            </View>
          </View>

          {/* Admin Note */}
          {incident.adminNote && (
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>
                Phản hồi từ quản trị
              </Text>
              <View style={styles.adminNoteCard}>
                <Ionicons name="chatbubble" size={16} color="#3B82F6" />
                <Text style={styles.adminNoteContent}>
                  {incident.adminNote}
                </Text>
              </View>
            </View>
          )}

          {/* Resolved info */}
          {incident.resolvedAt && (
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>
                Thông tin giải quyết
              </Text>
              <View style={styles.resolvedCard}>
                <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                <View style={styles.resolvedContent}>
                  <Text style={styles.resolvedText}>
                    Đã giải quyết vào {formatDate(incident.resolvedAt)}
                  </Text>
                  {incident.resolvedBy && (
                    <Text style={styles.resolvedBy}>
                      bởi {incident.resolvedBy.name}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ============ MAIN SCREEN ============

export default function IncidentsReportScreen() {
  const {
    myIncidents,
    selectedIncident,
    isLoading,
    fetchMyIncidents,
    createIncident,
    setSelectedIncident,
  } = useIncidentsStore();

  const [showReportModal, setShowReportModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | IncidentStatus>(
    "all",
  );

  useEffect(() => {
    fetchMyIncidents();
  }, []);

  const handleReportSubmit = async (
    type: IncidentType,
    description: string,
  ) => {
    try {
      await createIncident({ type, description, platform: "mobile" });

      // Notify admin
      try {
        await notificationService.notifyAdmin({
          title: `Sự cố mới: ${getIncidentTypeLabel(type)}`,
          body: `Có báo cáo sự cố mới từ di động: ${description.substring(0, 50)}${description.length > 50 ? "..." : ""}`,
          type: "warning"
        });
      } catch (notifyErr) {
        console.error("Failed to notify admin about incident:", notifyErr);
      }

      setShowReportModal(false);
      Alert.alert(
        "Thành công",
        "Báo cáo sự cố của bạn đã được gửi. Chúng tôi sẽ xem xét và phản hồi sớm nhất.",
      );
    } catch (err: any) {
      Alert.alert(
        "Lỗi",
        err.message || "Không thể gửi báo cáo. Vui lòng thử lại.",
      );
    }
  };

  const handleIncidentPress = (incident: Incident) => {
    setSelectedIncident(incident);
    setShowDetailModal(true);
  };

  const filteredIncidents =
    activeFilter === "all"
      ? myIncidents
      : myIncidents.filter((i) => i.status === activeFilter);

  const stats = {
    total: myIncidents.length,
    pending: myIncidents.filter((i) => i.status === "pending").length,
    inProgress: myIncidents.filter((i) => i.status === "in_progress").length,
    resolved: myIncidents.filter((i) => i.status === "resolved").length,
  };

  const filters = [
    { key: "all" as const, label: "Tất cả", count: stats.total },
    { key: "pending" as const, label: "Chờ xử lý", count: stats.pending },
    {
      key: "in_progress" as const,
      label: "Đang xử lý",
      count: stats.inProgress,
    },
    {
      key: "resolved" as const,
      label: "Đã giải quyết",
      count: stats.resolved,
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => safeGoBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Báo cáo sự cố</Text>
        <TouchableOpacity
          onPress={() => setShowReportModal(true)}
          style={styles.addBtn}
        >
          <Ionicons name="add-circle" size={28} color="#8B5CF6" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={fetchMyIncidents} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Summary */}
        <LinearGradient
          colors={["#8B5CF6", "#7C3AED"]}
          style={styles.summaryCard}
        >
          <View style={styles.summaryContent}>
            <View style={styles.summaryMain}>
              <Text style={styles.summaryLabel}>Sự cố của tôi</Text>
              <Text style={styles.summaryTitle}>
                {stats.pending > 0
                  ? `${stats.pending} sự cố đang chờ xử lý`
                  : "Không có sự cố nào chờ xử lý"}
              </Text>
            </View>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.total}</Text>
              <Text style={styles.statLabel}>Tổng số</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.inProgress}</Text>
              <Text style={styles.statLabel}>Đang xử lý</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.resolved}</Text>
              <Text style={styles.statLabel}>Đã xong</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Filter Tabs */}
        <View style={styles.filterContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            {filters.map((filter) => (
              <TouchableOpacity
                key={filter.key}
                style={[
                  styles.filterTab,
                  activeFilter === filter.key && styles.filterTabActive,
                ]}
                onPress={() => setActiveFilter(filter.key)}
              >
                <Text
                  style={[
                    styles.filterText,
                    activeFilter === filter.key && styles.filterTextActive,
                  ]}
                >
                  {filter.label}
                </Text>
                <View
                  style={[
                    styles.filterBadge,
                    activeFilter === filter.key && styles.filterBadgeActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterBadgeText,
                      activeFilter === filter.key &&
                      styles.filterBadgeTextActive,
                    ]}
                  >
                    {filter.count}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* List */}
        <View style={styles.listContent}>
          {filteredIncidents.length === 0 ? (
            <View style={styles.emptyState}>
              <LinearGradient
                colors={["#F3F4F6", "#E5E7EB"]}
                style={styles.emptyIcon}
              >
                <Ionicons name="checkmark-circle" size={48} color="#10B981" />
              </LinearGradient>
              <Text style={styles.emptyStateTitle}>
                {activeFilter === "all"
                  ? "Chưa có báo cáo sự cố nào"
                  : `Không có sự cố ${filters
                    .find((f) => f.key === activeFilter)
                    ?.label.toLowerCase()}`}
              </Text>
              <Text style={styles.emptyStateSubtitle}>
                Nếu gặp vấn đề, hãy nhấn nút + để báo cáo
              </Text>
            </View>
          ) : (
            filteredIncidents.map((incident) => {
              const statusColors = getIncidentStatusColor(incident.status);
              return (
                <TouchableOpacity
                  key={incident._id}
                  style={styles.incidentCard}
                  onPress={() => handleIncidentPress(incident)}
                  activeOpacity={0.7}
                >
                  <View style={styles.incidentCardHeader}>
                    <View style={styles.incidentCardTitleRow}>
                      <View
                        style={[
                          styles.incidentTypeIcon,
                          { backgroundColor: statusColors.bg },
                        ]}
                      >
                        <Ionicons
                          name={getIncidentTypeIcon(incident.type) as any}
                          size={18}
                          color={statusColors.text}
                        />
                      </View>
                      <View style={styles.incidentCardTitleInfo}>
                        <Text style={styles.incidentCardTitle}>
                          {getIncidentTypeLabel(incident.type)}
                        </Text>
                        <Text style={styles.incidentCardDate}>
                          {formatDate(incident.createdAt)}
                        </Text>
                      </View>
                    </View>
                    <View
                      style={[
                        styles.incidentStatusBadge,
                        { backgroundColor: statusColors.bg },
                      ]}
                    >
                      <Text
                        style={[
                          styles.incidentStatusText,
                          { color: statusColors.text },
                        ]}
                      >
                        {getIncidentStatusLabel(incident.status)}
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={styles.incidentCardDescription}
                    numberOfLines={2}
                  >
                    {incident.description}
                  </Text>
                  {incident.adminNote && (
                    <View style={styles.incidentAdminNote}>
                      <Ionicons name="chatbubble" size={12} color="#3B82F6" />
                      <Text
                        style={styles.incidentAdminNoteText}
                        numberOfLines={1}
                      >
                        Phản hồi: {incident.adminNote}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowReportModal(true)}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={["#8B5CF6", "#7C3AED"]}
          style={styles.fabGradient}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </LinearGradient>
      </TouchableOpacity>

      {/* Report Modal */}
      <ReportIncidentModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        onSubmit={handleReportSubmit}
        isLoading={isLoading}
      />

      {/* Detail Modal */}
      <IncidentDetailModal
        incident={selectedIncident}
        visible={showDetailModal}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedIncident(null);
        }}
      />
    </SafeAreaView>
  );
}

// ============ STYLES ============

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#111827",
  },
  addBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
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
    marginBottom: 20,
  },
  summaryMain: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    marginBottom: 4,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  statLabel: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.25)",
    marginVertical: 4,
  },

  // Filters
  filterContainer: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  filterScroll: {
    gap: 8,
  },
  filterTab: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  filterTabActive: {
    backgroundColor: "#8B5CF6",
  },
  filterText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#6B7280",
  },
  filterTextActive: {
    color: "#FFFFFF",
  },
  filterBadge: {
    backgroundColor: "#E5E7EB",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: "center",
  },
  filterBadgeActive: {
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  filterBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6B7280",
  },
  filterBadgeTextActive: {
    color: "#FFFFFF",
  },

  // List
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  // Incident Card
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
  incidentCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  incidentCardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },
  incidentTypeIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  incidentCardTitleInfo: {
    flex: 1,
  },
  incidentCardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  incidentCardDate: {
    fontSize: 12,
    color: "#6B7280",
  },
  incidentStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  incidentStatusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  incidentCardDescription: {
    fontSize: 14,
    color: "#4B5563",
    lineHeight: 20,
    marginBottom: 8,
  },
  incidentAdminNote: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    padding: 10,
    borderRadius: 8,
    gap: 8,
  },
  incidentAdminNoteText: {
    flex: 1,
    fontSize: 13,
    color: "#3B82F6",
  },

  // FAB
  fab: {
    position: "absolute",
    bottom: 24,
    right: 20,
    borderRadius: 28,
    shadowColor: "#8B5CF6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  fabGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },

  // Modal shared
  modalContainer: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  closeBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#111827",
  },
  modalContent: {
    flex: 1,
  },
  modalContentInner: {
    padding: 20,
  },

  // Report Modal
  stepTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 24,
  },
  typeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 24,
  },
  typeOption: {
    width: "47%",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  typeOptionSelected: {
    borderColor: "#3B82F6",
    backgroundColor: "#EFF6FF",
  },
  typeOptionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  typeOptionLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "#4B5563",
    textAlign: "center",
  },
  typeOptionLabelSelected: {
    color: "#3B82F6",
    fontWeight: "600",
  },
  nextButton: {
    backgroundColor: "#3B82F6",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  nextButtonDisabled: {
    backgroundColor: "#D1D5DB",
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  backStepButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 16,
  },
  backStepButtonText: {
    fontSize: 15,
    color: "#3B82F6",
    fontWeight: "500",
  },
  selectedTypePreview: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 12,
    borderRadius: 12,
    marginBottom: 24,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  selectedTypeIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  selectedTypeLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  descriptionInput: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: "#111827",
    minHeight: 150,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 8,
  },
  charCount: {
    fontSize: 12,
    color: "#9CA3AF",
    textAlign: "right",
    marginBottom: 24,
  },
  submitButton: {
    borderRadius: 12,
    overflow: "hidden",
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },

  // Detail Modal
  detailStatusSection: {
    alignItems: "center",
    marginBottom: 20,
  },
  detailStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  detailStatusText: {
    fontSize: 14,
    fontWeight: "600",
  },
  detailInfoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  detailInfoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  detailInfoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  detailInfoContent: {
    flex: 1,
  },
  detailInfoLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 2,
  },
  detailInfoValue: {
    fontSize: 15,
    fontWeight: "500",
    color: "#111827",
  },
  detailDivider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginVertical: 12,
  },
  detailSection: {
    marginBottom: 20,
  },
  detailSectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 12,
  },
  detailDescriptionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  detailDescription: {
    fontSize: 14,
    color: "#4B5563",
    lineHeight: 22,
  },
  adminNoteCard: {
    flexDirection: "row",
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    padding: 16,
    gap: 12,
    alignItems: "flex-start",
  },
  adminNoteContent: {
    flex: 1,
    fontSize: 14,
    color: "#3B82F6",
    lineHeight: 22,
  },
  resolvedCard: {
    flexDirection: "row",
    backgroundColor: "#D1FAE5",
    borderRadius: 12,
    padding: 16,
    gap: 12,
    alignItems: "center",
  },
  resolvedContent: {
    flex: 1,
  },
  resolvedText: {
    fontSize: 14,
    color: "#059669",
    fontWeight: "500",
  },
  resolvedBy: {
    fontSize: 13,
    color: "#10B981",
    marginTop: 2,
  },

  // Empty state
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
  emptyStateTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
  },
});
