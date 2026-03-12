import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  useAuthStore,
  useChatStore,
  useIncidentsStore,
  getIncidentTypeLabel,
  getIncidentStatusLabel,
  getIncidentStatusColor,
} from "@/lib/stores";
import type {
  Conversation,
  Message,
  ChatUser,
  IncidentType,
  IncidentStatus,
  Incident,
} from "@/lib/stores";

// ============ SHARED HELPERS ============

const formatTime = (dateString: any) => {
  if (!dateString) return "";
  const actualDate = typeof dateString === 'object' && dateString.$date ? dateString.$date : dateString;
  const date = new Date(actualDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } else if (diffDays === 1) {
    return "Hôm qua";
  } else if (diffDays < 7) {
    const days = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
    return days[date.getDay()];
  } else {
    return date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
    });
  }
};

const getRoleLabel = (role: string) => {
  switch (role) {
    case "teacher":
      return "Giáo viên";
    case "student":
      return "Học sinh";
    case "parent":
      return "Phụ huynh";
    case "admin":
      return "Quản trị viên";
    default:
      return role;
  }
};

const getRoleColors = (role: string): [string, string] => {
  switch (role) {
    case "teacher":
      return ["#10B981", "#059669"];
    case "student":
      return ["#3B82F6", "#2563EB"];
    case "parent":
      return ["#F59E0B", "#D97706"];
    case "admin":
      return ["#8B5CF6", "#7C3AED"];
    default:
      return ["#6B7280", "#4B5563"];
  }
};

// ============ INCIDENT REPORT TYPES & HELPERS ============

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

// ============ CHAT DETAIL MODAL ============

function ChatDetailModal({
  visible,
  onClose,
  recipient,
}: {
  visible: boolean;
  onClose: () => void;
  recipient: ChatUser | null;
}) {
  const { user, accessToken } = useAuthStore();
  const {
    messages,
    fetchMessages,
    sendMessage,
    setCurrentConversation,
    initializeSocket,
    typingUsers,
    onlineUsers,
    isLoading,
    markAsRead,
  } = useChatStore();
  const [inputText, setInputText] = useState("");
  const scrollViewRef = useRef<FlatList>(null);

  useEffect(() => {
    if (visible && recipient && accessToken) {
      initializeSocket(accessToken);
      setCurrentConversation(recipient._id);
      fetchMessages(recipient._id);
      markAsRead(recipient._id);
    }

    return () => {
      if (recipient) {
        setCurrentConversation(null);
      }
    };
  }, [visible, recipient, accessToken]);

  const conversationMessages = recipient
    ? messages[recipient._id] || []
    : [];

  const handleSend = async () => {
    if (!inputText.trim() || !recipient) return;
    await sendMessage(recipient._id, inputText.trim());
    setInputText("");
  };

  const isOnline = recipient ? onlineUsers.includes(recipient._id) : false;

  const renderMessage = ({ item }: { item: Message }) => {
    const sId = typeof item.senderId === 'string' ? item.senderId : (item.senderId?._id || (item.senderId as any)?.$oid);
    const uId = typeof user?._id === 'string' ? user?._id : (user?._id as any)?.$oid;
    const isOwnMessage = sId === uId;

    return (
      <View
        style={[
          styles.messageContainer,
          isOwnMessage ? styles.ownMessage : styles.otherMessage,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isOwnMessage ? styles.ownBubble : styles.otherBubble,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isOwnMessage && styles.ownMessageText,
            ]}
          >
            {item.content}
          </Text>
          <Text
            style={[
              styles.messageTime,
              isOwnMessage && styles.ownMessageTime,
            ]}
          >
            {formatTime(item.createdAt)}
          </Text>
        </View>
      </View>
    );
  };

  if (!recipient) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 63 : 0}
      >
        <SafeAreaView
          style={[styles.incidentModalContainer, { flex: 1 }]}
          edges={['top', 'bottom']}
        >
          {/* Header */}
          <View style={styles.chatDetailHeader}>
            <TouchableOpacity
              onPress={onClose}
              style={styles.incidentCloseBtn}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
            >
              <Ionicons name="arrow-back" size={24} color="#1F2937" />
            </TouchableOpacity>
            <View style={styles.chatDetailInfo}>
              <View style={styles.chatAvatarWrapper}>
                <LinearGradient
                  colors={getRoleColors(recipient.role)}
                  style={styles.chatDetailAvatar}
                >
                  <Text style={styles.chatDetailAvatarText}>
                    {recipient.name.charAt(0).toUpperCase()}
                  </Text>
                </LinearGradient>
                {isOnline && <View style={styles.chatOnlineDot} />}
              </View>
              <View>
                <Text style={styles.chatDetailName}>{recipient.name}</Text>
                <Text style={styles.chatDetailRole}>
                  {getRoleLabel(recipient.role)}
                  {isOnline ? " • Trực tuyến" : ""}
                </Text>
              </View>
            </View>
          </View>

          {/* Messages Area */}
          <View style={{ flex: 1, backgroundColor: '#F3F4F6' }}>
            {isLoading && conversationMessages.length === 0 ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3B82F6" />
              </View>
            ) : conversationMessages.length === 0 ? (
              <View style={styles.emptyMessages}>
                <Ionicons name="chatbubbles-outline" size={64} color="#D1D5DB" />
                <Text style={styles.emptyMsgText}>Chưa có tin nhắn</Text>
                <Text style={styles.emptyMsgSubtext}>Hãy gửi tin nhắn đầu tiên!</Text>
              </View>
            ) : (
              <FlatList
                ref={scrollViewRef}
                // Đảo ngược mảng data trước khi render
                data={[...conversationMessages].reverse()}
                renderItem={renderMessage}
                keyExtractor={(item) => item._id}
                contentContainerStyle={[styles.messagesList, { paddingBottom: 10 }]}
                // Kích hoạt chế độ lộn ngược
                inverted={true}
                showsVerticalScrollIndicator={false}
              // Xoá bỏ onContentSizeChange gây giật lag
              />
            )}
          </View>

          {/* Typing indicator */}
          {recipient && typingUsers[recipient._id] && (
            <View style={styles.typingIndicator}>
              <Text style={styles.typingText}>
                {recipient.name} đang nhập...
              </Text>
            </View>
          )}

          {/* Input */}
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.chatInput}
              placeholder="Nhập tin nhắn..."
              value={inputText}
              onChangeText={setInputText}
              multiline
              placeholderTextColor="#9CA3AF"
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                !inputText.trim() && styles.sendButtonDisabled,
              ]}
              onPress={handleSend}
              disabled={!inputText.trim()}
            >
              <Ionicons
                name="send"
                size={20}
                color={inputText.trim() ? "#FFFFFF" : "#9CA3AF"}
              />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ============ NEW CHAT MODAL ============

