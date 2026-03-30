import { io, Socket } from "socket.io-client";

class SocketService {
  private socket: Socket | null = null;
  private token: string | null = null;

  connect(token: string) {
    if (this.socket?.connected) {
      return this.socket;
    }

    this.token = token;
    this.socket = io(
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000",
      {
        auth: {
          token: token,
        },
        extraHeaders: {
          Authorization: `Bearer ${token}`,
        },
        transports: ["websocket", "polling"],
        forceNew: true,
      },
    );

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket() {
    return this.socket;
  }

  isConnected() {
    return this.socket?.connected || false;
  }

  // Chat methods
  sendMessage(receiverId: string, content: string) {
    if (!this.socket) return;

    this.socket.emit("sendMessage", {
      receiverId,
      content,
    });
  }

  joinConversation(otherUserId: string) {
    if (!this.socket) return;

    this.socket.emit("joinConversation", { otherUserId });
  }

  leaveConversation(otherUserId: string) {
    if (!this.socket) return;

    this.socket.emit("leaveConversation", { otherUserId });
  }

  setTyping(receiverId: string, isTyping: boolean) {
    if (!this.socket) return;

    this.socket.emit("typing", { receiverId, isTyping });
  }

  // Event listeners
  onNewMessage(callback: (message: unknown) => void) {
    if (!this.socket) return;
    this.socket.on("newMessage", callback);
  }

  onMessageSent(callback: (message: unknown) => void) {
    if (!this.socket) return;
    this.socket.on("messageSent", callback);
  }

  onUserTyping(
    callback: (data: {
      userId: string;
      userName: string;
      isTyping: boolean;
    }) => void,
  ) {
    if (!this.socket) return;
    this.socket.on("userTyping", callback);
  }

  onUserOnline(callback: (data: { userId: string; name: string }) => void) {
    if (!this.socket) return;
    this.socket.on("userOnline", callback);
  }

  onUserOffline(callback: (data: { userId: string }) => void) {
    if (!this.socket) return;
    this.socket.on("userOffline", callback);
  }

  onPaymentStatusUpdated(
    callback: (data: {
      paymentId: string;
      status: string;
      method: string;
      studentId?: string;
      paidBy?: string;
      requestIds: string[];
      paidAt?: string;
      updatedAt?: string;
    }) => void,
  ) {
    if (!this.socket) return;
    this.socket.on("paymentStatusUpdated", callback);
  }

  // Remove listeners
  off(event: string, callback?: (...args: unknown[]) => void) {
    if (!this.socket) return;
    this.socket.off(event, callback);
  }
}

export const socketService = new SocketService();
export default socketService;
