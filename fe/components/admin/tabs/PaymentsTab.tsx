"use client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PaymentsTab() {
  return (
    <div className="mt-6">
      <Card className="p-6 border-0 shadow-lg rounded-2xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-linear-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white text-2xl shadow-lg shadow-green-200">
              💳
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Quản lý thanh toán</h2>
              <p className="text-sm text-gray-500">Tạo yêu cầu đóng tiền và xác nhận thanh toán</p>
            </div>
          </div>
          <Button
            onClick={() => (window.location.href = "/admin/payments")}
            className="bg-linear-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
          >
            Mở trang quản lý →
          </Button>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div
            onClick={() => (window.location.href = "/admin/payments")}
            className="p-5 rounded-xl bg-linear-to-r from-blue-50 to-indigo-50 border border-blue-100 cursor-pointer hover:shadow-lg transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-white shadow flex items-center justify-center text-3xl">📋</div>
              <div>
                <h3 className="font-bold text-gray-900">Tạo yêu cầu đóng tiền</h3>
                <p className="text-sm text-gray-500">Tạo yêu cầu cho toàn bộ học sinh trong lớp</p>
              </div>
            </div>
          </div>

          <div
            onClick={() => (window.location.href = "/admin/payments")}
            className="p-5 rounded-xl bg-linear-to-r from-yellow-50 to-orange-50 border border-yellow-100 cursor-pointer hover:shadow-lg transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-white shadow flex items-center justify-center text-3xl">💵</div>
              <div>
                <h3 className="font-bold text-gray-900">Xác nhận tiền mặt</h3>
                <p className="text-sm text-gray-500">Xác nhận thanh toán bằng tiền mặt</p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center py-8 bg-gray-50 rounded-xl">
          <div className="text-5xl mb-4">💰</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Quản lý thanh toán học phí</h3>
          <p className="text-sm text-gray-500 mb-4 max-w-md mx-auto">
            Tạo yêu cầu đóng tiền cho từng lớp, theo dõi trạng thái và xác nhận thanh toán một cách dễ dàng.
          </p>
          <Button
            onClick={() => (window.location.href = "/admin/payments")}
            className="bg-linear-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
            size="lg"
          >
            Vào trang quản lý thanh toán
          </Button>
        </div>
      </Card>
    </div>
  );
}
