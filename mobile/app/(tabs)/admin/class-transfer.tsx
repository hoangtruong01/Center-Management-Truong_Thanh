import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  useClassesStore,
  type ClassTransferRequest,
} from "@/lib/stores/classes-store";

type StatusFilter = "all" | "pending" | "approved" | "rejected";

const STATUS_LABEL: Record<StatusFilter, string> = {
  all: "Tất cả",
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Đã từ chối",
};

export default function AdminClassTransferScreen() {
  const {
    fetchClassTransferRequests,
    approveClassTransferRequest,
    rejectClassTransferRequest,
    bulkApproveClassTransferRequests,
    bulkRejectClassTransferRequests,
    isLoading,
  } = useClassesStore();

  const [requests, setRequests] = useState<ClassTransferRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchClassTransferRequests();
      setRequests(data);
    } catch (err: any) {
      setError(err?.message || "Không tải được danh sách yêu cầu chuyển lớp");
    } finally {
      setLoading(false);
    }
  }, [fetchClassTransferRequests]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    setSelectedIds([]);
  }, [statusFilter, searchQuery]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadRequests();
    setRefreshing(false);
  }, [loadRequests]);

  const filteredRequests = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return requests.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) {
        return false;
      }

      if (!q) {
        return true;
      }

      const studentName = item.metadata?.studentName?.toLowerCase() || "";
      const fromClass = item.metadata?.fromClassName?.toLowerCase() || "";
      const toClass = item.metadata?.toClassName?.toLowerCase() || "";

      return (
        studentName.includes(q) || fromClass.includes(q) || toClass.includes(q)
      );
    });
  }, [requests, searchQuery, statusFilter]);

  const sortedRequests = useMemo(() => {
    return [...filteredRequests].sort((a, b) => {
      const aPending = a.status === "pending";
      const bPending = b.status === "pending";

      if (aPending !== bPending) {
        return aPending ? -1 : 1;
      }

      const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return bTime - aTime;
    });
  }, [filteredRequests]);

  const pendingIds = useMemo(
    () =>
      sortedRequests.filter((r) => r.status === "pending").map((r) => r._id),
    [sortedRequests],
  );

  const allPendingSelected =
    pendingIds.length > 0 && pendingIds.every((id) => selectedIds.includes(id));

  const toggleSelectAllPending = () => {
    if (allPendingSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pendingIds.includes(id)));
      return;
    }

    setSelectedIds((prev) => Array.from(new Set([...prev, ...pendingIds])));
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleApprove = async (requestId: string) => {
    Alert.alert("Duyệt yêu cầu", "Xác nhận duyệt yêu cầu chuyển lớp này?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Duyệt",
        style: "default",
        onPress: async () => {
          try {
            await approveClassTransferRequest(requestId);
            await loadRequests();
          } catch (err: any) {
            Alert.alert("Lỗi", err?.message || "Duyệt yêu cầu thất bại");
          }
        },
      },
    ]);
  };

  const handleReject = async (requestId: string) => {
    Alert.alert("Từ chối yêu cầu", "Xác nhận từ chối yêu cầu chuyển lớp này?", [
      { text: "Hủy", style: "cancel" },
      {
        text: "Từ chối",
        style: "destructive",
        onPress: async () => {
          try {
            await rejectClassTransferRequest(requestId);
            await loadRequests();
          } catch (err: any) {
            Alert.alert("Lỗi", err?.message || "Từ chối yêu cầu thất bại");
          }
        },
      },
    ]);
  };

  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) {
      return;
    }

    Alert.alert(
      "Duyệt hàng loạt",
      `Xác nhận duyệt ${selectedIds.length} yêu cầu đã chọn?`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Duyệt",
          onPress: async () => {
            try {
              const result =
                await bulkApproveClassTransferRequests(selectedIds);
              if (result.failed > 0) {
                Alert.alert(
                  "Cảnh báo",
                  `Có ${result.failed}/${result.total} yêu cầu duyệt thất bại`,
                );
              }
              setSelectedIds([]);
              await loadRequests();
            } catch (err: any) {
              Alert.alert("Lỗi", err?.message || "Duyệt hàng loạt thất bại");
            }
          },
        },
      ],
    );
  };

  const handleBulkReject = async () => {
    if (selectedIds.length === 0) {
      return;
    }

    Alert.alert(
      "Từ chối hàng loạt",
      `Xác nhận từ chối ${selectedIds.length} yêu cầu đã chọn?`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Từ chối",
          style: "destructive",
          onPress: async () => {
            try {
              const result = await bulkRejectClassTransferRequests(selectedIds);
              if (result.failed > 0) {
                Alert.alert(
                  "Cảnh báo",
                  `Có ${result.failed}/${result.total} yêu cầu từ chối thất bại`,
                );
              }
              setSelectedIds([]);
              await loadRequests();
            } catch (err: any) {
              Alert.alert("Lỗi", err?.message || "Từ chối hàng loạt thất bại");
            }
          },
        },
      ],
    );
  };

  const renderItem = ({ item }: { item: ClassTransferRequest }) => {
    const isPending = item.status === "pending";
    const isSelected = selectedIds.includes(item._id);

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardLeft}>
            {isPending ? (
              <TouchableOpacity
                style={styles.checkbox}
                onPress={() => toggleSelectOne(item._id)}
              >
                <Ionicons
                  name={isSelected ? "checkbox" : "square-outline"}
                  size={20}
                  color={isSelected ? "#2563EB" : "#6B7280"}
                />
              </TouchableOpacity>
            ) : null}
            <View>
              <Text style={styles.studentName}>
                {item.metadata?.studentName || "Học sinh"}
              </Text>
              <Text style={styles.classPath}>
                {item.metadata?.fromClassName || "Lớp nguồn"} {"->"}{" "}
                {item.metadata?.toClassName || "Lớp đích"}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.statusBadge,
              item.status === "pending"
                ? styles.pendingBadge
                : item.status === "approved"
                  ? styles.approvedBadge
                  : styles.rejectedBadge,
            ]}
          >
            <Text style={styles.statusText}>{STATUS_LABEL[item.status]}</Text>
          </View>
        </View>

        {item.metadata?.reason ? (
          <Text style={styles.metaText}>Lý do: {item.metadata.reason}</Text>
        ) : null}

        {item.metadata?.rejectReason ? (
          <Text style={[styles.metaText, styles.rejectText]}>
            Lý do từ chối: {item.metadata.rejectReason}
          </Text>
        ) : null}

        {isPending ? (
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.approveButton]}
              onPress={() => handleApprove(item._id)}
              disabled={isLoading}
            >
              <Text style={styles.actionButtonText}>Duyệt</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              onPress={() => handleReject(item._id)}
              disabled={isLoading}
            >
              <Text style={styles.actionButtonText}>Từ chối</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Quản lý chuyển lớp</Text>
        <Text style={styles.subtitle}>
          Duyệt hoặc từ chối yêu cầu trước khi chuyển lớp
        </Text>
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder="Tìm theo học sinh hoặc tên lớp"
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholderTextColor="#9CA3AF"
      />

      <View style={styles.filterRow}>
        {(Object.keys(STATUS_LABEL) as StatusFilter[]).map((status) => (
          <TouchableOpacity
            key={status}
            style={[
              styles.filterPill,
              statusFilter === status && styles.filterPillActive,
            ]}
            onPress={() => setStatusFilter(status)}
          >
            <Text
              style={[
                styles.filterPillText,
                statusFilter === status && styles.filterPillTextActive,
              ]}
            >
              {STATUS_LABEL[status]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {pendingIds.length > 0 ? (
        <View style={styles.bulkBar}>
          <TouchableOpacity
            style={styles.bulkSelectBtn}
            onPress={toggleSelectAllPending}
          >
            <Ionicons
              name={allPendingSelected ? "checkbox" : "square-outline"}
              size={18}
              color="#1F2937"
            />
            <Text style={styles.bulkSelectText}>Chọn tất cả chờ duyệt</Text>
          </TouchableOpacity>

          <View style={styles.bulkActions}>
            <TouchableOpacity
              style={[styles.bulkActionBtn, styles.approveButton]}
              onPress={handleBulkApprove}
              disabled={selectedIds.length === 0 || isLoading}
            >
              <Text style={styles.actionButtonText}>
                Duyệt ({selectedIds.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bulkActionBtn, styles.rejectButton]}
              onPress={handleBulkReject}
              disabled={selectedIds.length === 0 || isLoading}
            >
              <Text style={styles.actionButtonText}>Từ chối</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Đang tải yêu cầu...</Text>
        </View>
      ) : (
        <FlatList
          data={sortedRequests}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              Không có yêu cầu phù hợp với bộ lọc hiện tại.
            </Text>
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  header: {
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  subtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 4,
  },
  searchInput: {
    backgroundColor: "#FFFFFF",
    borderColor: "#D1D5DB",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#111827",
    marginBottom: 10,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  filterPill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#FFFFFF",
  },
  filterPillActive: {
    borderColor: "#2563EB",
    backgroundColor: "#DBEAFE",
  },
  filterPillText: {
    color: "#4B5563",
    fontSize: 12,
    fontWeight: "600",
  },
  filterPillTextActive: {
    color: "#1D4ED8",
  },
  bulkBar: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
    padding: 10,
    marginBottom: 10,
    gap: 10,
  },
  bulkSelectBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bulkSelectText: {
    color: "#1F2937",
    fontSize: 13,
    fontWeight: "600",
  },
  bulkActions: {
    flexDirection: "row",
    gap: 8,
  },
  bulkActionBtn: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  listContent: {
    paddingBottom: 24,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
    marginBottom: 10,
    gap: 8,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  cardLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    flex: 1,
  },
  checkbox: {
    paddingTop: 2,
  },
  studentName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  classPath: {
    fontSize: 13,
    color: "#4B5563",
    marginTop: 2,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pendingBadge: {
    backgroundColor: "#FEF3C7",
  },
  approvedBadge: {
    backgroundColor: "#DCFCE7",
  },
  rejectedBadge: {
    backgroundColor: "#FEE2E2",
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#374151",
  },
  metaText: {
    fontSize: 12,
    color: "#6B7280",
  },
  rejectText: {
    color: "#B91C1C",
  },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  approveButton: {
    backgroundColor: "#16A34A",
  },
  rejectButton: {
    backgroundColor: "#DC2626",
  },
  actionButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  errorText: {
    color: "#B91C1C",
    fontSize: 13,
    marginBottom: 8,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: {
    color: "#4B5563",
    fontSize: 13,
  },
  emptyText: {
    textAlign: "center",
    color: "#6B7280",
    marginTop: 36,
    fontSize: 14,
  },
});
