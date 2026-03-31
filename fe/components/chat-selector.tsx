"use client";
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Search, MessageCircle, User, Users } from "lucide-react";
import { useChatStore } from "@/lib/stores/chat-store";

interface ChatTargetUser {
  _id: string;
  name: string;
  role: string;
}

interface ConversationItem {
  _id: string;
  otherUser: ChatTargetUser;
  unreadCount: number;
  lastMessage?: {
    content?: string;
  };
}

interface ChatSelectorProps {
  onSelectUser: (user: ChatTargetUser) => void;
  onClose: () => void;
}

export default function ChatSelector({
  onSelectUser,
  onClose,
}: ChatSelectorProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"conversations" | "users">(
    "conversations",
  );

  const {
    conversations,
    availableUsers,
    onlineUsers,
    fetchConversations,
    fetchAvailableUsers,
    isLoading,
  } = useChatStore();

  useEffect(() => {
    fetchConversations();
    fetchAvailableUsers();
  }, [fetchConversations, fetchAvailableUsers]);

  const filteredConversations = conversations.filter((conv) =>
    conv.otherUser.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const filteredUsers = availableUsers.filter((user) =>
    user.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const handleSelectConversation = (conversation: ConversationItem) => {
    onSelectUser(conversation.otherUser);
    onClose();
  };

  const handleSelectUser = (user: ChatTargetUser) => {
    onSelectUser(user);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-white/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Chọn người để chat</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Search */}
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Tìm kiếm..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab("conversations")}
            className={`flex-1 px-4 py-2 text-sm font-medium ${
              activeTab === "conversations"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <MessageCircle className="w-4 h-4 inline mr-2" />
            Cuộc trò chuyện
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`flex-1 px-4 py-2 text-sm font-medium ${
              activeTab === "users"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            Tất cả người dùng
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-gray-500">Đang tải...</div>
          ) : activeTab === "conversations" ? (
            <div className="p-2">
              {filteredConversations.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  <MessageCircle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p>Chưa có cuộc trò chuyện nào</p>
                  <p className="text-sm">Hãy bắt đầu chat với ai đó!</p>
                </div>
              ) : (
                filteredConversations.map((conversation) => (
                  <div
                    key={conversation._id}
                    onClick={() =>
                      handleSelectConversation(conversation as ConversationItem)
                    }
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white">
                        <User className="w-5 h-5" />
                      </div>
                      {onlineUsers.includes(conversation.otherUser._id) && (
                        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-gray-900 truncate">
                          {conversation.otherUser.name}
                        </p>
                        {conversation.unreadCount > 0 && (
                          <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-5 text-center">
                            {conversation.unreadCount}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 capitalize">
                        {conversation.otherUser.role}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {conversation.lastMessage?.content ||
                          "Không có tin nhắn"}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="p-2">
              {filteredUsers.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  <Users className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p>Không tìm thấy người dùng nào</p>
                </div>
              ) : (
                filteredUsers.map((user) => (
                  <div
                    key={user._id}
                    onClick={() => handleSelectUser(user as ChatTargetUser)}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-linear-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white">
                        <User className="w-5 h-5" />
                      </div>
                      {onlineUsers.includes(user._id) && (
                        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{user.name}</p>
                      <p className="text-sm text-gray-500 capitalize flex items-center gap-2">
                        {user.role}
                        {onlineUsers.includes(user._id) && (
                          <span className="text-green-500 text-xs">
                            ● Online
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
