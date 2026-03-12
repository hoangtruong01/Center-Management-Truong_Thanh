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
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore, useChatStore, Conversation, Message, ChatUser } from "@/lib/stores";
import { LinearGradient } from "expo-linear-gradient";

// Format time for display
const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
    } else if (diffDays === 1) {
        return "Hôm qua";
    } else if (diffDays < 7) {
        const days = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
        return days[date.getDay()];
    } else {
        return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
    }
};

// Get role label
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

// Chat Detail Modal
function ChatDetailModal({
    visible,
    onClose,
    recipient,
    safeTop,
    safeBottom,
}: {
    visible: boolean;
    onClose: () => void;
    recipient: ChatUser | null;
    safeTop: number;
    safeBottom: number;
}) {
    const { user, accessToken } = useAuthStore();
    const {
        messages,
        fetchMessages,
        sendMessage,
        setCurrentConversation,
        initializeSocket,
        typingUsers,
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

    const conversationMessages = recipient ? messages[recipient._id] || [] : [];

    const handleSend = async () => {
        if (!inputText.trim() || !recipient) return;

        await sendMessage(recipient._id, inputText.trim());
        setInputText("");
    };

    const renderMessage = ({ item }: { item: Message }) => {
        const isOwnMessage = item.senderId._id === user?._id;

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
                    <Text style={[styles.messageText, isOwnMessage && styles.ownMessageText]}>
                        {item.content}
                    </Text>
                    <Text style={[styles.messageTime, isOwnMessage && styles.ownMessageTime]}>
                        {formatTime(item.createdAt)}
                    </Text>
                </View>
            </View>
        );
    };

    if (!recipient) return null;

    const bottomPadding = Math.max(safeBottom, 12);
    // Header height: paddingVertical(16) * 2 + avatar(40) + safeTop
    const headerOffset = Platform.OS === 'ios' ? safeTop + 72 : 0;

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <SafeAreaView style={styles.modalContainer}>
                {/* Header - outside KeyboardAvoidingView */}
                <View style={[styles.chatDetailHeader, { paddingVertical: Platform.OS === 'ios' ? 16 : 12 }]}>
                    <TouchableOpacity
                        onPress={onClose}
                        style={styles.backButton}
                        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                    >
                        <Ionicons name="arrow-back" size={24} color="#1F2937" />
                    </TouchableOpacity>
                    <View style={styles.chatDetailInfo}>
                        <LinearGradient
                            colors={["#3B82F6", "#2563EB"]}
                            style={styles.chatDetailAvatar}
                        >
                            <Text style={styles.chatDetailAvatarText}>
                                {recipient.name.charAt(0).toUpperCase()}
                            </Text>
                        </LinearGradient>
                        <View>
                            <Text style={styles.chatDetailName}>{recipient.name}</Text>
                            <Text style={styles.chatDetailRole}>{getRoleLabel(recipient.role)}</Text>
                        </View>
                    </View>
                </View>

                {/* Messages + Input wrapped in KeyboardAvoidingView */}
                <KeyboardAvoidingView
                    style={styles.messagesContainer}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    keyboardVerticalOffset={headerOffset}
                >
                    {isLoading && conversationMessages.length === 0 ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color="#3B82F6" />
                        </View>
                    ) : conversationMessages.length === 0 ? (
                        <View style={styles.emptyMessages}>
                            <Ionicons name="chatbubbles-outline" size={64} color="#D1D5DB" />
                            <Text style={styles.emptyText}>Chưa có tin nhắn</Text>
                            <Text style={styles.emptySubtext}>Hãy gửi tin nhắn đầu tiên!</Text>
                        </View>
                    ) : (
                        <FlatList
                            ref={scrollViewRef}
                            data={conversationMessages}
                            renderItem={renderMessage}
                            keyExtractor={(item) => item._id}
                            contentContainerStyle={styles.messagesList}
                            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd()}
                            keyboardDismissMode="interactive"
                            keyboardShouldPersistTaps="handled"
                        />
                    )}

                    {/* Typing indicator */}
                    {recipient && typingUsers[recipient._id] && (
                        <View style={styles.typingIndicator}>
                            <Text style={styles.typingText}>{recipient.name} đang nhập...</Text>
                        </View>
                    )}

                    {/* Input */}
                    <View style={[styles.inputContainer, { paddingBottom: bottomPadding }]}>
                        <TextInput
                            style={styles.chatInput}
                            placeholder="Nhập tin nhắn..."
                            value={inputText}
                            onChangeText={setInputText}
                            multiline
                            placeholderTextColor="#9CA3AF"
                        />
                        <TouchableOpacity
                            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
                            onPress={handleSend}
                            disabled={!inputText.trim()}
                        >
                            <Ionicons name="send" size={20} color={inputText.trim() ? "#FFFFFF" : "#9CA3AF"} />
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </Modal>
    );
}

