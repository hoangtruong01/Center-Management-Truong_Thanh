import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  Modal,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNotificationsStore, Notification } from "@/lib/stores";
import { Swipeable } from "react-native-gesture-handler";
import { Alert } from "react-native";

const { width } = Dimensions.get("window");

const getNotificationConfig = (type: Notification["type"]) => {
  switch (type) {
    case "success":
      return {
        icon: "checkmark-circle" as const,
        colors: ["#10B981", "#059669"],
        bgColor: "#D1FAE5",
        label: "Thành công",
      };
    case "warning":
      return {
        icon: "warning" as const,
        colors: ["#F59E0B", "#D97706"],
        bgColor: "#FEF3C7",
        label: "Cảnh báo",
      };
    case "error":
      return {
        icon: "close-circle" as const,
        colors: ["#EF4444", "#DC2626"],
        bgColor: "#FEE2E2",
        label: "Lỗi",
      };
    default:
      return {
        icon: "information-circle" as const,
        colors: ["#3B82F6", "#2563EB"],
        bgColor: "#DBEAFE",
        label: "Thông tin",
      };
  }
};

const formatDate = (date: Date) => {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  if (hours < 24) return `${hours} giờ trước`;
  if (days < 7) return `${days} ngày trước`;
  return d.toLocaleDateString("vi-VN");
};

