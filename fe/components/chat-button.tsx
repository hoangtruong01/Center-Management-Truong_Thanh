"use client";
import { useState, useEffect } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import ChatSelector from "./chat-selector";
import ChatWindow from "./chat-window";
import { useChatStore } from "@/lib/stores/chat-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import socketService from "@/lib/socket";
import { usePaymentRequestsStore } from "@/lib/stores/payment-requests-store";
import { usePaymentsStore } from "@/lib/stores/payments-store";

interface ChatRecipient {
  _id: string;
  name: string;
  role: string;
}

export default function ChatButton() {
  const [showSelector, setShowSelector] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ChatRecipient | null>(null);

  const { initializeSocket, disconnectSocket, conversations } = useChatStore();
  const { user, accessToken } = useAuthStore();
  const { fetchMyRequests, fetchChildrenRequests } = usePaymentRequestsStore();
  const { fetchMyPayments } = usePaymentsStore();

  // Initialize socket when user is authenticated
  useEffect(() => {
    if (user && accessToken) {
      initializeSocket(accessToken);
    }

    return () => {
      disconnectSocket();
    };
  }, [user, accessToken, initializeSocket, disconnectSocket]);

  useEffect(() => {
    if (!user || !accessToken) {
      return;
    }

    const handlePaymentStatusUpdated = () => {
      if (user.role === "student") {
        void fetchMyRequests();
      } else if (user.role === "parent") {
        void fetchChildrenRequests();
      }
      void fetchMyPayments();
    };

    socketService.onPaymentStatusUpdated(handlePaymentStatusUpdated);

    return () => {
      socketService.off("paymentStatusUpdated", handlePaymentStatusUpdated);
    };
  }, [
    user,
    accessToken,
    fetchMyRequests,
    fetchChildrenRequests,
    fetchMyPayments,
  ]);

  const handleSelectUser = (user: ChatRecipient) => {
    setSelectedUser(user);
    setShowSelector(false);
  };

  const handleCloseChat = () => {
    setSelectedUser(null);
  };

  const handleOpenSelector = () => {
    setShowSelector(true);
  };

  // Don't show chat button if user is not authenticated or is admin
  if (!user || user.role === "admin") {
    return null;
  }

  // Count unread messages
  const unreadCount = conversations.reduce(
    (total, conv) => total + conv.unreadCount,
    0,
  );

  return (
    <>
      {/* Chat Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <Button
          onClick={handleOpenSelector}
          className="w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all duration-200 relative"
          title="Mở chat"
        >
          <MessageCircle className="w-6 h-6 text-white" />
          {unreadCount > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-medium">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </div>

      {/* Chat Selector Modal */}
      {showSelector && (
        <ChatSelector
          onSelectUser={handleSelectUser}
          onClose={() => setShowSelector(false)}
        />
      )}

      {/* Chat Window */}
      {selectedUser && (
        <ChatWindow recipient={selectedUser} onClose={handleCloseChat} />
      )}
    </>
  );
}
