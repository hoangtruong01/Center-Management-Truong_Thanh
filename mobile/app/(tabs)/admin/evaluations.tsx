import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore, useBranchesStore, useClassesStore } from "@/lib/stores";
import api from "@/lib/api";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Platform } from "react-native";

// Types
interface EvaluationPeriod {
  _id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  branchId?:
    | {
        _id: string;
        name: string;
      }
    | string;
  status: "active" | "inactive" | "completed";
  createdAt: string;
}

interface TeacherStatistic {
  teacherId: string;
  teacherName: string;
  averageRating: number;
  totalEvaluations: number;
}

interface ClassStatistic {
  classId: string;
  className: string;
  totalEvaluated: number;
  evaluationRate: number;
  teacherName: string;
  averageRating: number;
  totalStudents?: number;
}

// Format date
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

// Get status config
const getStatusConfig = (status: string) => {
  switch (status) {
    case "active":
      return { label: "Đang hoạt động", color: "#10B981", bg: "#D1FAE5" };
    case "completed":
      return { label: "Đã kết thúc", color: "#6B7280", bg: "#F3F4F6" };
    case "inactive":
    default:
      return { label: "Chưa bắt đầu", color: "#F59E0B", bg: "#FEF3C7" };
  }
};

// Create/Edit Period Modal
function PeriodModal({
  visible,
  onClose,
  onSubmit,
  period,
  branches,
  isLoading,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  period?: EvaluationPeriod | null;
  branches: { _id: string; name: string }[];
  isLoading: boolean;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  );
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [showBranchPicker, setShowBranchPicker] = useState(false);

  useEffect(() => {
    if (period) {
      setName(period.name);
      setDescription(period.description || "");
      setStartDate(new Date(period.startDate));
      setEndDate(new Date(period.endDate));
      const branchId =
        typeof period.branchId === "object"
          ? period.branchId?._id
          : period.branchId;
      setSelectedBranch(branchId || "");
    } else {
      setName("");
      setDescription("");
      setStartDate(new Date());
      setEndDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
      setSelectedBranch("");
    }
  }, [period, visible]);

  const handleSubmit = () => {
    if (!name.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập tên kỳ đánh giá");
      return;
    }
    if (endDate <= startDate) {
      Alert.alert("Lỗi", "Ngày kết thúc phải sau ngày bắt đầu");
      return;
    }
    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      branchId: selectedBranch || undefined,
    });
  };

  const handleStartChange = (event: DateTimePickerEvent, date?: Date) => {
    setShowStartPicker(Platform.OS === "ios");
    if (date) setStartDate(date);
  };

  const handleEndChange = (event: DateTimePickerEvent, date?: Date) => {
    setShowEndPicker(Platform.OS === "ios");
    if (date) setEndDate(date);
  };

  const selectedBranchName =
    branches.find((b) => b._id === selectedBranch)?.name || "Tất cả cơ sở";

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {period ? "Chỉnh sửa kỳ đánh giá" : "Tạo kỳ đánh giá mới"}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalForm}>
            <Text style={styles.label}>Tên kỳ đánh giá *</Text>
            <TextInput
              style={styles.input}
              placeholder="VD: Đánh giá giữa kỳ 1"
              value={name}
              onChangeText={setName}
              placeholderTextColor="#9CA3AF"
            />

            <Text style={styles.label}>Mô tả</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Mô tả kỳ đánh giá..."
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              placeholderTextColor="#9CA3AF"
            />

            <Text style={styles.label}>Cơ sở</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowBranchPicker(true)}
            >
              <Text style={styles.pickerButtonText}>{selectedBranchName}</Text>
              <Ionicons name="chevron-down" size={20} color="#6B7280" />
            </TouchableOpacity>

            <View style={styles.dateRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Ngày bắt đầu</Text>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowStartPicker(true)}
                >
                  <Ionicons name="calendar" size={18} color="#3B82F6" />
                  <Text style={styles.dateButtonText}>
                    {formatDate(startDate.toISOString())}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Ngày kết thúc</Text>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => setShowEndPicker(true)}
                >
                  <Ionicons name="calendar" size={18} color="#3B82F6" />
                  <Text style={styles.dateButtonText}>
                    {formatDate(endDate.toISOString())}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {showStartPicker && (
              <DateTimePicker
                value={startDate}
                mode="date"
                onChange={handleStartChange}
              />
            )}
            {showEndPicker && (
              <DateTimePicker
                value={endDate}
                mode="date"
                onChange={handleEndChange}
              />
            )}
          </ScrollView>

          <TouchableOpacity
            style={[styles.submitButton, isLoading && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitButtonText}>
                {period ? "Lưu thay đổi" : "Tạo kỳ đánh giá"}
              </Text>
            )}
          </TouchableOpacity>

          {/* Branch Picker Modal */}
          <Modal visible={showBranchPicker} transparent animationType="fade">
            <TouchableOpacity
              style={styles.pickerOverlay}
              activeOpacity={1}
              onPress={() => setShowBranchPicker(false)}
            >
              <View style={styles.pickerList}>
                <TouchableOpacity
                  style={styles.pickerItem}
                  onPress={() => {
                    setSelectedBranch("");
                    setShowBranchPicker(false);
                  }}
                >
                  <Text style={styles.pickerItemText}>Tất cả cơ sở</Text>
                  {selectedBranch === "" && (
                    <Ionicons name="checkmark" size={20} color="#3B82F6" />
                  )}
                </TouchableOpacity>
                {branches.map((branch) => (
                  <TouchableOpacity
                    key={branch._id}
                    style={styles.pickerItem}
                    onPress={() => {
                      setSelectedBranch(branch._id);
                      setShowBranchPicker(false);
                    }}
                  >
                    <Text style={styles.pickerItemText}>{branch.name}</Text>
                    {selectedBranch === branch._id && (
                      <Ionicons name="checkmark" size={20} color="#3B82F6" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableOpacity>
          </Modal>
        </View>
      </View>
    </Modal>
  );
}

export default function AdminEvaluationsScreen() {
  const { branches, fetchBranches } = useBranchesStore();
  const [periods, setPeriods] = useState<EvaluationPeriod[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<EvaluationPeriod | null>(
    null,
  );
  const [classStats, setClassStats] = useState<ClassStatistic[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<EvaluationPeriod | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState<"periods" | "stats">("periods");

  const fetchPeriods = useCallback(async () => {
    try {
      if (!refreshing) setLoading(true);
      const response = await api.get("/feedback/periods");
      setPeriods(response.data);
    } catch (error) {
      console.error("Error fetching periods:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshing]);

  const fetchStats = useCallback(async (periodId: string) => {
    try {
      setLoading(true);
      const response = await api.get(`/feedback/statistics/by-class`, {
        params: { periodId },
      });
      setClassStats(response.data.byClass || response.data || []);
    } catch (error) {
      console.error("Error fetching stats:", error);
      setClassStats([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBranches();
    fetchPeriods();
  }, []);

  useEffect(() => {
    if (selectedPeriod) {
      fetchStats(selectedPeriod._id);
    }
  }, [selectedPeriod]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPeriods();
  };

  const handleCreatePeriod = () => {
    setEditingPeriod(null);
    setShowModal(true);
  };

  const handleEditPeriod = (period: EvaluationPeriod) => {
    setEditingPeriod(period);
    setShowModal(true);
  };

  const handleDeletePeriod = (period: EvaluationPeriod) => {
    Alert.alert(
      "Xác nhận xóa",
      `Bạn có chắc muốn xóa kỳ đánh giá "${period.name}"?\nTất cả đánh giá trong kỳ này cũng sẽ bị xóa.`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xóa",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/feedback/periods/${period._id}`);
              fetchPeriods();
              Alert.alert("Thành công", "Đã xóa kỳ đánh giá");
            } catch (error: any) {
              Alert.alert("Lỗi", error.message || "Không thể xóa kỳ đánh giá");
            }
          },
        },
      ],
    );
  };

  const handleSavePeriod = async (data: any) => {
    try {
      setIsSubmitting(true);
      if (editingPeriod) {
        await api.patch(`/feedback/periods/${editingPeriod._id}`, data);
        Alert.alert("Thành công", "Đã cập nhật kỳ đánh giá");
      } else {
        await api.post("/feedback/periods", data);
        Alert.alert("Thành công", "Đã tạo kỳ đánh giá mới");
      }
      setShowModal(false);
      fetchPeriods();
    } catch (error: any) {
      Alert.alert(
        "Lỗi",
        error.response?.data?.message || "Không thể lưu kỳ đánh giá",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewStats = (period: EvaluationPeriod) => {
    setSelectedPeriod(period);
    setViewMode("stats");
  };

  const renderStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalf = rating - fullStars >= 0.5;

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(<Ionicons key={i} name="star" size={14} color="#F59E0B" />);
      } else if (i === fullStars && hasHalf) {
        stars.push(
          <Ionicons key={i} name="star-half" size={14} color="#F59E0B" />,
        );
      } else {
        stars.push(
          <Ionicons key={i} name="star-outline" size={14} color="#D1D5DB" />,
        );
      }
    }
    return <View style={styles.starsRow}>{stars}</View>;
  };

  // Stats View
  if (viewMode === "stats" && selectedPeriod) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <View style={styles.statsHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              setViewMode("periods");
              setSelectedPeriod(null);
            }}
          >
            <Ionicons name="arrow-back" size={24} color="#1F2937" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.statsTitle}>{selectedPeriod.name}</Text>
            <Text style={styles.statsSubtitle}>
              {formatDate(selectedPeriod.startDate)} -{" "}
              {formatDate(selectedPeriod.endDate)}
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#EC4899" />
          </View>
        ) : classStats.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="analytics-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>Chưa có đánh giá</Text>
            <Text style={styles.emptySubtitle}>
              Chưa có học sinh nào gửi đánh giá trong kỳ này
            </Text>
          </View>
        ) : (
          <FlatList
            data={classStats}
            keyExtractor={(item) => item.classId}
            contentContainerStyle={styles.statsList}
            renderItem={({ item }) => (
              <View style={styles.classStatCard}>
                <View style={styles.classStatHeader}>
                  <LinearGradient
                    colors={["#EC4899", "#DB2777"]}
                    style={styles.classStatIcon}
                  >
                    <Text style={styles.classStatIconText}>
                      {item.className.charAt(0)}
                    </Text>
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.classStatName}>{item.className}</Text>
                    <Text style={styles.classStatInfo}>
                      {item.totalEvaluated} đánh giá • {item.evaluationRate}%
                      hoàn thành
                    </Text>
                  </View>
                </View>

                <View style={styles.teachersList}>
                  <View style={styles.teacherStatRow}>
                    <Text style={styles.teacherName}>{item.teacherName}</Text>
                    <View style={styles.teacherRating}>
                      {renderStars(item.averageRating)}
                      <Text style={styles.ratingText}>
                        {item.averageRating.toFixed(1)}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            )}
          />
        )}
      </SafeAreaView>
    );
  }

  // Periods List View
  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      {/* Add Button */}
      <TouchableOpacity style={styles.fab} onPress={handleCreatePeriod}>
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#EC4899" />
        </View>
      ) : periods.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="calendar-outline" size={64} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>Chưa có kỳ đánh giá</Text>
          <Text style={styles.emptySubtitle}>
            Nhấn + để tạo kỳ đánh giá đầu tiên
          </Text>
        </View>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={styles.periodsList}>
            {periods.map((period) => {
              const statusConfig = getStatusConfig(period.status);
              const branchName =
                typeof period.branchId === "object"
                  ? period.branchId?.name
                  : "Tất cả cơ sở";

              return (
                <View key={period._id} style={styles.periodCard}>
                  <View style={styles.periodHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.periodName}>{period.name}</Text>
                      <Text style={styles.periodBranch}>{branchName}</Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: statusConfig.bg },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          { color: statusConfig.color },
                        ]}
                      >
                        {statusConfig.label}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.periodDates}>
                    <Ionicons
                      name="calendar-outline"
                      size={16}
                      color="#6B7280"
                    />
                    <Text style={styles.periodDateText}>
                      {formatDate(period.startDate)} -{" "}
                      {formatDate(period.endDate)}
                    </Text>
                  </View>

                  {period.description && (
                    <Text style={styles.periodDescription} numberOfLines={2}>
                      {period.description}
                    </Text>
                  )}

                  <View style={styles.periodActions}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleViewStats(period)}
                    >
                      <Ionicons name="stats-chart" size={18} color="#3B82F6" />
                      <Text style={styles.actionButtonText}>Thống kê</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleEditPeriod(period)}
                    >
                      <Ionicons
                        name="create-outline"
                        size={18}
                        color="#6B7280"
                      />
                      <Text style={styles.actionButtonText}>Sửa</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleDeletePeriod(period)}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color="#EF4444"
                      />
                      <Text
                        style={[styles.actionButtonText, { color: "#EF4444" }]}
                      >
                        Xóa
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* Period Modal */}
      <PeriodModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onSubmit={handleSavePeriod}
        period={editingPeriod}
        branches={branches}
        isLoading={isSubmitting}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#6B7280",
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#9CA3AF",
    marginTop: 8,
    textAlign: "center",
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#EC4899",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
    shadowColor: "#EC4899",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  periodsList: {
    padding: 16,
    paddingBottom: 80,
  },
  periodCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  periodHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  periodName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
  },
  periodBranch: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
  },
  periodDates: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  periodDateText: {
    fontSize: 13,
    color: "#6B7280",
  },
  periodDescription: {
    fontSize: 13,
    color: "#9CA3AF",
    marginBottom: 12,
  },
  periodActions: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    paddingTop: 12,
    gap: 16,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  actionButtonText: {
    fontSize: 13,
    color: "#6B7280",
  },

  // Stats styles
  statsHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
  },
  statsSubtitle: {
    fontSize: 13,
    color: "#6B7280",
  },
  statsList: {
    padding: 16,
  },
  classStatCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  classStatHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  classStatIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  classStatIconText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
  },
  classStatName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1F2937",
  },
  classStatInfo: {
    fontSize: 13,
    color: "#6B7280",
  },
  teachersList: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  teacherStatRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  teacherName: {
    fontSize: 14,
    color: "#374151",
    flex: 1,
  },
  teacherRating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  starsRow: {
    flexDirection: "row",
    gap: 2,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#F59E0B",
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "90%",
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F2937",
  },
  modalForm: {
    padding: 16,
    maxHeight: 400,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: "#1F2937",
  },
  textArea: {
    height: 80,
    textAlignVertical: "top",
  },
  pickerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 12,
  },
  pickerButtonText: {
    fontSize: 15,
    color: "#1F2937",
  },
  dateRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 12,
  },
  dateButtonText: {
    fontSize: 14,
    color: "#1F2937",
  },
  submitButton: {
    backgroundColor: "#EC4899",
    margin: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  pickerList: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    maxHeight: 300,
    padding: 8,
  },
  pickerItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  pickerItemText: {
    fontSize: 15,
    color: "#1F2937",
  },
});