function NewChatModal({
  visible,
  onClose,
  onSelectUser,
}: {
  visible: boolean;
  onClose: () => void;
  onSelectUser: (user: ChatUser) => void;
}) {
  const {
    availableUsers,
    fetchAvailableUsers,
    isLoading,
    onlineUsers,
  } = useChatStore();
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (visible) {
      fetchAvailableUsers();
    }
  }, [visible]);

  const filteredUsers = availableUsers.filter((user) =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet" // 1. Đổi thành pageSheet thay vì transparent
      onRequestClose={onClose}      // Bắt sự kiện vuốt xuống hoặc nút back Android
    >
      {/* 2. Đưa KeyboardAvoidingView ra ngoài cùng để quản lý không gian khi gõ phím */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        {/* 3. Dùng SafeAreaView bọc nội dung, bỏ overlay dư thừa */}
        <SafeAreaView
          style={[styles.newChatContainer, { flex: 1, backgroundColor: '#FFFFFF' }]}
          edges={['top', 'bottom']}
        >
          {/* Header */}
          <View style={styles.newChatHeader}>
            <Text style={styles.newChatTitle}>Tin nhắn mới</Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }} // 4. Thêm hitSlop để dễ bấm
            >
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Search Input */}
          <View style={styles.newChatSearch}>
            <Ionicons name="search" size={20} color="#9CA3AF" />
            <TextInput
              style={styles.newChatSearchInput}
              placeholder="Tìm kiếm người dùng..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#9CA3AF"
              autoFocus={false} // Mẹo: Đặt true nếu muốn mở modal lên là bàn phím bật sẵn
            />
          </View>

          {/* Danh sách User */}
          {isLoading ? (
            <ActivityIndicator
              size="large"
              color="#3B82F6"
              style={{ marginTop: 20 }}
            />
          ) : (
            <FlatList
              data={filteredUsers}
              keyExtractor={(item) => item._id}
              keyboardShouldPersistTaps="handled" // 5. Cho phép click item ngay cả khi bàn phím đang bật
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.userItem}
                  onPress={() => {
                    onSelectUser(item);
                    onClose();
                  }}
                >
                  <View style={styles.userAvatarContainer}>
                    <LinearGradient
                      colors={
                        onlineUsers.includes(item._id)
                          ? getRoleColors(item.role)
                          : (["#9CA3AF", "#6B7280"] as [string, string])
                      }
                      style={styles.userAvatar}
                    >
                      <Text style={styles.userAvatarText}>
                        {item.name.charAt(0).toUpperCase()}
                      </Text>
                    </LinearGradient>
                    {onlineUsers.includes(item._id) && (
                      <View style={styles.onlineDot} />
                    )}
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{item.name}</Text>
                    <Text style={styles.userRole}>
                      {getRoleLabel(item.role)}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyUsers}>
                  <Text style={styles.emptyUsersText}>
                    Không tìm thấy người dùng
                  </Text>
                </View>
              }
            />
          )}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

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
      <SafeAreaView style={styles.incidentModalContainer}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          {/* Header */}
          <View style={styles.incidentModalHeader}>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.incidentCloseBtn}
            >
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
            <Text style={styles.incidentModalTitle}>Báo cáo sự cố</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView
            style={styles.incidentModalContent}
            contentContainerStyle={styles.incidentModalContentInner}
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
                  hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                >
                  <Ionicons name="arrow-back" size={20} color="#3B82F6" />
                  <Text style={styles.backStepButtonText}>Quay lại</Text>
                </TouchableOpacity>

                <View style={styles.selectedTypePreview}>
                  <LinearGradient
                    colors={["#3B82F6", "#2563EB"]}
                    style={styles.selectedTypeIcon}
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
                        <Text style={styles.submitButtonText}>
                          Gửi báo cáo
                        </Text>
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
      <SafeAreaView style={styles.incidentModalContainer}>
        <View style={styles.incidentModalHeader}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.incidentCloseBtn}
          >
            <Ionicons name="close" size={24} color="#6B7280" />
          </TouchableOpacity>
          <Text style={styles.incidentModalTitle}>Chi tiết sự cố</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.incidentModalContent}
          contentContainerStyle={styles.incidentModalContentInner}
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
                style={[
                  styles.detailStatusText,
                  { color: statusColors.text },
                ]}
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
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color="#10B981"
                />
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

