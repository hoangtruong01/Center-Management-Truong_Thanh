import { create } from "zustand";
import { api } from "../api";
import socketService from "../socket";

interface Message {
  _id: string;
  senderId: {
    _id: string;
    name: string;
    role: string;
  };
  receiverId: {
    _id: string;
    name: string;
    role: string;
  };
  content: string;
  createdAt: string;
  isRead?: boolean;
}

interface Conversation {
  _id: string;
  otherUser: {
    _id: string;
    name: string;
    role: string;
  };
  lastMessage: Message;
  unreadCount: number;
}

interface ChatUser {
  _id: string;
  name: string;
  role: string;
  isOnline?: boolean;
}

interface ChatState {
  conversations: Conversation[];
  messages: { [conversationId: string]: Message[] };
  currentConversation: string | null;
  availableUsers: ChatUser[];
  onlineUsers: string[];
  typingUsers: { [userId: string]: boolean };
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchConversations: () => Promise<void>;
  fetchMessages: (otherUserId: string) => Promise<void>;
  sendMessage: (receiverId: string, content: string) => Promise<void>;
  setCurrentConversation: (conversationId: string | null) => void;
  fetchAvailableUsers: () => Promise<void>;
  addMessage: (message: Message) => void;
  setUserTyping: (userId: string, isTyping: boolean) => void;
  setUserOnline: (userId: string, isOnline: boolean) => void;
  initializeSocket: (token: string) => void;
  disconnectSocket: () => void;
}

const isMessagePayload = (value: unknown): value is Message => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Message>;
  return (
    typeof candidate._id === "string" &&
    typeof candidate.content === "string" &&
    typeof candidate.createdAt === "string"
  );
};

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  messages: {},
  currentConversation: null,
  availableUsers: [],
  onlineUsers: [],
  typingUsers: {},
  isLoading: false,
  error: null,

  fetchConversations: async () => {
    try {
      set({ isLoading: true, error: null });
      const response = await api.get("/chat/conversations");
      set({ conversations: response.data, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  fetchMessages: async (otherUserId: string) => {
    try {
      set({ isLoading: true, error: null });
      const response = await api.get(`/chat/messages?with=${otherUserId}`);
      const messages = response.data;

      set((state) => ({
        messages: {
          ...state.messages,
          [otherUserId]: messages,
        },
        isLoading: false,
      }));
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  sendMessage: async (receiverId: string, content: string) => {
    try {
      // Send via socket for real-time
      socketService.sendMessage(receiverId, content);

      // Also send via HTTP as backup
      await api.post("/chat/messages", { receiverId, content });

      // Refresh messages for this conversation after a short delay
      setTimeout(() => {
        get().fetchMessages(receiverId);
      }, 500);
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  setCurrentConversation: (conversationId: string | null) => {
    const state = get();

    // Leave previous conversation
    if (state.currentConversation) {
      socketService.leaveConversation(state.currentConversation);
    }

    // Join new conversation
    if (conversationId) {
      socketService.joinConversation(conversationId);
    }

    set({ currentConversation: conversationId });
  },

  fetchAvailableUsers: async () => {
    try {
      set({ isLoading: true, error: null });
      const response = await api.get("/chat/available-users");
      const users = response.data.map((user: any) => ({
        ...user,
        isOnline: get().onlineUsers.includes(user._id),
      }));
      set({ availableUsers: users, isLoading: false });
    } catch (error: any) {
      set({ error: error.message, isLoading: false });
    }
  },

  addMessage: (message: Message) => {
    // Determine which user this message belongs to in the messages object
    // We need to check both sender and receiver to find the "other" user
    const state = get();
    const currentConversation = state.currentConversation;

    let otherUserId: string;

    if (currentConversation) {
      // If we have a current conversation, use that
      otherUserId = currentConversation;
    } else {
      // Otherwise, try to determine from the message
      // This is a fallback - we'll use the sender ID if it's not us, otherwise receiver ID
      otherUserId = message.senderId._id;
    }

    set((state) => ({
      messages: {
        ...state.messages,
        [otherUserId]: [...(state.messages[otherUserId] || []), message],
      },
    }));

    // Update conversation list
    get().fetchConversations();
  },

  setUserTyping: (userId: string, isTyping: boolean) => {
    set((state) => ({
      typingUsers: {
        ...state.typingUsers,
        [userId]: isTyping,
      },
    }));
  },

  setUserOnline: (userId: string, isOnline: boolean) => {
    set((state) => {
      const onlineUsers = isOnline
        ? [...state.onlineUsers.filter((id) => id !== userId), userId]
        : state.onlineUsers.filter((id) => id !== userId);

      const availableUsers = state.availableUsers.map((user) =>
        user._id === userId ? { ...user, isOnline } : user,
      );

      return { onlineUsers, availableUsers };
    });
  },

  initializeSocket: (token: string) => {
    const socket = socketService.connect(token);

    if (socket) {
      // Listen for new messages
      socketService.onNewMessage((message: unknown) => {
        if (isMessagePayload(message)) {
          get().addMessage(message);
        }
      });

      // Listen for sent message confirmation
      socketService.onMessageSent((message: unknown) => {
        if (isMessagePayload(message)) {
          get().addMessage(message);
        }
      });

      // Listen for typing events
      socketService.onUserTyping((data) => {
        get().setUserTyping(data.userId, data.isTyping);
      });

      // Listen for online/offline events
      socketService.onUserOnline((data) => {
        get().setUserOnline(data.userId, true);
      });

      socketService.onUserOffline((data) => {
        get().setUserOnline(data.userId, false);
      });
    }
  },

  disconnectSocket: () => {
    socketService.disconnect();
    set({ onlineUsers: [], typingUsers: {} });
  },
}));