const formatFullDate = (date: Date) => {
  const d = new Date(date);
  return d.toLocaleDateString("vi-VN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function NotificationsScreen() {
  const {
    notifications,
    unreadCount,
    isLoading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
  } = useNotificationsStore();

  const [selectedNotification, setSelectedNotification] =
    useState<Notification | null>(null);
  const [isDetailVisible, setIsDetailVisible] = useState(false);
  const [visibleCount, setVisibleCount] = useState(5);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const onRefresh = async () => {
    setVisibleCount(5);
    await fetchNotifications();
  };

  const handleNotificationPress = (notification: Notification) => {
    if (!notification.isRead) {
      markAsRead(notification._id);
    }
    setSelectedNotification(notification);
    setIsDetailVisible(true);
  };

  const handleLoadMore = () => {
    setVisibleCount((prev) => prev + 5);
  };

  const closeDetail = () => {
    setIsDetailVisible(false);
    setSelectedNotification(null);
  };

  const handleDeleteAll = () => {
    if (notifications.length === 0) return;
    
    Alert.alert(
      "Xác nhận xóa",
      "Bạn có chắc chắn muốn xóa tất cả thông báo không?",
      [
        { text: "Hủy", style: "cancel" },
        { 
          text: "Xóa hết", 
          style: "destructive",
          onPress: () => deleteAllNotifications()
        }
      ]
    );
  };

  const renderRightActions = (id: string) => {
    return (
      <TouchableOpacity
        style={styles.deleteAction}
        onPress={() => deleteNotification(id)}
      >
        <Ionicons name="trash-outline" size={24} color="#FFFFFF" />
        <Text style={styles.deleteActionText}>Xóa</Text>
      </TouchableOpacity>
    );
  };

  const renderNotification = ({ item }: { item: Notification }) => {
    const config = getNotificationConfig(item.type);
    return (
      <Swipeable
        renderRightActions={() => renderRightActions(item._id)}
        friction={2}
        rightThreshold={40}
      >
        <TouchableOpacity
          style={[
            styles.notificationCard,
            !item.isRead && styles.unreadNotification,
          ]}
          onPress={() => handleNotificationPress(item)}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={config.colors as [string, string]}
            style={styles.iconContainer}
          >
            <Ionicons name={config.icon} size={22} color="#FFFFFF" />
          </LinearGradient>
          <View style={styles.notificationContent}>
            <View style={styles.notificationHeader}>
              <Text
                style={[
                  styles.notificationTitle,
                  !item.isRead && styles.unreadTitle,
                ]}
                numberOfLines={1}
              >
                {item.title}
              </Text>
              {!item.isRead && <View style={styles.unreadDot} />}
            </View>
            <Text style={styles.notificationText} numberOfLines={2}>
              {item.content}
            </Text>
            <View style={styles.notificationFooter}>
              <Ionicons name="time-outline" size={12} color="#9CA3AF" />
              <Text style={styles.notificationTime}>
                {formatDate(item.createdAt)}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
        </TouchableOpacity>
      </Swipeable>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      {/* Header Stats */}
      <View style={styles.headerStats}>
        <View style={styles.statCard}>
          <LinearGradient
            colors={["#3B82F6", "#2563EB"]}
            style={styles.statIconBg}
          >
            <Ionicons name="notifications" size={18} color="#FFFFFF" />
          </LinearGradient>
          <View style={styles.statInfo}>
            <Text style={styles.statValue}>{notifications.length}</Text>
            <Text style={styles.statLabel}>Tổng số</Text>
          </View>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCard}>
          <LinearGradient
            colors={["#EF4444", "#DC2626"]}
            style={styles.statIconBg}
          >
            <Ionicons name="mail-unread" size={18} color="#FFFFFF" />
          </LinearGradient>
          <View style={styles.statInfo}>
            <Text style={styles.statValue}>{unreadCount}</Text>
            <Text style={styles.statLabel}>Chưa đọc</Text>
          </View>
        </View>
      </View>

      {/* Header Actions */}
      {notifications.length > 0 && (
        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <TouchableOpacity
              onPress={markAllAsRead}
              style={styles.markAllButton}
            >
              <Ionicons name="checkmark-done" size={18} color="#3B82F6" />
              <Text style={styles.markAllRead}>Đánh dấu đã đọc</Text>
            </TouchableOpacity>
          )}
          
          <TouchableOpacity
            onPress={handleDeleteAll}
            style={[styles.markAllButton, { backgroundColor: "#FEE2E2", marginLeft: 8 }]}
          >
            <Ionicons name="trash" size={18} color="#EF4444" />
            <Text style={[styles.markAllRead, { color: "#EF4444" }]}>Xóa hết</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Notifications List */}
      <FlatList
        data={notifications.slice(0, visibleCount)}
        keyExtractor={(item) => item._id}
        renderItem={renderNotification}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
        ListFooterComponent={() =>
          notifications.length > visibleCount ? (
            <TouchableOpacity
              style={styles.loadMoreButton}
              onPress={handleLoadMore}
            >
              <Text style={styles.loadMoreText}>Xem thêm</Text>
              <Ionicons name="chevron-down" size={16} color="#3B82F6" />
            </TouchableOpacity>
          ) : notifications.length > 0 ? (
            <View style={styles.noMoreContainer}>
              <Text style={styles.noMoreText}>Bạn đã xem hết thông báo</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <LinearGradient
              colors={["#F3F4F6", "#E5E7EB"]}
              style={styles.emptyIconBg}
            >
              <Ionicons
                name="notifications-outline"
                size={48}
                color="#9CA3AF"
              />
            </LinearGradient>
            <Text style={styles.emptyTitle}>Không có thông báo</Text>
            <Text style={styles.emptyText}>Bạn chưa có thông báo nào</Text>
          </View>
        }
      />

      {/* Notification Detail Modal */}
      <Modal
        visible={isDetailVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeDetail}
      >
        <SafeAreaView style={styles.modalContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeDetail} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#1F2937" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Chi tiết thông báo</Text>
            <View style={{ width: 40 }} />
          </View>

          {selectedNotification && (
            <ScrollView
              style={styles.modalContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Notification Type Badge */}
              {(() => {
                const config = getNotificationConfig(selectedNotification.type);
                return (
                  <View style={styles.detailTypeContainer}>
                    <LinearGradient
                      colors={config.colors as [string, string]}
                      style={styles.detailIconBg}
                    >
                      <Ionicons name={config.icon} size={32} color="#FFFFFF" />
                    </LinearGradient>
                    <View
                      style={[
                        styles.detailTypeBadge,
                        { backgroundColor: config.bgColor },
                      ]}
                    >
                      <Text
                        style={[
                          styles.detailTypeText,
                          { color: config.colors[0] },
                        ]}
                      >
                        {config.label}
                      </Text>
                    </View>
                  </View>
                );
              })()}

              {/* Title */}
              <Text style={styles.detailTitle}>
                {selectedNotification.title}
              </Text>

              {/* Time */}
              <View style={styles.detailTimeContainer}>
                <Ionicons name="time-outline" size={16} color="#6B7280" />
                <Text style={styles.detailTime}>
                  {formatFullDate(selectedNotification.createdAt)}
                </Text>
              </View>

              {/* Content */}
              <View style={styles.detailContentCard}>
                <Text style={styles.detailContentLabel}>Nội dung</Text>
                <Text style={styles.detailContent}>
                  {selectedNotification.content}
                </Text>
              </View>

              {/* Status */}
              <View style={styles.detailStatusContainer}>
                <View style={styles.detailStatusRow}>
                  <View style={styles.detailStatusItem}>
                    <View
                      style={[
                        styles.detailStatusDot,
                        {
                          backgroundColor: selectedNotification.isRead
                            ? "#10B981"
                            : "#3B82F6",
                        },
                      ]}
                    />
                    <Text style={styles.detailStatusText}>
                      {selectedNotification.isRead ? "Đã đọc" : "Chưa đọc"}
                    </Text>
                  </View>
                </View>
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
  headerStats: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  statCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  statIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  statInfo: {
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1F2937",
  },
  statLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: "#E5E7EB",
    marginHorizontal: 16,
  },
  headerActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  markAllButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  markAllRead: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3B82F6",
  },
  listContent: {
    padding: 16,
    paddingTop: 8,
    paddingBottom: 32,
    flexGrow: 1,
  },
  notificationCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    alignItems: "center",
  },
  unreadNotification: {
    backgroundColor: "#FFFFFF",
    borderLeftWidth: 4,
    borderLeftColor: "#3B82F6",
  },
  iconContainer: {
    width: 46,
    height: 46,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: "500",
    color: "#374151",
    flex: 1,
  },
  unreadTitle: {
    fontWeight: "700",
    color: "#1F2937",
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#3B82F6",
    marginLeft: 8,
  },
  notificationText: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 20,
    marginBottom: 8,
  },
  notificationFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  notificationTime: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
  },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },
  // Modal Styles
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
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
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
  detailTypeContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  detailIconBg: {
    width: 72,
    height: 72,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  detailTypeBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  detailTypeText: {
    fontSize: 14,
    fontWeight: "600",
  },
  detailTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1F2937",
    textAlign: "center",
    marginBottom: 12,
  },
  detailTimeContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginBottom: 24,
  },
  detailTime: {
    fontSize: 14,
    color: "#6B7280",
  },
  detailContentCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  detailContentLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  detailContent: {
    fontSize: 16,
    color: "#1F2937",
    lineHeight: 26,
  },
  detailStatusContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  detailStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  detailStatusItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  detailStatusText: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "500",
  },
  loadMoreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 24,
    paddingVertical: 14,
    borderRadius: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  loadMoreText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#3B82F6",
  },
  noMoreContainer: {
    alignItems: "center",
    paddingVertical: 20,
    marginBottom: 20,
  },
  noMoreText: {
    fontSize: 14,
    color: "#9CA3AF",
  },
  deleteAction: {
    backgroundColor: "#EF4444",
    justifyContent: "center",
    alignItems: "center",
    width: 80,
    height: "83%",
    marginTop: 0,
    marginBottom: 10,
    borderRadius: 16,
    marginLeft: 10,
  },
  deleteActionText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "bold",
    marginTop: 4,
  },
});
