"use client";
import { useState, useEffect } from "react";
import { Bell, CheckCircle, AlertCircle, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNotificationsStore, type Notification } from "@/lib/stores/notifications-store";

export default function NotificationCenter({ userRole }: { userRole: string }) {
  const [isOpen, setIsOpen] = useState(false);

  const {
    notifications,
    unreadCount,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    isLoading
  } = useNotificationsStore();

  useEffect(() => {
    fetchNotifications().catch(console.error);
  }, [fetchNotifications]);

  const iconFor = (type: Notification["type"]) => {
    switch (type) {
      case "success":
        return <CheckCircle className="text-green-600" size={18} />;
      case "warning":
        return <AlertCircle className="text-orange-600" size={18} />;
      case "error":
        return <AlertCircle className="text-red-600" size={18} />;
      case "reminder":
        return <Bell className="text-purple-600" size={18} />;
      case "info":
      default:
        return <Info className="text-blue-600" size={18} />;
    }
  };

  const markOne = async (id: string) => {
    try {
      await markAsRead(id);
    } catch (error) {
      console.error("Failed to mark notification as read", error);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteNotification(id);
    } catch (error) {
      console.error("Failed to delete notification", error);
    }
  };

  const handleMarkAll = async () => {
    try {
      await markAllAsRead();
    } catch (error) {
      console.error("Failed to mark all as read", error);
    }
  };

  const handleDeleteAll = async () => {
    if (window.confirm("Bạn có chắc chắn muốn xóa tất cả thông báo?")) {
      try {
        await clearAll();
      } catch (error) {
        console.error("Failed to delete all notifications", error);
      }
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-gray-100 rounded-full transition"
      >
        <Bell size={22} />
        {unreadCount > 0 && (
          <Badge
            className="absolute -top-1 -right-1 bg-red-600 text-white h-5 w-5 justify-center flex items-center"
            variant="destructive"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </Badge>
        )}
      </button>

      {isOpen && (
        <Card className="absolute right-0 top-12 w-80 shadow-2xl z-50 overflow-hidden">
          <div className="p-4 border-b flex justify-between items-center bg-white sticky top-0">
            <div>
              <p className="font-semibold text-gray-900">Thông báo</p>
              <p className="text-xs text-gray-500">Vai trò: {userRole}</p>
            </div>
            <div className="flex gap-2 divide-x">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAll}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                >
                  Đọc hết
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={handleDeleteAll}
                  className="text-xs text-red-600 hover:text-red-800 font-medium transition-colors pl-2"
                >
                  Xóa tất cả
                </button>
              )}
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y bg-white">
            {isLoading && notifications.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm text-gray-500">Đang tải...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
                <Bell className="text-gray-300" size={32} />
                <p className="text-sm text-gray-500 font-medium">Không có thông báo</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n._id}
                  className={`p-4 flex gap-3 items-start transition-colors ${!n.isRead ? 'bg-blue-50/50' : 'hover:bg-gray-50'}`}
                >
                  <div className="mt-0.5 shrink-0 bg-white rounded-full p-1 shadow-xs border border-gray-100">
                    {iconFor(n.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${!n.isRead ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2 leading-relaxed">
                      {n.message}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500">
                      <span>{new Date(n.createdAt).toLocaleDateString("vi-VN", { hour: '2-digit', minute: '2-digit' })}</span>
                      <div className="flex gap-3">
                        <button
                          onClick={() => !n.isRead && markOne(n._id)}
                          className={`font-medium transition-colors ${n.isRead
                              ? 'text-gray-400 cursor-default'
                              : 'text-blue-600 hover:text-blue-800'
                            }`}
                          disabled={n.isRead}
                        >
                          Đã đọc
                        </button>
                        <button
                          onClick={() => remove(n._id)}
                          className="text-red-500 hover:text-red-700 transition-colors"
                        >
                          Xóa
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
