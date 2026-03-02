"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CreditCard,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { useOrdersStore, Order } from "@/lib/stores/orders-store";
import CheckoutModal from "@/components/checkout-modal";

interface ClassInfo {
  _id: string;
  name: string;
  subject?: string;
  fee: number;
}

interface StudentPaymentTabProps {
  classes: ClassInfo[];
  student: {
    hasScholarship: boolean;
    scholarshipPercent: number;
    scholarshipType?: string;
  };
}

export default function StudentPaymentTab({
  classes,
  student,
}: StudentPaymentTabProps) {
  const { orders, fetchMyOrders, isLoading } = useOrdersStore();
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    fetchMyOrders();
  }, [fetchMyOrders]);

  const pendingOrders = orders.filter((o) => o.status === "pending_payment");
  const paidOrders = orders.filter((o) => o.status === "paid");
  const totalPaid = paidOrders.reduce((sum, o) => sum + o.finalAmount, 0);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-green-100 text-green-800";
      case "pending_payment":
        return "bg-yellow-100 text-yellow-800";
      case "failed":
        return "bg-red-100 text-red-800";
      case "cancelled":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "paid":
        return "Đã thanh toán";
      case "pending_payment":
        return "Chờ thanh toán";
      case "failed":
        return "Thất bại";
      case "cancelled":
        return "Đã hủy";
      default:
        return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "paid":
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case "pending_payment":
        return <Clock className="w-5 h-5 text-yellow-600" />;
      case "failed":
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <AlertCircle className="w-5 h-5 text-gray-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">💳 Thanh toán</h2>
        <Button
          onClick={() => setShowCheckout(true)}
          className="bg-blue-600 hover:bg-blue-700"
          disabled={classes.length === 0}
        >
          <CreditCard className="w-4 h-4 mr-2" />
          Thanh toán học phí
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-5 bg-linear-to-br from-blue-500 to-indigo-600 text-white">
          <p className="text-sm opacity-90">Lớp đang học</p>
          <p className="text-3xl font-bold">{classes.length}</p>
        </Card>

        <Card className="p-5 bg-linear-to-br from-yellow-500 to-orange-500 text-white">
          <p className="text-sm opacity-90">Chờ thanh toán</p>
          <p className="text-3xl font-bold">{pendingOrders.length}</p>
        </Card>

        <Card className="p-5 bg-linear-to-br from-green-500 to-emerald-600 text-white">
          <p className="text-sm opacity-90">Đã thanh toán</p>
          <p className="text-3xl font-bold">
            {totalPaid.toLocaleString("vi-VN")} đ
          </p>
        </Card>
      </div>

      {/* Scholarship Info */}
      {student.hasScholarship && student.scholarshipPercent > 0 && (
        <Card className="p-5 bg-linear-to-r from-purple-100 to-pink-100 border-purple-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-purple-500 flex items-center justify-center text-white text-2xl">
              🎓
            </div>
            <div>
              <h3 className="font-semibold text-purple-900">
                Học bổng {student.scholarshipPercent}%
              </h3>
              <p className="text-sm text-purple-700">
                {student.scholarshipType === "teacher_child"
                  ? "Con giáo viên"
                  : student.scholarshipType === "poor_family"
                  ? "Hộ nghèo"
                  : student.scholarshipType === "orphan"
                  ? "Con mồ côi"
                  : "Học bổng đặc biệt"}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Classes List */}
      <Card className="p-5">
        <h3 className="font-semibold text-gray-800 mb-4">📚 Lớp học hiện tại</h3>
        {classes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>Chưa có lớp học nào</p>
          </div>
        ) : (
          <div className="space-y-3">
            {classes.map((cls) => (
              <div
                key={cls._id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div>
                  <p className="font-medium text-gray-900">{cls.name}</p>
                  {cls.subject && (
                    <p className="text-sm text-gray-500">{cls.subject}</p>
                  )}
                </div>
                <span className="font-semibold text-gray-900">
                  {cls.fee.toLocaleString("vi-VN")} đ
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Orders History */}
      <Card className="p-5">
        <h3 className="font-semibold text-gray-800 mb-4">📋 Lịch sử đơn hàng</h3>

        {isLoading ? (
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-blue-600" />
            <p className="mt-2 text-gray-500">Đang tải...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>Chưa có đơn hàng nào</p>
            <Button
              onClick={() => setShowCheckout(true)}
              variant="outline"
              className="mt-4"
            >
              Tạo đơn hàng đầu tiên
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <div
                key={order._id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => setSelectedOrder(order)}
              >
                <div className="flex items-center gap-4">
                  {getStatusIcon(order.status)}
                  <div>
                    <p className="font-medium text-gray-900">
                      {order.items.length} lớp học
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(order.createdAt).toLocaleDateString("vi-VN")}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">
                      {order.finalAmount.toLocaleString("vi-VN")} đ
                    </p>
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${getStatusColor(
                        order.status
                      )}`}
                    >
                      {getStatusLabel(order.status)}
                    </span>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">Chi tiết đơn hàng</h3>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Status */}
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                {getStatusIcon(selectedOrder.status)}
                <span
                  className={`px-3 py-1 rounded-full ${getStatusColor(
                    selectedOrder.status
                  )}`}
                >
                  {getStatusLabel(selectedOrder.status)}
                </span>
              </div>

              {/* Items */}
              <div className="space-y-2">
                {selectedOrder.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-gray-600">{item.className}</span>
                    <span>{item.classFee.toLocaleString("vi-VN")} đ</span>
                  </div>
                ))}
              </div>

              <hr />

              {/* Pricing */}
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Tổng học phí:</span>
                  <span>
                    {selectedOrder.baseAmount.toLocaleString("vi-VN")} đ
                  </span>
                </div>
                {selectedOrder.scholarshipPercent > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>
                      Học bổng ({selectedOrder.scholarshipPercent}%):
                    </span>
                    <span>
                      -{selectedOrder.discountAmount.toLocaleString("vi-VN")} đ
                    </span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg pt-2 border-t">
                  <span>Thành tiền:</span>
                  <span className="text-blue-600">
                    {selectedOrder.finalAmount.toLocaleString("vi-VN")} đ
                  </span>
                </div>
              </div>

              {/* Date */}
              <div className="text-sm text-gray-500">
                Ngày tạo:{" "}
                {new Date(selectedOrder.createdAt).toLocaleString("vi-VN")}
                {selectedOrder.paidAt && (
                  <>
                    <br />
                    Thanh toán:{" "}
                    {new Date(selectedOrder.paidAt).toLocaleString("vi-VN")}
                  </>
                )}
              </div>
            </div>

            <Button
              onClick={() => setSelectedOrder(null)}
              className="w-full mt-4"
            >
              Đóng
            </Button>
          </Card>
        </div>
      )}

      {/* Checkout Modal */}
      <CheckoutModal
        isOpen={showCheckout}
        onClose={() => setShowCheckout(false)}
        classes={classes}
        student={student}
        onSuccess={() => {
          fetchMyOrders();
          setShowCheckout(false);
        }}
      />
    </div>
  );
}
