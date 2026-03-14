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
import { useBranchesStore } from "@/lib/stores";

interface Branch {
  _id: string;
  name: string;
  address?: string;
  phone?: string;
  isActive?: boolean;
  description?: string;
  createdAt?: string;
}

interface BranchFormData {
  name: string;
  address: string;
  phone: string;
  description: string;
}

function BranchFormModal({
  visible,
  onClose,
  onSubmit,
  title,
  submitText,
  formData,
  setFormData,
  selectedBranch,
  onToggleStatus,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: () => void;
  title: string;
  submitText: string;
  formData: BranchFormData;
  setFormData: (data: BranchFormData) => void;
  selectedBranch: Branch | null;
  onToggleStatus: () => void;
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons name="close" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>{title}</Text>
          <TouchableOpacity onPress={onSubmit}>
            <Text style={styles.submitButtonText}>{submitText}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalContent}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Tên cơ sở *</Text>
            <TextInput
              style={styles.input}
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
              placeholder="Nhập tên cơ sở"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Địa chỉ</Text>
            <TextInput
              style={styles.input}
              value={formData.address}
              onChangeText={(text) =>
                setFormData({ ...formData, address: text })
              }
              placeholder="Nhập địa chỉ"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Số điện thoại</Text>
            <TextInput
              style={styles.input}
              value={formData.phone}
              onChangeText={(text) => setFormData({ ...formData, phone: text })}
              placeholder="Nhập số điện thoại"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Mô tả</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.description}
              onChangeText={(text) =>
                setFormData({ ...formData, description: text })
              }
              placeholder="Nhập mô tả"
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
            />
          </View>

          {selectedBranch && (
            <TouchableOpacity
              style={styles.toggleButton}
              onPress={() => {
                onClose();
                onToggleStatus();
              }}
            >
              <Ionicons
                name={
                  selectedBranch.isActive !== false
                    ? "close-circle-outline"
                    : "checkmark-circle-outline"
                }
                size={20}
                color={
                  selectedBranch.isActive !== false ? "#DC2626" : "#059669"
                }
              />
              <Text
                style={[
                  styles.toggleButtonText,
                  {
                    color:
                      selectedBranch.isActive !== false ? "#DC2626" : "#059669",
                  },
                ]}
              >
                {selectedBranch.isActive !== false
                  ? "Vô hiệu hóa cơ sở"
                  : "Kích hoạt cơ sở"}
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export default function BranchesManagementScreen() {
  const { branches, fetchBranches, addBranch, updateBranch, isLoading } =
    useBranchesStore();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    phone: "",
    description: "",
  });

  useEffect(() => {
    fetchBranches();
  }, []);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await fetchBranches();
    setIsRefreshing(false);
  };

  const filteredBranches = branches.filter(
    (branch) =>
      branch.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      branch.address?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleAddBranch = async () => {
    if (!formData.name.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập tên cơ sở");
      return;
    }

    try {
      await addBranch({
        name: formData.name,
        address: formData.address,
        phone: formData.phone,
        description: formData.description,
      });
      Alert.alert("Thành công", "Đã thêm cơ sở mới");
      setIsAddModalVisible(false);
      resetForm();
    } catch (error) {
      Alert.alert("Lỗi", "Không thể thêm cơ sở");
    }
  };

  const handleUpdateBranch = async () => {
    if (!selectedBranch || !formData.name.trim()) {
      Alert.alert("Lỗi", "Vui lòng nhập tên cơ sở");
      return;
    }

    try {
      await updateBranch(selectedBranch._id, {
        name: formData.name,
        address: formData.address,
        phone: formData.phone,
        description: formData.description,
      });
      Alert.alert("Thành công", "Đã cập nhật cơ sở");
      setIsEditModalVisible(false);
      resetForm();
    } catch (error) {
      Alert.alert("Lỗi", "Không thể cập nhật cơ sở");
    }
  };

  const handleToggleStatus = async (branch: Branch) => {
    try {
      await updateBranch(branch._id, { isActive: !branch.isActive });
      Alert.alert(
        "Thành công",
        `Đã ${branch.isActive ? "vô hiệu hóa" : "kích hoạt"} cơ sở`,
      );
    } catch (error) {
      Alert.alert("Lỗi", "Không thể thay đổi trạng thái");
    }
  };

  const openEditModal = (branch: Branch) => {
    setSelectedBranch(branch);
    setFormData({
      name: branch.name || "",
      address: branch.address || "",
      phone: branch.phone || "",
      description: branch.description || "",
    });
    setIsEditModalVisible(true);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      address: "",
      phone: "",
      description: "",
    });
    setSelectedBranch(null);
  };

  const renderBranchCard = ({ item: branch }: { item: Branch }) => (
    <TouchableOpacity
      style={styles.branchCard}
      onPress={() => openEditModal(branch)}
      activeOpacity={0.7}
    >
      <LinearGradient
        colors={
          branch.isActive !== false
            ? ["#8B5CF6", "#7C3AED"]
            : ["#9CA3AF", "#6B7280"]
        }
        style={styles.branchIcon}
      >
        <Ionicons name="business" size={24} color="#FFFFFF" />
      </LinearGradient>

      <View style={styles.branchInfo}>
        <Text style={styles.branchName}>{branch.name}</Text>
        {branch.address && (
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={14} color="#6B7280" />
            <Text style={styles.branchAddress}>{branch.address}</Text>
          </View>
        )}
        {branch.phone && (
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={14} color="#6B7280" />
            <Text style={styles.branchPhone}>{branch.phone}</Text>
          </View>
        )}
      </View>

      <View style={styles.branchRight}>
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor:
                branch.isActive !== false ? "#D1FAE5" : "#F3F4F6",
            },
          ]}
        >
          <Text
            style={[
              styles.statusText,
              { color: branch.isActive !== false ? "#059669" : "#6B7280" },
            ]}
          >
            {branch.isActive !== false ? "Hoạt động" : "Ngưng"}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      {/* Header */}
      <LinearGradient colors={["#8B5CF6", "#7C3AED"]} style={styles.header}>
        <View style={styles.headerContent}>
          <Ionicons name="business" size={28} color="#FFFFFF" />
          <View style={styles.headerInfo}>
            <Text style={styles.headerValue}>{branches.length}</Text>
            <Text style={styles.headerSubtitle}>Cơ sở trong hệ thống</Text>
          </View>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              resetForm();
              setIsAddModalVisible(true);
            }}
          >
            <Ionicons name="add" size={24} color="#8B5CF6" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons
          name="search"
          size={20}
          color="#9CA3AF"
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Tìm kiếm cơ sở..."
          placeholderTextColor="#9CA3AF"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Ionicons name="close-circle" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Branch List */}
      {isLoading && !isRefreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={styles.loadingText}>Đang tải...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredBranches}
          renderItem={renderBranchCard}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Ionicons name="business-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyText}>Chưa có cơ sở nào</Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => {
                  resetForm();
                  setIsAddModalVisible(true);
                }}
              >
                <Ionicons name="add" size={20} color="#FFFFFF" />
                <Text style={styles.emptyButtonText}>Thêm cơ sở mới</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      {/* Add Modal */}
      <BranchFormModal
        visible={isAddModalVisible}
        onClose={() => {
          setIsAddModalVisible(false);
          resetForm();
        }}
        onSubmit={handleAddBranch}
        title="Thêm cơ sở mới"
        submitText="Thêm"
        formData={formData}
        setFormData={setFormData}
        selectedBranch={selectedBranch}
        onToggleStatus={() => {}}
      />

      {/* Edit Modal */}
      <BranchFormModal
        visible={isEditModalVisible}
        onClose={() => {
          setIsEditModalVisible(false);
          resetForm();
        }}
        onSubmit={handleUpdateBranch}
        title="Chỉnh sửa cơ sở"
        submitText="Lưu"
        formData={formData}
        setFormData={setFormData}
        selectedBranch={selectedBranch}
        onToggleStatus={() =>
          selectedBranch && handleToggleStatus(selectedBranch)
        }
      />
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
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  // Search
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    margin: 16,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#1F2937",
  },
  // List
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  branchCard: {
    flexDirection: "row",
    alignItems: "center",
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
  branchIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  branchInfo: {
    flex: 1,
  },
  branchName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 4,
  },
  branchAddress: {
    fontSize: 13,
    color: "#6B7280",
  },
  branchPhone: {
    fontSize: 13,
    color: "#6B7280",
  },
  branchRight: {
    alignItems: "flex-end",
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
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
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 80,
  },
  emptyText: {
    fontSize: 14,
    color: "#9CA3AF",
    marginTop: 12,
    marginBottom: 16,
  },
  emptyButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#8B5CF6",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  emptyButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
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
  submitButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#8B5CF6",
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#1F2937",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  toggleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    marginTop: 20,
    gap: 8,
  },
  toggleButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
