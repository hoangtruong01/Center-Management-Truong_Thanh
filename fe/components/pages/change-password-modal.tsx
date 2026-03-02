"use client";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/lib/stores/auth-store";

interface ChangePasswordModalProps {
  isOpen: boolean;
  onSuccess: () => void;
}

export default function ChangePasswordModal({
  isOpen,
  onSuccess,
}: ChangePasswordModalProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { changePassword } = useAuthStore();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    if (newPassword.length < 6) {
      setError("Mật khẩu mới phải có ít nhất 6 ký tự");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }

    if (newPassword === "123456789") {
      setError("Vui lòng chọn mật khẩu khác mật khẩu mặc định");
      return;
    }

    setIsSubmitting(true);
    try {
      await changePassword(newPassword);
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Đổi mật khẩu thất bại");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center px-4">
      <Card className="w-full max-w-md p-6 bg-white shadow-2xl border-0 rounded-2xl">
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-linear-to-br from-amber-400 to-orange-500 flex items-center justify-center text-3xl shadow-lg">
            🔐
          </div>
          <h2 className="text-xl font-bold text-gray-900">
            Đổi mật khẩu mặc định
          </h2>
          <p className="text-sm text-gray-500 mt-2">
            Đây là lần đăng nhập đầu tiên của bạn. Vui lòng đổi mật khẩu để bảo
            mật tài khoản.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Mật khẩu mới <span className="text-red-500">*</span>
            </label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Nhập mật khẩu mới (ít nhất 6 ký tự)"
              className="rounded-xl border-gray-200"
              required
              minLength={6}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Xác nhận mật khẩu <span className="text-red-500">*</span>
            </label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Nhập lại mật khẩu mới"
              className="rounded-xl border-gray-200"
              required
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
              ⚠️ {error}
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
            <p className="font-semibold mb-1">💡 Lưu ý:</p>
            <ul className="list-disc list-inside space-y-0.5 text-xs">
              <li>Mật khẩu phải có ít nhất 6 ký tự</li>
              <li>Không sử dụng mật khẩu mặc định (123456789)</li>
              <li>Nên kết hợp chữ hoa, chữ thường và số</li>
            </ul>
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-lg shadow-blue-200 py-3"
          >
            {isSubmitting ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Đang xử lý...
              </>
            ) : (
              <>🔑 Đổi mật khẩu</>
            )}
          </Button>
        </form>
      </Card>
    </div>
  );
}
