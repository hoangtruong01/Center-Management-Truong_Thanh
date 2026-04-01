"use client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SettingsTab() {
  return (
    <div className="mt-6">
      <Card className="p-6 space-y-5 bg-white border-0 shadow-lg">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚙️</span>
          <div>
            <p className="font-bold text-gray-900 text-lg">Cài đặt hệ thống</p>
            <p className="text-xs text-gray-500">Tùy chỉnh thông tin trung tâm</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Tên trung tâm</label>
            <Input placeholder="Tên trung tâm" defaultValue="Trường Thành Education" className="rounded-xl border-gray-200" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Email hệ thống</label>
            <Input placeholder="Email hệ thống" defaultValue="admin@daythem.pro" className="rounded-xl border-gray-200" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Số điện thoại</label>
            <Input placeholder="Số điện thoại" defaultValue="+84 123 456 789" className="rounded-xl border-gray-200" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Địa chỉ</label>
            <Input placeholder="Địa chỉ" defaultValue="123 Đường ABC, Quận 1, TPHCM" className="rounded-xl border-gray-200" />
          </div>
        </div>

        <div className="pt-4 border-t border-gray-100">
          <Button className="bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-lg shadow-blue-200">
            💾 Lưu thay đổi
          </Button>
        </div>
      </Card>
    </div>
  );
}