// ============ INCIDENTS LIST MODAL ============

function IncidentsListModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
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
    if (visible) {
      fetchMyIncidents();
    }
  }, [visible]);

  const handleReportSubmit = async (
    type: IncidentType,
    description: string,
  ) => {
    try {
      await createIncident({ type, description, platform: "mobile" });
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
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.incidentModalContainer}>
        {/* Header */}
        <View style={styles.incidentModalHeader}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.incidentCloseBtn}
          >
            <Ionicons name="close" size={24} color="#6B7280" />
          </TouchableOpacity>
          <Text style={styles.incidentModalTitle}>Báo cáo sự cố</Text>
          <TouchableOpacity
            onPress={() => setShowReportModal(true)}
            style={styles.incidentAddBtn}
          >
            <Ionicons name="add-circle" size={28} color="#8B5CF6" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={fetchMyIncidents}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Summary */}
          <LinearGradient
            colors={["#8B5CF6", "#7C3AED"]}
            style={styles.incidentSummaryCard}
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
                      activeFilter === filter.key &&
                      styles.filterBadgeActive,
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
          <View style={styles.incidentListContent}>
            {filteredIncidents.length === 0 ? (
              <View style={styles.emptyState}>
                <LinearGradient
                  colors={["#F3F4F6", "#E5E7EB"]}
                  style={styles.emptyIcon}
                >
                  <Ionicons
                    name="checkmark-circle"
                    size={48}
                    color="#10B981"
                  />
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
                        <Ionicons
                          name="chatbubble"
                          size={12}
                          color="#3B82F6"
                        />
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
    </Modal>
  );
}

// ============ MAIN SCREEN ============

