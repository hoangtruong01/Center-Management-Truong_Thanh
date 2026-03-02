"use client";
import { useState, useRef, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { X, Send, User } from "lucide-react";
import { useChatStore } from "@/lib/stores/chat-store";
import { useAuthStore } from "@/lib/stores/auth-store";

interface ChatWindowProps {
  recipient?: {
    _id: string;
    name: string;
    role: string;
  };
  // Legacy props for backward compatibility
  recipientName?: string;
  recipientRole?: string;
  currentUserName?: string;
  onClose: () => void;
}

export default function ChatWindow({
  recipient,
  recipientName,
  recipientRole,
  onClose,
}: ChatWindowProps) {
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>(undefined);

  const { user: currentUser } = useAuthStore();
  const {
    messages,
    typingUsers,
    onlineUsers,
    fetchMessages,
    sendMessage,
    setCurrentConversation,
  } = useChatStore();

  // Support both new recipient object and legacy props
  const recipientId = recipient?._id;
  const displayName = recipient?.name || recipientName || "Unknown";
  const displayRole = recipient?.role || recipientRole || "user";

  const conversationMessages = recipientId ? messages[recipientId] || [] : [];
  const isRecipientOnline = recipientId
    ? onlineUsers.includes(recipientId)
    : false;
  const isRecipientTyping = recipientId ? typingUsers[recipientId] : false;

  useEffect(() => {
    // Set current conversation and fetch messages only if we have a valid recipient ID
    if (recipientId) {
      setCurrentConversation(recipientId);
      fetchMessages(recipientId);
    }

    return () => {
      setCurrentConversation(null);
    };
  }, [recipientId, setCurrentConversation, fetchMessages]);

  // Auto scroll to bottom when new message arrives
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversationMessages, isRecipientTyping]);

  const handleSend = async () => {
    if (!text.trim() || isSending || !recipientId) return;

    setIsSending(true);
    try {
      await sendMessage(recipientId, text.trim());
      setText("");
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);

    // Handle typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Send typing start
    // socketService.setTyping(recipient._id, true);

    // Set timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      // socketService.setTyping(recipient._id, false);
    }, 1000);
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 w-full max-w-sm md:max-w-md lg:max-w-lg sm:bottom-0 sm:right-0 sm:max-w-none sm:h-screen sm:rounded-none">
      <Card className="p-4 sm:p-5 shadow-2xl sm:h-full sm:flex sm:flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shrink-0">
                <User className="w-6 h-6" />
              </div>
              {isRecipientOnline && (
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
              )}
            </div>
            <div>
              <p className="font-semibold text-gray-900">{displayName}</p>
              <p className="text-xs text-gray-500 capitalize flex items-center gap-2">
                {displayRole}
                {isRecipientOnline && (
                  <span className="text-green-500">● Online</span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors shrink-0"
            title="Đóng"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Messages */}
        <div className="min-h-64 max-h-96 sm:flex-1 sm:max-h-none overflow-y-auto mb-4 space-y-3">
          {!recipientId ? (
            <div className="text-center py-8 text-gray-400">
              <p className="font-medium">Không thể trò chuyện</p>
              <p className="text-sm">
                Vui lòng chọn người nhận từ danh sách chat
              </p>
            </div>
          ) : conversationMessages.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p className="font-medium">Chưa có tin nhắn nào</p>
              <p className="text-sm">Bắt đầu trò chuyện nhé!</p>
            </div>
          ) : (
            conversationMessages.map((msg) => {
              // Handle both populated senderId object and string ID
              const senderId =
                typeof msg.senderId === "object"
                  ? msg.senderId?._id
                  : msg.senderId;
              const isMe = senderId === currentUser?._id;
              return (
                <div
                  key={msg._id}
                  className={`flex items-end gap-2 ${
                    isMe ? "flex-row-reverse" : ""
                  }`}
                >
                  {/* Avatar */}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                      isMe
                        ? "bg-linear-to-br from-green-500 to-emerald-600 text-white"
                        : "bg-linear-to-br from-blue-500 to-indigo-600 text-white"
                    }`}
                  >
                    {(isMe ? currentUser?.name : displayName)
                      ?.charAt(0)
                      .toUpperCase()}
                  </div>

                  {/* Message bubble */}
                  <div
                    className={`max-w-[70%] ${
                      isMe ? "items-end" : "items-start"
                    } flex flex-col gap-1`}
                  >
                    <div
                      className={`px-4 py-2 rounded-2xl ${
                        isMe
                          ? "bg-green-500 text-white rounded-br-none"
                          : "bg-gray-100 text-gray-900 rounded-bl-none"
                      }`}
                    >
                      <p className="text-sm wrap-break-word whitespace-pre-wrap">
                        {msg.content}
                      </p>
                    </div>
                    <p className="text-xs text-gray-400 px-2">
                      {formatTime(msg.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })
          )}

          {/* Typing indicator */}
          {isRecipientTyping && (
            <div className="flex items-end gap-2">
              <div className="w-8 h-8 rounded-full bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-xs font-semibold text-white">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div className="bg-gray-100 rounded-2xl rounded-bl-none px-4 py-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.1s" }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="flex gap-2 items-end">
          <Textarea
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder="Nhập tin nhắn... (Enter để gửi, Shift+Enter để xuống dòng)"
            className="flex-1 resize-none min-h-10 max-h-30"
            rows={1}
          />
          <Button
            onClick={handleSend}
            disabled={!text.trim() || isSending}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 shrink-0"
            title="Gửi tin nhắn"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}