// New Chat Modal - Select user to chat with
function NewChatModal({
    visible,
    onClose,
    onSelectUser,
}: {
    visible: boolean;
    onClose: () => void;
    onSelectUser: (user: ChatUser) => void;
}) {
    const { availableUsers, fetchAvailableUsers, isLoading, onlineUsers } = useChatStore();
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        if (visible) {
            fetchAvailableUsers();
        }
    }, [visible]);

    const filteredUsers = availableUsers.filter((user) =>
        user.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={styles.newChatOverlay}>
                <View style={styles.newChatContainer}>
                    <View style={styles.newChatHeader}>
                        <Text style={styles.newChatTitle}>Tin nhắn mới</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color="#6B7280" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.newChatSearch}>
                        <Ionicons name="search" size={20} color="#9CA3AF" />
                        <TextInput
                            style={styles.newChatSearchInput}
                            placeholder="Tìm kiếm người dùng..."
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            placeholderTextColor="#9CA3AF"
                        />
                    </View>

                    {isLoading ? (
                        <ActivityIndicator size="large" color="#3B82F6" style={{ marginTop: 20 }} />
                    ) : (
                        <FlatList
                            data={filteredUsers}
                            keyExtractor={(item) => item._id}
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
                                                    ? ["#10B981", "#059669"]
                                                    : ["#9CA3AF", "#6B7280"]
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
                                        <Text style={styles.userRole}>{getRoleLabel(item.role)}</Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                            ListEmptyComponent={
                                <View style={styles.emptyUsers}>
                                    <Text style={styles.emptyUsersText}>Không tìm thấy người dùng</Text>
                                </View>
                            }
                        />
                    )}
                </View>
            </View>
        </Modal>
    );
}

export default function ContactScreen() {
    const { user, accessToken } = useAuthStore();
    const insets = useSafeAreaInsets();
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

    const handleSelectNewUser = (user: ChatUser) => {
        setSelectedUser(user);
        setShowChatDetail(true);
    };

    const filteredConversations = conversations.filter((conv) =>
        conv.otherUser.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'ios' ? 16 : 24) }]}>
                <Text style={styles.headerTitle}>Tin nhắn</Text>
                <TouchableOpacity style={styles.headerIcon} onPress={() => setShowNewChat(true)}>
                    <Ionicons name="create-outline" size={24} color="#3B82F6" />
                </TouchableOpacity>
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
                        Nhấn nút + để bắt đầu trò chuyện mới
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
                        {filteredConversations.map((conv) => (
                            <TouchableOpacity
                                key={conv._id}
                                style={styles.chatItem}
                                onPress={() => handleOpenChat(conv)}
                                activeOpacity={0.7}
                            >
                                <View style={styles.avatarContainer}>
                                    <LinearGradient
                                        colors={
                                            onlineUsers.includes(conv.otherUser._id)
                                                ? ["#10B981", "#059669"]
                                                : ["#9CA3AF", "#6B7280"]
                                        }
                                        style={styles.avatar}
                                    >
                                        <Text style={styles.avatarText}>
                                            {conv.otherUser.name.charAt(0).toUpperCase()}
                                        </Text>
                                    </LinearGradient>
                                    {onlineUsers.includes(conv.otherUser._id) && (
                                        <View style={styles.onlineBadge} />
                                    )}
                                </View>

                                <View style={styles.chatContent}>
                                    <View style={styles.chatHeader}>
                                        <Text style={styles.chatName} numberOfLines={1}>
                                            {conv.otherUser.name}
                                        </Text>
                                        <Text style={styles.chatTime}>
                                            {conv.lastMessage ? formatTime(conv.lastMessage.createdAt) : ""}
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
                                            {conv.lastMessage?.content || "Chưa có tin nhắn"}
                                        </Text>
                                        {conv.unreadCount > 0 && (
                                            <View style={styles.unreadBadge}>
                                                <Text style={styles.unreadText}>{conv.unreadCount}</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                </ScrollView>
            )}

            {/* New Chat Modal */}
            <NewChatModal
                visible={showNewChat}
                onClose={() => setShowNewChat(false)}
                onSelectUser={handleSelectNewUser}
            />

            {/* Chat Detail Modal */}
            <ChatDetailModal
                visible={showChatDetail}
                onClose={() => {
                    setShowChatDetail(false);
                    setSelectedUser(null);
                }}
                recipient={selectedUser}
                safeTop={insets.top}
                safeBottom={insets.bottom}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#FFFFFF",
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 20,
        paddingBottom: 16,
        backgroundColor: "#FFFFFF",
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: "bold",
        color: "#1F2937",
    },
    headerIcon: {
        padding: 8,
        backgroundColor: "#EFF6FF",
        borderRadius: 12,
    },
    searchContainer: {
        paddingHorizontal: 20,
        paddingBottom: 16,
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
    chatHeader: {
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

    // Modal styles
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
    },
    backButton: {
        padding: 8,
        marginRight: 8,
    },
    chatDetailInfo: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
    },
    chatDetailAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 12,
    },
    chatDetailAvatarText: {
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "bold",
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
        backgroundColor: "#F3F4F6",
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
    emptyText: {
        fontSize: 16,
        color: "#6B7280",
        marginTop: 12,
    },
    emptySubtext: {
        fontSize: 14,
        color: "#9CA3AF",
        marginTop: 4,
    },

    // New Chat Modal styles
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
});