export default function ChatScreen() {
  const { user, accessToken } = useAuthStore();
  const {
    conversations,
    fetchConversations,
    initializeSocket,
    onlineUsers,
    isLoading,
  } = useChatStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showChatDetail, setShowChatDetail] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);
  const [showIncidentsList, setShowIncidentsList] = useState(false);

  useEffect(() => {
    if (accessToken) {
      initializeSocket(accessToken);
      fetchConversations();
    }
  }, [accessToken]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchConversations();
    setRefreshing(false);
  }, []);

  const handleOpenChat = (conversation: Conversation) => {
    setSelectedUser({
      _id: conversation.otherUser._id,
      name: conversation.otherUser.name,
      role: conversation.otherUser.role,
      isOnline: onlineUsers.includes(conversation.otherUser._id),
    });
    setShowChatDetail(true);
  };

  const handleSelectNewUser = (chatUser: ChatUser) => {
    setSelectedUser(chatUser);
    setShowChatDetail(true);
  };

  const filteredConversations = conversations.filter((conv) =>
    conv.otherUser.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase()),
  );

  const totalUnread = conversations.reduce(
    (sum, conv) => sum + (conv.unreadCount || 0),
    0,
  );

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Tin nhắn</Text>
          {totalUnread > 0 && (
            <View style={styles.headerUnreadBadge}>
              <Text style={styles.headerUnreadText}>
                {totalUnread > 99 ? "99+" : totalUnread}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => setShowIncidentsList(true)}
          >
            <Ionicons name="warning-outline" size={22} color="#F59E0B" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => setShowNewChat(true)}
          >
            <Ionicons name="create-outline" size={22} color="#3B82F6" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchWrapper}>
          <Ionicons name="search" size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Tìm kiếm cuộc trò chuyện..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9CA3AF"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Conversations List */}
      {isLoading && conversations.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : filteredConversations.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={64} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>Chưa có cuộc trò chuyện</Text>
          <Text style={styles.emptySubtitle}>
            Nhấn nút ✏️ để bắt đầu trò chuyện mới
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          <View style={styles.listContainer}>
            {filteredConversations.map((conv) => {
              const isOnline = onlineUsers.includes(conv.otherUser._id);
              return (
                <TouchableOpacity
                  key={conv._id}
                  style={styles.chatItem}
                  onPress={() => handleOpenChat(conv)}
                  activeOpacity={0.7}
                >
                  <View style={styles.avatarContainer}>
                    <LinearGradient
                      colors={
                        isOnline
                          ? getRoleColors(conv.otherUser.role)
                          : (["#9CA3AF", "#6B7280"] as [string, string])
                      }
                      style={styles.avatar}
                    >
                      <Text style={styles.avatarText}>
                        {conv.otherUser.name.charAt(0).toUpperCase()}
                      </Text>
                    </LinearGradient>
                    {isOnline && <View style={styles.onlineBadge} />}
                  </View>

                  <View style={styles.chatContent}>
                    <View style={styles.chatItemHeader}>
                      <Text style={styles.chatName} numberOfLines={1}>
                        {conv.otherUser.name}
                      </Text>
                      <Text style={styles.chatTime}>
                        {conv.lastMessage
                          ? formatTime(conv.lastMessage.createdAt)
                          : ""}
                      </Text>
                    </View>
                    <View style={styles.chatFooter}>
                      <Text
                        style={[
                          styles.lastMessage,
                          conv.unreadCount > 0 && styles.lastMessageUnread,
                        ]}
                        numberOfLines={1}
                      >
                        {conv.lastMessage ? (
                          <>
                            {(() => {
                              const senderId = conv.lastMessage.senderId;
                              const currentUserId = user?._id;
                              const sId = typeof senderId === 'string' ? senderId : (senderId?._id || (senderId as any)?.$oid);
                              const uId = typeof currentUserId === 'string' ? currentUserId : (currentUserId as any)?.$oid;
                              return sId === uId ? "Bạn: " : "";
                            })()}
                            {conv.lastMessage.content}
                          </>
                        ) : "Chưa có tin nhắn"}
                      </Text>
                      {conv.unreadCount > 0 && (
                        <View style={styles.unreadBadge}>
                          <Text style={styles.unreadText}>
                            {conv.unreadCount}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}

      {/* Modals */}
      <NewChatModal
        visible={showNewChat}
        onClose={() => setShowNewChat(false)}
        onSelectUser={handleSelectNewUser}
      />

      <ChatDetailModal
        visible={showChatDetail}
        onClose={() => {
          setShowChatDetail(false);
          setSelectedUser(null);
        }}
        recipient={selectedUser}
      />

      <IncidentsListModal
        visible={showIncidentsList}
        onClose={() => setShowIncidentsList(false)}
      />
    </SafeAreaView>
  );
}

// ============ STYLES ============

const styles = StyleSheet.create({
  // Main container
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1F2937",
  },
  headerUnreadBadge: {
    backgroundColor: "#EF4444",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    minWidth: 24,
    alignItems: "center",
  },
  headerUnreadText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "bold",
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  headerBtn: {
    padding: 8,
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  searchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
    color: "#1F2937",
  },
  scrollView: {
    flex: 1,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  chatItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  avatarContainer: {
    position: "relative",
    marginRight: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "bold",
  },
  onlineBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#10B981",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  chatContent: {
    flex: 1,
    justifyContent: "center",
  },
  chatItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  chatName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1F2937",
    flex: 1,
    marginRight: 8,
  },
  chatTime: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  chatFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  lastMessage: {
    fontSize: 14,
    color: "#6B7280",
    flex: 1,
    marginRight: 16,
  },
  lastMessageUnread: {
    color: "#1F2937",
    fontWeight: "600",
  },
  unreadBadge: {
    backgroundColor: "#EF4444",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "bold",
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

  // Chat Detail Modal
  modalContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  chatDetailHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  headerBackBtn: {
    padding: 8,
    marginRight: 8,
  },
  chatDetailInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  chatAvatarWrapper: {
    position: "relative",
    marginRight: 12,
  },
  chatDetailAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  chatDetailAvatarText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  chatOnlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#10B981",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  chatDetailName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
  },
  chatDetailRole: {
    fontSize: 12,
    color: "#6B7280",
  },
  messagesContainer: {
    flex: 1,
  },
  messagesList: {
    padding: 16,
  },
  messageContainer: {
    marginBottom: 12,
  },
  ownMessage: {
    alignItems: "flex-end",
  },
  otherMessage: {
    alignItems: "flex-start",
  },
  messageBubble: {
    maxWidth: "80%",
    padding: 12,
    borderRadius: 16,
  },
  ownBubble: {
    backgroundColor: "#3B82F6",
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: "#FFFFFF",
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    color: "#1F2937",
  },
  ownMessageText: {
    color: "#FFFFFF",
  },
  messageTime: {
    fontSize: 10,
    color: "#9CA3AF",
    marginTop: 4,
  },
  ownMessageTime: {
    color: "rgba(255,255,255,0.7)",
  },
  typingIndicator: {
    padding: 16,
    paddingTop: 0,
  },
  typingText: {
    fontSize: 12,
    color: "#9CA3AF",
    fontStyle: "italic",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  chatInput: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    color: "#1F2937",
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: "#E5E7EB",
  },
  emptyMessages: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyMsgText: {
    fontSize: 16,
    color: "#6B7280",
    marginTop: 12,
  },
  emptyMsgSubtext: {
    fontSize: 14,
    color: "#9CA3AF",
    marginTop: 4,
  },

  // New Chat Modal
  newChatOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  newChatContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    paddingBottom: 20,
  },
  newChatHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  newChatTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1F2937",
  },
  newChatSearch: {
    flexDirection: "row",
    alignItems: "center",
    margin: 16,
    padding: 12,
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
  },
  newChatSearchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
    color: "#1F2937",
  },
  userItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    marginHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  userAvatarContainer: {
    position: "relative",
    marginRight: 12,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  userAvatarText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
  },
  onlineDot: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#10B981",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
  },
  userRole: {
    fontSize: 13,
    color: "#6B7280",
  },
  emptyUsers: {
    padding: 40,
    alignItems: "center",
  },
  emptyUsersText: {
    fontSize: 14,
    color: "#9CA3AF",
  },

  // Incident Modal Styles
  incidentModalContainer: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  incidentModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  incidentCloseBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  incidentAddBtn: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  incidentModalTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#111827",
  },
  incidentModalContent: {
    flex: 1,
  },
  incidentModalContentInner: {
    padding: 20,
  },
  incidentSummaryCard: {
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
  incidentListContent: {
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

  // Report Modal Styles
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
  selectedTypeIcon: {
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

  // Detail Modal Styles
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
