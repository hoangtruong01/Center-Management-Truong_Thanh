"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useAuthStore } from "@/lib/stores/auth-store";
import { usePaymentRequestsStore } from "@/lib/stores/payment-requests-store";
import { usePaymentsStore } from "@/lib/stores/payments-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import api from "@/lib/api";
import { notificationService } from "@/lib/services/notificationService.service";

export default function PaymentResultPage() {
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const { fetchMyRequests, fetchChildrenRequests } = usePaymentRequestsStore();
  const { fetchMyPayments } = usePaymentsStore();

  const [isRefreshing, setIsRefreshing] = useState(true);
  const notificationSent = useRef(false);

  const success = searchParams.get("success") === "true";
  const paymentId = searchParams.get("paymentId");
  const message = searchParams.get("message");

  // Refresh data when page loads to remove paid requests from list
  useEffect(() => {
    const refreshData = async () => {
      try {
        if (user?.role === "student") {
          await fetchMyRequests();
        } else if (user?.role === "parent") {
          await fetchChildrenRequests();
        }
        await fetchMyPayments();
      } catch (error) {
        console.error("Error refreshing payment data:", error);
      } finally {
        setIsRefreshing(false);
      }
    };

    refreshData();
  }, [user, fetchMyRequests, fetchChildrenRequests, fetchMyPayments]);

  // Send notification about payment result
  useEffect(() => {
    if (notificationSent.current || !user || !searchParams.has("success")) return;

    notificationSent.current = true;
    const statusText = success ? "thành công" : "thất bại";
    const userId = (user as any)._id || (user as any).id;

    if (userId) {
      api.post("/notifications", {
        userId: userId,
        title: `Thanh toán ${statusText}`,
        body: `Giao dịch thanh toán học phí của bạn đã ${statusText}.${paymentId ? ` Mã GD: ${paymentId}` : ""}`,
        type: success ? "success" : "error",
      }).catch((err) => console.error("Error sending payment notification:", err));

      if (success) {
        notificationService.notifyAdmin({
          title: `[Thanh toán học phí] Thành công`,
          body: `Người đóng: ${user.name} (${user.role})\nMã GD: ${paymentId}\nKết quả: Thanh toán thành công`,
          type: "success",
        }).catch((err) => console.error("Error notifying admin about payment:", err));
      }
    }
  }, [user, success, paymentId, searchParams]);

  if (isRefreshing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <Loader2 className="w-16 h-16 mx-auto mb-4 animate-spin text-blue-600" />
          <h2 className="text-xl font-semibold mb-2">Đang cập nhật...</h2>
          <p className="text-gray-600">Vui lòng đợi trong giây lát</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="max-w-md w-full p-8 text-center">
        {/* Status Icon */}
        <div className="mb-6">
          {success ? (
            <div className="w-20 h-20 mx-auto rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
          ) : (
            <div className="w-20 h-20 mx-auto rounded-full bg-red-100 flex items-center justify-center">
              <XCircle className="w-12 h-12 text-red-600" />
            </div>
          )}
        </div>

        {/* Title */}
        <h1
          className={`text-2xl font-bold mb-2 ${success ? "text-green-600" : "text-red-600"
            }`}
        >
          {success ? "Thanh toán thành công!" : "Thanh toán thất bại"}
        </h1>

        {/* Message */}
        <p className="text-gray-600 mb-6">
          {message
            ? decodeURIComponent(message)
            : success
              ? "Giao dịch của bạn đã được xử lý thành công."
              : "Đã có lỗi xảy ra trong quá trình thanh toán."}
        </p>

        {paymentId && (
          <p className="text-sm text-gray-400 mb-6">
            Mã giao dịch: {paymentId}
          </p>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <Link href="/payment" className="block">
            <Button className="w-full bg-blue-600 hover:bg-blue-700">
              Quay lại trang thanh toán
            </Button>
          </Link>

          <Link href="/" className="block">
            <Button variant="outline" className="w-full">
              Về trang chủ
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
