"use client";
import { useState, useEffect, useRef } from "react";
import { Bounce, ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import api from "@/lib/api";
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronDown, Camera } from "lucide-react";
import NotificationCenter from "@/notification-center";
import ImportUsersModal from "@/components/pages/import-users-modal";
import ImportStudentsModal from "@/components/pages/import-students-modal";
import ClassFormModal from "@/components/pages/class-form-modal";
import ClassStudentsModal from "@/components/pages/class-students-modal";
import ClassDetailModal from "@/components/pages/class-detail-modal";
import { useBranchesStore } from "@/lib/stores/branches-store";
import { useClassesStore, type Class } from "@/lib/stores/classes-store";
import { useUsersStore, type ImportResponse } from "@/lib/stores/users-store";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { usePaymentsStore } from "@/lib/stores/payments-store";
import { useFinanceStore } from "@/lib/stores/finance-store";
import { useLeaderboardStore } from "@/lib/stores/leaderboard-store";
import { useAdminStatsStore } from "@/lib/stores/admin-stats-store";
import { uploadToCloudinary } from "@/lib/cloudinary";

// Tab Components
import OverviewTab from "@/components/admin/tabs/OverviewTab";
import UsersTab from "@/components/admin/tabs/UsersTab";
import ClassesTab from "@/components/admin/tabs/ClassesTab";
import FinanceTab from "@/components/admin/tabs/FinanceTab";
import BranchesTab from "@/components/admin/tabs/BranchesTab";
import LeaderboardTab from "@/components/admin/tabs/LeaderboardTab";
import PaymentsTab from "@/components/admin/tabs/PaymentsTab";
import IncidentsTab from "@/components/admin/tabs/IncidentsTab";
import EvaluationsTab from "@/components/admin/tabs/EvaluationsTab";
import SettingsTab from "@/components/admin/tabs/SettingsTab";
import AttendanceTab from "@/components/admin/tabs/AttendanceTab";
import ScheduleTab from "@/components/admin/tabs/ScheduleTab";

interface AdminDashboardProps {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    phone?: string;
    avatarUrl?: string;
  };
  onLogout: () => void;
}

type RankingCategory = "score" | "attendance";

// Removed mock overviewStats - now using real data from API

// Removed mock revenueByMonth - now using real data from API

// Mock data này sẽ được thay thế bằng data thật từ API trong Tab Tài chính
// financeSummary và financeChart đã bị xóa và thay bằng dữ liệu động

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const accounts = {
  students: [
    {
      name: "Nguyễn Văn A",
      email: "nguyenvana@email.com",
      phone: "+84 123 456 789",
      code: "HS001",
      date: "2025-01-15",
      avatar: "👨‍🎓",
    },
    {
      name: "Trần Thị B",
      email: "tranthib@email.com",
      phone: "+84 987 654 321",
      code: "HS002",
      date: "2025-01-16",
      avatar: "👩‍🎓",
    },
    {
      name: "Lê Văn C",
      email: "levanc@email.com",
      phone: "+84 555 666 777",
      code: "HS003",
      date: "2025-01-17",
      avatar: "👨‍🎓",
    },
  ],
  parents: [
    {
      name: "Nguyễn Văn Anh",
      email: "nguyenvanh@email.com",
      phone: "+84 111 222 333",
      children: "2 con",
      date: "2025-01-10",
      avatar: "👨",
    },
    {
      name: "Trần Thị Mai",
      email: "tranthimai@email.com",
      phone: "+84 222 333 444",
      children: "1 con",
      date: "2025-01-12",
      avatar: "👩",
    },
  ],
  teachers: [
    {
      name: "Cô Nguyễn Thị C",
      email: "cothic@email.com",
      phone: "+84 444 555 666",
      subject: "Toán",
      experience: "5 năm kinh nghiệm",
      date: "2025-01-05",
      avatar: "👩‍🏫",
    },
    {
      name: "Thầy Trần Văn D",
      email: "thaytrand@email.com",
      phone: "+84 777 888 999",
      subject: "Anh Văn",
      experience: "8 năm kinh nghiệm",
      date: "2025-01-05",
      avatar: "👨‍🏫",
    },
  ],
};

// Removed mock pieData - now using real studentsBySubject from API

const pieColors = [
  "#3b82f6",
  "#f97316",
  "#10b981",
  "#8b5cf6",
  "#ec4899",
  "#6366f1",
];

// Leaderboard options (removed "diligence" / "Chăm chỉ")
const leaderboardOptions: Record<
  RankingCategory,
  { label: string; desc: string }
> = {
  score: { label: "Top điểm", desc: "Điểm trung bình cao" },
  attendance: { label: "Chuyên cần", desc: "Đi học đầy đủ" },
};

const tabIcons: Record<RankingCategory, string> = {
  score: "🏆",
  attendance: "👥",
};

interface BranchOption {
  _id: string;
  id?: string;
  name: string;
  address?: string;
  phone?: string;
  status?: "active" | "inactive";
}

// Modal chi tiết tài khoản
interface UserDetail {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  branchId?: string;
  status?: string;
  avatarUrl?: string;
  dateOfBirth?: string;
  gender?: string;
  createdAt?: string;
  updatedAt?: string;
  expiresAt?: string;
  subjects?: string[];
  teacherNote?: string;
  qualification?: string;
  // Mã số
  studentCode?: string;
  teacherCode?: string;
  parentCode?: string;
  // Thông tin phụ huynh của học sinh
  parentName?: string;
  parentPhone?: string;
  childEmail?: string;
  // Thông tin học bổng (cho học sinh)
  hasScholarship?: boolean;
  scholarshipType?: "teacher_child" | "poor_family" | "orphan";
  scholarshipPercent?: number;
}

function UserDetailModal({
  user,
  branchName,
  onClose,
  onEdit,
  onDelete,
}: {
  user: UserDetail;
  branchName: string;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const { fetchParentChildren } = useUsersStore();
  const [children, setChildren] = useState<UserDetail[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [loadingChildren, setLoadingChildren] = useState(false);

  // Fetch children if user is parent
  useEffect(() => {
    if (user.role === "parent" && user._id) {
      let cancelled = false;
      const loadChildren = async () => {
        try {
          const data = await fetchParentChildren(user._id);
          if (!cancelled) setChildren(data);
        } catch (err) {
          console.error("Error fetching children:", err);
        }
      };
      loadChildren();
      return () => {
        cancelled = true;
      };
    }
  }, [user._id, user.role, fetchParentChildren]);

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "student":
        return {
          label: "Học sinh",
          icon: "👨‍🎓",
          color: "bg-blue-100 text-blue-700",
        };
      case "parent":
        return {
          label: "Phụ huynh",
          icon: "👨‍👩‍👧",
          color: "bg-emerald-100 text-emerald-700",
        };
      case "teacher":
        return {
          label: "Giáo viên",
          icon: "👨‍🏫",
          color: "bg-purple-100 text-purple-700",
        };
      case "admin":
        return {
          label: "Quản trị",
          icon: "👑",
          color: "bg-amber-100 text-amber-700",
        };
      default:
        return { label: role, icon: "👤", color: "bg-gray-100 text-gray-700" };
    }
  };

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case "active":
        return { label: "Hoạt động", color: "bg-green-100 text-green-700" };
      case "pending":
        return { label: "Chờ duyệt", color: "bg-yellow-100 text-yellow-700" };
      case "inactive":
        return { label: "Ngừng hoạt động", color: "bg-red-100 text-red-700" };
      default:
        return { label: "Không xác định", color: "bg-gray-100 text-gray-700" };
    }
  };

  const roleInfo = getRoleLabel(user.role);
  const statusInfo = getStatusLabel(user.status);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center px-3">
      <Card className="w-full max-w-lg p-6 bg-white shadow-2xl border-0 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-3xl shadow-lg">
              {roleInfo.icon}
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">{user.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${roleInfo.color}`}
                >
                  {roleInfo.label}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}
                >
                  {statusInfo.label}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Thông tin cơ bản */}
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <h4 className="font-semibold text-gray-800 flex items-center gap-2">
              <span>📋</span> Thông tin cơ bản
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-500">Email</p>
                <p className="font-medium text-gray-900">{user.email}</p>
              </div>
              <div>
                <p className="text-gray-500">Số điện thoại</p>
                <p className="font-medium text-gray-900">
                  {user.phone || "Chưa cập nhật"}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Ngày sinh</p>
                <p className="font-medium text-gray-900">
                  {user.dateOfBirth
                    ? new Date(user.dateOfBirth).toLocaleDateString("vi-VN")
                    : "Chưa cập nhật"}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Giới tính</p>
                <p className="font-medium text-gray-900">
                  {user.gender === "male"
                    ? "Nam"
                    : user.gender === "female"
                      ? "Nữ"
                      : user.gender === "other"
                        ? "Khác"
                        : "Chưa cập nhật"}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Cơ sở</p>
                <p className="font-medium text-gray-900">🏢 {branchName}</p>
              </div>
            </div>
          </div>

          {/* Thông tin phụ huynh (cho học sinh) */}
          {user.role === "student" && (user.parentName || user.parentPhone) && (
            <div className="bg-emerald-50 rounded-xl p-4 space-y-3">
              <h4 className="font-semibold text-emerald-800 flex items-center gap-2">
                <span>👨‍👩‍👧</span> Thông tin phụ huynh
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-500">Họ tên phụ huynh</p>
                  <p className="font-medium text-gray-900">
                    {user.parentName || "Chưa cập nhật"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">SĐT phụ huynh</p>
                  <p className="font-medium text-gray-900">
                    {user.parentPhone || "Chưa cập nhật"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Thông tin học bổng (cho học sinh) */}
          {user.role === "student" && (
            <div
              className={`rounded-xl p-4 space-y-3 ${user.hasScholarship ? "bg-amber-50" : "bg-gray-50"}`}
            >
              <h4
                className={`font-semibold flex items-center gap-2 ${user.hasScholarship ? "text-amber-800" : "text-gray-600"}`}
              >
                <span>🎓</span> Học bổng
              </h4>
              {user.hasScholarship ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500">Loại học bổng</p>
                    <p className="font-medium text-gray-900">
                      {user.scholarshipType === "teacher_child"
                        ? "👨‍🏫 Con giáo viên"
                        : user.scholarshipType === "poor_family"
                          ? "🏠 Hộ nghèo"
                          : user.scholarshipType === "orphan"
                            ? "💙 Con mồ côi"
                            : "Không xác định"}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Phần trăm giảm</p>
                    <p className="font-medium text-amber-600 text-lg">
                      🏷️ {user.scholarshipPercent || 0}%
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <div className="bg-amber-100 rounded-lg p-2">
                      <p className="text-sm text-amber-800">
                        💡 Học sinh được giảm{" "}
                        <strong>{user.scholarshipPercent || 0}%</strong> học phí
                        do thuộc diện{" "}
                        <strong>
                          {user.scholarshipType === "teacher_child"
                            ? "Con giáo viên"
                            : user.scholarshipType === "poor_family"
                              ? "Hộ nghèo"
                              : user.scholarshipType === "orphan"
                                ? "Con mồ côi"
                                : ""}
                        </strong>
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">
                  Học sinh không có học bổng
                </p>
              )}
            </div>
          )}

          {/* Thông tin giáo viên */}
          {user.role === "teacher" && (
            <div className="bg-purple-50 rounded-xl p-4 space-y-3">
              <h4 className="font-semibold text-purple-800 flex items-center gap-2">
                <span>📚</span> Thông tin giảng dạy
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-500">Môn dạy</p>
                  <p className="font-medium text-gray-900">
                    {user.subjects && user.subjects.length > 0
                      ? user.subjects.join(", ")
                      : "Chưa phân công"}
                  </p>
                </div>
                <div>
                  <p className="text-gray-500">Trình độ</p>
                  <p className="font-medium text-gray-900">
                    {user.qualification || "Chưa cập nhật"}
                  </p>
                </div>
                {user.teacherNote && (
                  <div className="sm:col-span-2">
                    <p className="text-gray-500">Ghi chú</p>
                    <p className="font-medium text-gray-900">
                      {user.teacherNote}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Thông tin con (cho phụ huynh) */}
          {user.role === "parent" && (
            <div className="bg-indigo-50 rounded-xl p-4 space-y-3">
              <h4 className="font-semibold text-indigo-800 flex items-center gap-2">
                <span>👧</span> Thông tin con
                <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-200 text-indigo-800">
                  {loadingChildren ? "Đang tải..." : `${children.length} con`}
                </span>
              </h4>

              {loadingChildren ? (
                <div className="text-center py-4 text-gray-500">
                  <span className="animate-spin inline-block mr-2">⏳</span>
                  Đang tải thông tin...
                </div>
              ) : children.length === 0 ? (
                <p className="text-sm text-gray-500 italic">
                  Chưa tìm thấy học sinh liên kết với phụ huynh này
                </p>
              ) : (
                <div className="space-y-2">
                  {children.map((child, index) => (
                    <div
                      key={child._id}
                      className="flex items-center justify-between p-3 bg-white rounded-lg border border-indigo-100"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-linear-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-white font-bold">
                          {child.name?.charAt(0) || "?"}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">
                            {index + 1}. {child.name}
                          </p>
                          <p className="text-xs text-gray-500">{child.email}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          {child.studentCode || "Chưa có mã"}
                        </span>
                        {child.status === "active" && (
                          <span className="ml-2 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                            Đang học
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Thông tin hệ thống */}
          <div className="bg-blue-50 rounded-xl p-4 space-y-3">
            <h4 className="font-semibold text-blue-800 flex items-center gap-2">
              <span>🔧</span> Thông tin hệ thống
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-500">
                  {user.role === "student"
                    ? "Mã số học sinh"
                    : user.role === "teacher"
                      ? "Mã số giáo viên"
                      : user.role === "parent"
                        ? "Mã số phụ huynh"
                        : "Mã tài khoản"}
                </p>
                <p className="font-medium text-gray-900 font-mono text-lg">
                  {user.role === "student" && user.studentCode
                    ? user.studentCode
                    : user.role === "teacher" && user.teacherCode
                      ? user.teacherCode
                      : user.role === "parent" && user.parentCode
                        ? user.parentCode
                        : `#${user._id.slice(-8).toUpperCase()}`}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Ngày tạo</p>
                <p className="font-medium text-gray-900">
                  {user.createdAt
                    ? new Date(user.createdAt).toLocaleDateString("vi-VN", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Không xác định"}
                </p>
              </div>
              {(user.role === "student" || user.role === "parent") &&
                user.expiresAt && (
                  <div>
                    <p className="text-gray-500">Hết hạn</p>
                    <p className="font-medium text-gray-900">
                      {new Date(user.expiresAt).toLocaleDateString("vi-VN", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                )}
              <div>
                <p className="text-gray-500">Cập nhật lần cuối</p>
                <p className="font-medium text-gray-900">
                  {user.updatedAt
                    ? new Date(user.updatedAt).toLocaleDateString("vi-VN", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Không xác định"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          {onEdit && (
            <Button
              className="flex-1 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-lg"
              onClick={onEdit}
            >
              ✏️ Chỉnh sửa
            </Button>
          )}
          {onDelete && (
            <Button
              variant="outline"
              className="flex-1 rounded-xl border-red-200 text-red-600 hover:bg-red-50"
              onClick={onDelete}
            >
              🗑️ Xóa tài khoản
            </Button>
          )}
          <Button
            variant="outline"
            className="flex-1 rounded-xl"
            onClick={onClose}
          >
            Đóng
          </Button>
        </div>
      </Card>
    </div>
  );
}

// Modal chỉnh sửa tài khoản
function EditUserModal({
  user,
  branches,
  onClose,
  onSave,
  isLoading,
  error,
}: {
  user: UserDetail;
  branches: BranchOption[];
  onClose: () => void;
  onSave: (data: Record<string, unknown>) => Promise<void>;
  isLoading?: boolean;
  error?: string | null;
}) {
  const [formData, setFormData] = useState({
    name: user.name || "",
    email: user.email || "",
    phone: user.phone || "",
    branchId: user.branchId || "",
    dateOfBirth: user.dateOfBirth ? user.dateOfBirth.split("T")[0] : "",
    gender: user.gender || "",
    status: user.status || "active",
    // Student fields
    parentName: user.parentName || "",
    parentPhone: user.parentPhone || "",
    hasScholarship: user.hasScholarship || false,
    scholarshipType: user.scholarshipType || "",
    scholarshipPercent: user.scholarshipPercent || 0,
    // Teacher fields
    subjects: user.subjects || [],
    qualification: user.qualification || "",
    teacherNote: user.teacherNote || "",
    // Parent fields
    childEmail: user.childEmail || "",
  });

  const [showSubjectPicker, setShowSubjectPicker] = useState(false);

  const isStudent = user.role === "student";
  const isTeacher = user.role === "teacher";
  const isParent = user.role === "parent";

  const toggleSubject = (subject: string) => {
    setFormData((prev) => ({
      ...prev,
      subjects: prev.subjects.includes(subject)
        ? prev.subjects.filter((s) => s !== subject)
        : [...prev.subjects, subject],
    }));
  };

  const toggleCategory = (subjects: string[]) => {
    const allSelected = subjects.every((s) => formData.subjects.includes(s));
    if (allSelected) {
      setFormData((prev) => ({
        ...prev,
        subjects: prev.subjects.filter((s) => !subjects.includes(s)),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        subjects: [...new Set([...prev.subjects, ...subjects])],
      }));
    }
  };

  const handleSubmit = async () => {
    const updateData: Record<string, unknown> = {
      name: formData.name.trim(),
      phone: formData.phone.trim() || undefined,
      branchId: formData.branchId || undefined,
      status: formData.status,
    };

    // Không update email vì email là unique identifier

    if (!isParent) {
      if (formData.dateOfBirth) {
        updateData.dateOfBirth = new Date(formData.dateOfBirth);
      }
      if (formData.gender) {
        updateData.gender = formData.gender;
      }
    }

    if (isStudent) {
      updateData.parentName = formData.parentName.trim() || undefined;
      updateData.parentPhone = formData.parentPhone.trim() || undefined;
      updateData.hasScholarship = formData.hasScholarship;
      if (formData.hasScholarship) {
        updateData.scholarshipType = formData.scholarshipType || undefined;
        updateData.scholarshipPercent = formData.scholarshipPercent;
      } else {
        updateData.scholarshipType = undefined;
        updateData.scholarshipPercent = 0;
      }
    }

    if (isTeacher) {
      updateData.subjects = formData.subjects;
      updateData.qualification = formData.qualification.trim() || undefined;
      updateData.teacherNote = formData.teacherNote.trim() || undefined;
    }

    if (isParent) {
      updateData.childEmail =
        formData.childEmail.trim().toLowerCase() || undefined;
    }

    await onSave(updateData);
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "student":
        return { label: "Học sinh", icon: "👨‍🎓" };
      case "parent":
        return { label: "Phụ huynh", icon: "👨‍👩‍👧" };
      case "teacher":
        return { label: "Giáo viên", icon: "👨‍🏫" };
      default:
        return { label: role, icon: "👤" };
    }
  };

  const roleInfo = getRoleLabel(user.role);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center px-3">
      <Card className="w-full max-w-lg p-6 bg-white shadow-2xl border-0 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-lg">
            ✏️
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              Chỉnh sửa {roleInfo.label.toLowerCase()}
            </h3>
            <p className="text-sm text-gray-500">
              {roleInfo.icon} {user.name}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Cơ sở */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Cơ sở</label>
            <select
              value={formData.branchId}
              onChange={(e) =>
                setFormData({ ...formData, branchId: e.target.value })
              }
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Chọn cơ sở --</option>
              {branches.map((branch) => (
                <option key={branch._id} value={branch._id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>

          {/* Họ tên */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">
              Họ tên <span className="text-red-500">*</span>
            </label>
            <Input
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="rounded-xl border-gray-200"
            />
          </div>

          {/* Email (readonly) */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Email</label>
            <Input
              value={formData.email}
              disabled
              className="rounded-xl border-gray-200 bg-gray-100 cursor-not-allowed"
            />
            <p className="text-xs text-gray-400">Email không thể thay đổi</p>
          </div>

          {/* Số điện thoại */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">
              Số điện thoại
            </label>
            <Input
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
              className="rounded-xl border-gray-200"
            />
          </div>

          {/* Ngày sinh + Giới tính (không cho phụ huynh) */}
          {!isParent && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  Ngày sinh
                </label>
                <Input
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) =>
                    setFormData({ ...formData, dateOfBirth: e.target.value })
                  }
                  className="rounded-xl border-gray-200"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">
                  Giới tính
                </label>
                <select
                  value={formData.gender}
                  onChange={(e) =>
                    setFormData({ ...formData, gender: e.target.value })
                  }
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Chọn --</option>
                  <option value="male">Nam</option>
                  <option value="female">Nữ</option>
                  <option value="other">Khác</option>
                </select>
              </div>
            </div>
          )}

          {/* Trạng thái */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">
              Trạng thái
            </label>
            <select
              value={formData.status}
              onChange={(e) =>
                setFormData({ ...formData, status: e.target.value })
              }
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="active">Hoạt động</option>
              <option value="pending">Chờ duyệt</option>
              <option value="inactive">Ngừng hoạt động</option>
            </select>
          </div>

          {/* === STUDENT SPECIFIC === */}
          {isStudent && (
            <>
              {/* Thông tin phụ huynh */}
              <div className="border rounded-xl p-3 space-y-3 bg-emerald-50">
                <h4 className="text-sm font-semibold text-emerald-800">
                  👨‍👩‍👧 Thông tin phụ huynh
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">
                      Tên phụ huynh
                    </label>
                    <Input
                      value={formData.parentName}
                      onChange={(e) =>
                        setFormData({ ...formData, parentName: e.target.value })
                      }
                      className="rounded-lg border-gray-200 text-sm"
                      placeholder="Nhập tên"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">
                      SĐT phụ huynh
                    </label>
                    <Input
                      value={formData.parentPhone}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          parentPhone: e.target.value,
                        })
                      }
                      className="rounded-lg border-gray-200 text-sm"
                      placeholder="Nhập SĐT"
                    />
                  </div>
                </div>
              </div>

              {/* Học bổng */}
              <div className="border rounded-xl p-3 space-y-3 bg-amber-50">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-amber-800">
                    🎓 Học bổng
                  </h4>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.hasScholarship}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          hasScholarship: e.target.checked,
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                  </label>
                </div>
                {formData.hasScholarship && (
                  <div className="space-y-3 pt-2 border-t border-amber-200">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-600">
                        Loại học bổng <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.scholarshipType}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            scholarshipType: e.target.value as
                              | "teacher_child"
                              | "poor_family"
                              | "orphan",
                          })
                        }
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="">-- Chọn loại --</option>
                        <option value="teacher_child">Con giáo viên</option>
                        <option value="poor_family">Hộ nghèo</option>
                        <option value="orphan">Con mồ côi</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-600">
                        Phần trăm (%)
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          value={formData.scholarshipPercent}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              scholarshipPercent: parseInt(e.target.value),
                            })
                          }
                          className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                        />
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={formData.scholarshipPercent}
                          onChange={(e) => {
                            const val = Math.min(
                              100,
                              Math.max(0, parseInt(e.target.value) || 0),
                            );
                            setFormData({
                              ...formData,
                              scholarshipPercent: val,
                            });
                          }}
                          className="w-16 rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-center"
                        />
                        <span className="text-sm font-semibold text-amber-600">
                          %
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* === TEACHER SPECIFIC === */}
          {isTeacher && (
            <>
              {/* Môn dạy */}
              <div className="border rounded-xl p-3 space-y-3 bg-purple-50">
                <h4 className="text-sm font-semibold text-purple-800">
                  📚 Môn dạy
                </h4>
                <div
                  onClick={() => setShowSubjectPicker(!showSubjectPicker)}
                  className="w-full min-h-10.5 rounded-xl border border-gray-200 px-3 py-2 text-sm cursor-pointer bg-white hover:border-purple-400"
                >
                  {formData.subjects.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {formData.subjects.map((subject) => (
                        <span
                          key={subject}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium"
                        >
                          #{subject}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSubject(subject);
                            }}
                            className="hover:text-purple-900"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-gray-400">
                      Nhấn để chọn môn dạy...
                    </span>
                  )}
                </div>
                {showSubjectPicker && (
                  <div className="border border-gray-200 rounded-xl p-3 bg-white max-h-50 overflow-y-auto">
                    {SUBJECT_OPTIONS.map((cat) => (
                      <div key={cat.category} className="mb-2 last:mb-0">
                        <div className="flex items-center gap-2 mb-1">
                          <button
                            type="button"
                            onClick={() => toggleCategory(cat.subjects)}
                            className={`text-xs font-semibold px-2 py-1 rounded-lg transition-colors ${
                              cat.subjects.every((s) =>
                                formData.subjects.includes(s),
                              )
                                ? "bg-purple-600 text-white"
                                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                            }`}
                          >
                            {cat.category}
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1 ml-1">
                          {cat.subjects.map((subject) => (
                            <button
                              key={subject}
                              type="button"
                              onClick={() => toggleSubject(subject)}
                              className={`px-2 py-0.5 rounded-full text-xs font-medium transition-all ${
                                formData.subjects.includes(subject)
                                  ? "bg-purple-500 text-white"
                                  : "bg-white text-gray-600 border border-gray-200 hover:border-purple-400"
                              }`}
                            >
                              #{subject}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Trình độ & Ghi chú */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-gray-700">
                    Trình độ
                  </label>
                  <select
                    value={formData.qualification}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        qualification: e.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Chọn --</option>
                    <option value="Cử nhân">Cử nhân</option>
                    <option value="Thạc sĩ">Thạc sĩ</option>
                    <option value="Tiến sĩ">Tiến sĩ</option>
                    <option value="Giáo sư">Giáo sư</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-sm font-medium text-gray-700">
                    Ghi chú
                  </label>
                  <textarea
                    value={formData.teacherNote}
                    onChange={(e) =>
                      setFormData({ ...formData, teacherNote: e.target.value })
                    }
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm resize-none"
                    placeholder="Ghi chú về giáo viên..."
                  />
                </div>
              </div>
            </>
          )}

          {/* === PARENT SPECIFIC === */}
          {isParent && (
            <div className="border rounded-xl p-3 space-y-3 bg-indigo-50">
              <h4 className="text-sm font-semibold text-indigo-800">
                👧 Email con (học sinh)
              </h4>
              <Input
                type="email"
                value={formData.childEmail}
                onChange={(e) =>
                  setFormData({ ...formData, childEmail: e.target.value })
                }
                className="rounded-lg border-gray-200"
                placeholder="email.hocsinh@example.com"
              />
              <p className="text-xs text-gray-500">
                Nhập email của học sinh để liên kết tài khoản
              </p>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <Button
            className="flex-1 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-lg"
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? "Đang lưu..." : "💾 Lưu thay đổi"}
          </Button>
          <Button
            variant="outline"
            className="flex-1 rounded-xl"
            onClick={onClose}
            disabled={isLoading}
          >
            Hủy
          </Button>
        </div>
      </Card>
    </div>
  );
}

// Danh sách môn dạy theo khối
const SUBJECT_OPTIONS = [
  { category: "Toán", subjects: ["Toán 10", "Toán 11", "Toán 12"] },
  { category: "Văn", subjects: ["Văn 10", "Văn 11", "Văn 12"] },
  { category: "Anh Văn", subjects: ["Anh Văn 10", "Anh Văn 11", "Anh Văn 12"] },
  { category: "Vật Lý", subjects: ["Lý 10", "Lý 11", "Lý 12"] },
  { category: "Hóa Học", subjects: ["Hóa 10", "Hóa 11", "Hóa 12"] },
  { category: "Sinh Học", subjects: ["Sinh 10", "Sinh 11", "Sinh 12"] },
  { category: "Lịch Sử", subjects: ["Sử 10", "Sử 11", "Sử 12"] },
  { category: "Địa Lý", subjects: ["Địa 10", "Địa 11", "Địa 12"] },
  { category: "GDCD", subjects: ["GDCD 10", "GDCD 11", "GDCD 12"] },
  { category: "Tin Học", subjects: ["Tin 10", "Tin 11", "Tin 12"] },
];

function AddModal({
  title,
  fields,
  branches,
  onClose,
  onSubmit,
  isLoading,
  error,
}: {
  title: string;
  fields: string[];
  branches: BranchOption[];
  onClose: () => void;
  onSubmit: (data: Record<string, string>) => void;
  isLoading?: boolean;
  error?: string | null;
}) {
  const [selectedBranch, setSelectedBranch] = useState("");
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [showSubjectPicker, setShowSubjectPicker] = useState(false);
  const [selectedGender, setSelectedGender] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  // State học bổng (dành cho học sinh)
  const [hasScholarship, setHasScholarship] = useState(false);
  const [scholarshipType, setScholarshipType] = useState("");
  const [scholarshipPercent, setScholarshipPercent] = useState(0);

  // Check if this is teacher/student/parent form
  const isTeacherForm = title.includes("giáo viên");
  const isStudentForm = title.includes("học sinh");
  const isParentForm = title.includes("phụ huynh");

  // Toggle subject selection
  const toggleSubject = (subject: string) => {
    setSelectedSubjects((prev) =>
      prev.includes(subject)
        ? prev.filter((s) => s !== subject)
        : [...prev, subject],
    );
  };

  // Select all subjects in a category
  const toggleCategory = (subjects: string[]) => {
    const allSelected = subjects.every((s) => selectedSubjects.includes(s));
    if (allSelected) {
      setSelectedSubjects((prev) => prev.filter((s) => !subjects.includes(s)));
    } else {
      setSelectedSubjects((prev) => [...new Set([...prev, ...subjects])]);
    }
  };

  const handleSubmit = () => {
    console.log("=== AddModal SUBMIT ===", {
      selectedBranch,
      formData,
      selectedSubjects,
      selectedGender,
      dateOfBirth,
      hasScholarship,
      scholarshipType,
      scholarshipPercent,
    });
    const submitData: Record<string, string> = {
      ...formData,
      branchId: selectedBranch,
    };
    if (isTeacherForm && selectedSubjects.length > 0) {
      submitData["Môn dạy"] = selectedSubjects.join(", ");
    }
    // Thêm giới tính (không áp dụng cho phụ huynh)
    if (!isParentForm && selectedGender) {
      submitData["Giới tính"] = selectedGender;
    }
    // Thêm ngày sinh (không áp dụng cho phụ huynh)
    if (!isParentForm && dateOfBirth) {
      submitData["Ngày sinh"] = dateOfBirth;
    }
    // Thêm thông tin học bổng (chỉ cho học sinh)
    if (isStudentForm) {
      submitData["hasScholarship"] = hasScholarship ? "true" : "false";
      if (hasScholarship && scholarshipType) {
        submitData["scholarshipType"] = scholarshipType;
        submitData["scholarshipPercent"] = scholarshipPercent.toString();
      }
    }
    onSubmit(submitData);
  };

  // Filter out "Môn dạy" from fields for teacher form (we'll handle it separately)
  // Also filter out fields we handle separately
  const displayFields = fields.filter((f) => {
    if (isTeacherForm && f === "Môn dạy") return false;
    if (f === "Giới tính" || f === "Ngày sinh") return false;
    return true;
  });

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center px-3">
      <Card className="w-full max-w-md p-6 bg-white shadow-2xl border-0 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-lg">
            ➕
          </div>
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        </div>
        <div className="space-y-3 mb-5">
          {/* Dropdown chọn cơ sở */}
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">-- Chọn cơ sở --</option>
            {branches.map((branch) => (
              <option key={branch._id} value={branch._id}>
                {branch.name}
              </option>
            ))}
          </select>
          {displayFields.map((f) => (
            <Input
              key={f}
              placeholder={f}
              className="rounded-xl border-gray-200"
              value={formData[f] || ""}
              onChange={(e) =>
                setFormData({ ...formData, [f]: e.target.value })
              }
            />
          ))}

          {/* Ngày sinh (không áp dụng cho phụ huynh) */}
          {!isParentForm && (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Ngày sinh
              </label>
              <Input
                type="date"
                className="rounded-xl border-gray-200"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
              />
            </div>
          )}

          {/* Giới tính (không áp dụng cho phụ huynh) */}
          {!isParentForm && (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Giới tính
              </label>
              <select
                value={selectedGender}
                onChange={(e) => setSelectedGender(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Chọn giới tính --</option>
                <option value="male">Nam</option>
                <option value="female">Nữ</option>
                <option value="other">Khác</option>
              </select>
            </div>
          )}

          {/* Học bổng (chỉ áp dụng cho học sinh) */}
          {isStudentForm && (
            <div className="border rounded-xl p-3 space-y-3 bg-gray-50">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">
                  🎓 Học bổng
                </label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasScholarship}
                    onChange={(e) => {
                      setHasScholarship(e.target.checked);
                      if (!e.target.checked) {
                        setScholarshipType("");
                        setScholarshipPercent(0);
                      }
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {hasScholarship && (
                <div className="space-y-3 pt-2 border-t border-gray-200">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">
                      Loại học bổng <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={scholarshipType}
                      onChange={(e) => setScholarshipType(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">-- Chọn loại học bổng --</option>
                      <option value="teacher_child">Con giáo viên</option>
                      <option value="poor_family">Hộ nghèo</option>
                      <option value="orphan">Con mồ côi</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">
                      Phần trăm học bổng (%)
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={scholarshipPercent}
                        onChange={(e) =>
                          setScholarshipPercent(parseInt(e.target.value))
                        }
                        className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={scholarshipPercent}
                        onChange={(e) => {
                          const val = Math.min(
                            100,
                            Math.max(0, parseInt(e.target.value) || 0),
                          );
                          setScholarshipPercent(val);
                        }}
                        className="w-16 rounded-lg border border-gray-200 px-2 py-1.5 text-sm text-center"
                      />
                      <span className="text-sm font-semibold text-blue-600">
                        %
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 italic">
                      Học sinh được giảm {scholarshipPercent}% học phí
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Subject Picker for Teachers */}
          {isTeacherForm && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Môn dạy <span className="text-gray-400">(chọn nhiều)</span>
              </label>

              {/* Selected subjects display */}
              <div
                onClick={() => setShowSubjectPicker(!showSubjectPicker)}
                className="w-full min-h-10.5 rounded-xl border border-gray-200 px-3 py-2 text-sm cursor-pointer hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {selectedSubjects.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedSubjects.map((subject) => (
                      <span
                        key={subject}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium"
                      >
                        #{subject}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSubject(subject);
                          }}
                          className="hover:text-blue-900"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-gray-400">Nhấn để chọn môn dạy...</span>
                )}
              </div>

              {/* Subject Picker Dropdown */}
              {showSubjectPicker && (
                <div className="border border-gray-200 rounded-xl p-3 bg-gray-50 max-h-62.5 overflow-y-auto">
                  {SUBJECT_OPTIONS.map((cat) => (
                    <div key={cat.category} className="mb-3 last:mb-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <button
                          type="button"
                          onClick={() => toggleCategory(cat.subjects)}
                          className={`text-xs font-semibold px-2 py-1 rounded-lg transition-colors ${
                            cat.subjects.every((s) =>
                              selectedSubjects.includes(s),
                            )
                              ? "bg-blue-600 text-white"
                              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                          }`}
                        >
                          {cat.category}
                        </button>
                        <span className="text-xs text-gray-400">
                          {
                            cat.subjects.filter((s) =>
                              selectedSubjects.includes(s),
                            ).length
                          }
                          /{cat.subjects.length}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 ml-1">
                        {cat.subjects.map((subject) => (
                          <button
                            key={subject}
                            type="button"
                            onClick={() => toggleSubject(subject)}
                            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                              selectedSubjects.includes(subject)
                                ? "bg-blue-500 text-white shadow-sm"
                                : "bg-white text-gray-600 border border-gray-200 hover:border-blue-400 hover:text-blue-600"
                            }`}
                          >
                            #{subject}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowSubjectPicker(false)}
                    className="w-full mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    ✓ Xong
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
        <div className="flex gap-3">
          <Button
            className="flex-1 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-lg shadow-blue-200"
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? "Đang thêm..." : "Thêm"}
          </Button>
          <Button
            variant="outline"
            className="flex-1 rounded-xl"
            onClick={onClose}
            disabled={isLoading}
          >
            Hủy
          </Button>
        </div>
      </Card>
    </div>
  );
}

function SettingsModal({
  user,
  onClose,
}: {
  user: {
    _id?: string;
    id?: string;
    name: string;
    email: string;
    role: string;
    phone?: string;
    avatarUrl?: string;
  };
  onClose: () => void;
}) {
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    user.avatarUrl || null,
  );
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: user.name,
    phone: user.phone || "",
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setAvatarPreview(url);
      setSelectedFile(file);
    }
  };

  const handleEditAvatar = () => {
    if (isEditing) {
      fileInputRef.current?.click();
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const userId = user._id || user.id;
      if (!userId) {
        toast.error("Không tìm thấy thông tin người dùng");
        return;
      }

      let avatarUrl = user.avatarUrl;

      if (selectedFile) {
        try {
          avatarUrl = await uploadToCloudinary(selectedFile);
        } catch {
          toast.error("Không thể tải ảnh lên. Vui lòng thử lại.");
          setIsLoading(false);
          return;
        }
      }

      await api.patch(`/users/${userId}`, {
        name: formData.name,
        phone: formData.phone,
        avatarUrl: avatarUrl,
      });

      toast.success("Cập nhật thông tin thành công!", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "light",
        transition: Bounce,
      });
      setIsEditing(false);
      window.location.reload();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err.response?.data?.message || "Cập nhật thất bại", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "light",
        transition: Bounce,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-3 animate-in fade-in duration-200">
      <Card className="w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto bg-white shadow-2xl rounded-2xl [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {/* Header */}
        <div className="flex justify-between items-start mb-2">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Thông tin</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        {/* Avatar */}
        <div className="flex flex-col items-center justify-center py-6">
          <div className="relative">
            <div
              className={`w-28 h-28 rounded-full overflow-hidden border-4 border-white shadow-lg ring-2 ring-blue-100 bg-gray-100 flex items-center justify-center ${!isEditing && avatarPreview ? "cursor-pointer hover:opacity-90 transition-opacity" : ""}`}
              onClick={() => {
                if (!isEditing && avatarPreview) {
                  setShowImagePreview(true);
                }
              }}
            >
              {avatarPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarPreview}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-white text-gray-700 text-4xl font-bold select-none">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {isEditing && (
              <button
                onClick={handleEditAvatar}
                className="absolute bottom-0 right-0 bg-white p-2 rounded-full shadow-md border border-gray-200 text-gray-700 hover:text-blue-600 hover:bg-blue-50 transition-all active:scale-95"
                title="Đổi ảnh đại diện"
              >
                <Camera size={17} />
              </button>
            )}
          </div>

          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            onChange={handleFileChange}
          />
        </div>

        {/* Image Preview Modal */}
        {showImagePreview && avatarPreview && (
          <div
            className="fixed inset-0 z-60 flex items-center justify-center bg-black/20 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setShowImagePreview(false)}
          >
            <div
              className="relative w-[30vw] max-w-4xl aspect-square md:aspect-auto md:h-auto flex items-center justify-center animate-in zoom-in-50 duration-300 ease-out"
              onClick={(e) => e.stopPropagation()}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatarPreview}
                alt="Profile Large"
                className="w-full h-auto max-h-[90vh] object-cover rounded-3xl shadow-2xl border-[6px] border-white"
              />
              <button
                onClick={() => setShowImagePreview(false)}
                className="absolute -top-4 -right-4 bg-white text-gray-900 rounded-full p-2 shadow-lg hover:bg-gray-100 transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Form Inputs */}
        <div className="space-y-4 text-sm">
          <div className="space-y-2">
            <label className="text-gray-700 font-medium">Họ và tên</label>
            <input
              className={`w-full rounded-lg border px-3 py-2.5 transition-all ${
                isEditing
                  ? "border-blue-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  : "border-gray-300"
              }`}
              value={isEditing ? formData.name : user.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              readOnly={!isEditing}
            />
          </div>

          <div className="space-y-2">
            <label className="text-gray-700 font-medium">Email</label>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5 bg-gray-50 text-gray-500 cursor-not-allowed"
              defaultValue={user.email}
              readOnly
            />
          </div>

          <div className="space-y-2">
            <label className="text-gray-700 font-medium">Số điện thoại</label>
            <input
              className={`w-full rounded-lg border px-3 py-2.5 transition-all ${
                isEditing
                  ? "border-blue-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  : "border-gray-300"
              }`}
              value={isEditing ? formData.phone : user.phone || "Chưa cập nhật"}
              onChange={(e) => handleInputChange("phone", e.target.value)}
              readOnly={!isEditing}
            />
          </div>

          <div className="flex gap-3 pt-2">
            {!isEditing ? (
              <Button
                onClick={() => setIsEditing(true)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-200"
              >
                <span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="lucide lucide-user-round-pen-icon lucide-user-round-pen"
                  >
                    <path d="M2 21a8 8 0 0 1 10.821-7.487" />
                    <path d="M21.378 16.626a1 1 0 0 0-3.004-3.004l-4.01 4.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z" />
                    <circle cx="10" cy="8" r="5" />
                  </svg>
                </span>
                Chỉnh Sửa
              </Button>
            ) : (
              <>
                <Button
                  onClick={() => {
                    setIsEditing(false);
                    setFormData({
                      name: user.name,
                      phone: user.phone || "",
                    });
                  }}
                  variant="outline"
                  className="flex-1 border-gray-300 text-gray-700 hover:bg-gray-50"
                  disabled={isLoading}
                >
                  Hủy
                </Button>
                <Button
                  onClick={handleSave}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-200"
                  disabled={isLoading}
                >
                  {isLoading ? "Đang lưu..." : "Lưu thay đổi"}
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

// Modal thêm/sửa cơ sở
function BranchModal({
  isOpen,
  branch,
  onClose,
  onSave,
}: {
  isOpen: boolean;
  branch: BranchOption | null;
  onClose: () => void;
  onSave: (data: { name: string; address: string; phone?: string }) => void;
}) {
  const branchName = branch?.name || "";
  const branchAddress = branch?.address || "";
  const branchPhone = branch?.phone || "";
  const [name, setName] = useState(branchName);
  const [address, setAddress] = useState(branchAddress);
  const [phone, setPhone] = useState(branchPhone);

  // Adjust state when branch/isOpen changes (React-recommended pattern)
  const [prevBranch, setPrevBranch] = useState(branch);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  if (branch !== prevBranch || isOpen !== prevIsOpen) {
    setPrevBranch(branch);
    setPrevIsOpen(isOpen);
    setName(branchName);
    setAddress(branchAddress);
    setPhone(branchPhone);
  }

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !address.trim()) {
      alert("Vui lòng điền đầy đủ tên và địa chỉ cơ sở");
      return;
    }
    onSave({
      name: name.trim(),
      address: address.trim(),
      phone: phone.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center px-3">
      <Card className="w-full max-w-md p-6 bg-white shadow-2xl border-0">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-lg">
            🏢
          </div>
          <h3 className="text-lg font-bold text-gray-900">
            {branch ? "Sửa cơ sở" : "Thêm cơ sở mới"}
          </h3>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Tên cơ sở <span className="text-red-500">*</span>
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: Cơ sở Quận 1"
              className="rounded-xl border-gray-200"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Địa chỉ <span className="text-red-500">*</span>
            </label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="VD: 123 Nguyễn Huệ, Quận 1, TPHCM"
              className="rounded-xl border-gray-200"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Số điện thoại
            </label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="VD: 0123 456 789"
              className="rounded-xl border-gray-200"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              type="submit"
              className="flex-1 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-lg shadow-blue-200"
            >
              {branch ? "💾 Lưu thay đổi" : "➕ Thêm cơ sở"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1 rounded-xl"
              onClick={onClose}
            >
              Hủy
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export default function AdminDashboard({
  user,
  onLogout,
}: AdminDashboardProps) {
  const [activeAccountTab, setActiveAccountTab] = useState<
    "students" | "parents" | "teachers"
  >("students");
  const [showModal, setShowModal] = useState<null | {
    title: string;
    fields: string[];
  }>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showImportStudentsModal, setShowImportStudentsModal] = useState(false);
  const [showClassModal, setShowClassModal] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<BranchOption | null>(null);
  const [rankingView, setRankingView] = useState<RankingCategory>("score");
  const [leaderboardBranch, setLeaderboardBranch] = useState<string>("");
  const [selectedUserDetail, setSelectedUserDetail] =
    useState<UserDetail | null>(null);
  const [editingUser, setEditingUser] = useState<UserDetail | null>(null);
  const [editUserLoading, setEditUserLoading] = useState(false);
  const [editUserError, setEditUserError] = useState<string | null>(null);
  const [classStudentsModal, setClassStudentsModal] = useState<Class | null>(
    null,
  );
  const [classDetailModal, setClassDetailModal] = useState<Class | null>(null);
  const [classSearchQuery, setClassSearchQuery] = useState("");
  const [classBranchFilter, setClassBranchFilter] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // State to hold full user details including sensitive/personal info not in initial props
  const [fullUserDetails, setFullUserDetails] = useState<Record<
    string,
    unknown
  > | null>(null);

  // Fetch full user data
  useEffect(() => {
    if (user?.id) {
      api
        .get(`/users/${user.id}`)
        .then(
          (res: {
            data: { user?: Record<string, unknown> } & Record<string, unknown>;
          }) => {
            const userData = res.data.user || res.data;
            setFullUserDetails(userData);
          },
        )
        .catch((err: unknown) => {
          console.error("Failed to fetch full user details:", err);
        });
    }
  }, [user.id]);

  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    user.avatarUrl || null,
  );

  // Sync avatarPreview when user prop changes
  useEffect(() => {
    if (user.avatarUrl) {
      setAvatarPreview(user.avatarUrl);
    }
  }, [user.avatarUrl]);

  // Sync avatarPreview when fullUserDetails is loaded
  useEffect(() => {
    if (fullUserDetails?.avatarUrl) {
      setAvatarPreview(fullUserDetails.avatarUrl as string);
    } else if (fullUserDetails?.avatarURL) {
      setAvatarPreview(fullUserDetails.avatarURL as string);
    }
  }, [fullUserDetails]);

  const handleLogout = () => {
    toast.info("Đang đăng xuất...", {
      position: "top-right",
      autoClose: 250,
      hideProgressBar: true,
      closeOnClick: true,
      pauseOnHover: false,
      draggable: true,
      theme: "light",
      transition: Bounce,
    });
    setTimeout(() => {
      onLogout();
    }, 500);
  };

  // Handle click outside to close profile dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Stores
  const {
    branches,
    fetchBranches,
    createBranch,
    updateBranch,
    deleteBranch,
    isLoading: branchesLoading,
  } = useBranchesStore();
  const { classes, fetchClasses, fetchClassTransferRequests } =
    useClassesStore();
  const {
    users,
    importUsers,
    downloadTemplate,
    createUser,
    fetchUsers,
    isLoading: usersLoading,
  } = useUsersStore();

  // Leaderboard store
  const {
    leaderboard,
    loading: leaderboardLoading,
    fetchLeaderboard,
  } = useLeaderboardStore();

  // Admin stats store (for dashboard overview)
  const {
    dashboardData,
    loading: statsLoading,
    fetchDashboardOverview,
  } = useAdminStatsStore();

  // Finance store (new)
  const {
    dashboard: financeDashboard,
    expenses,
    classHealth,
    weeklyClassReport,
    isLoading: financeLoading,
    error: financeError,
    fetchDashboard,
    fetchClassHealth,
    fetchWeeklyClassReport,
    fetchExpenses,
    createExpense,
    deleteExpense,
    clearError: clearFinanceError,
  } = useFinanceStore();

  // Finance state
  const [selectedBranch, setSelectedBranch] = useState<string>("ALL");
  const [selectedYear, setSelectedYear] = useState<number>(
    new Date().getFullYear(),
  );
  const [classHealthRiskFilter, setClassHealthRiskFilter] = useState<
    "all" | "green" | "yellow" | "red"
  >("all");
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [transferPendingCount, setTransferPendingCount] = useState(0);

  // State for add user modal
  const [addUserLoading, setAddUserLoading] = useState(false);
  const [addUserError, setAddUserError] = useState<string | null>(null);

  // Kiểm tra xem user có phải admin không
  const isAdmin = user.role === "admin";

  // State for branch filter - Nếu không phải admin, mặc định là branchId của user
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>("");

  // State for search
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [scholarshipFilter, setScholarshipFilter] = useState<
    "all" | "has" | "none"
  >("all");
  const [scholarshipTypeFilter, setScholarshipTypeFilter] = useState<
    "all" | "teacher_child" | "poor_family" | "orphan"
  >("all");

  // Effective branch filter - non-admin users chỉ xem được chi nhánh của mình
  const effectiveBranchFilter = isAdmin
    ? selectedBranchFilter
    : (user as unknown as Record<string, string>).branchId || "";

  // Filter users by role and branch from API
  const filteredUsers = effectiveBranchFilter
    ? users.filter((u) => u.branchId === effectiveBranchFilter)
    : users;

  // Apply search filter
  const searchFilteredUsers = searchQuery.trim()
    ? filteredUsers.filter((u) => {
        const query = searchQuery.toLowerCase().trim();
        return (
          u.name?.toLowerCase().includes(query) ||
          u.email?.toLowerCase().includes(query) ||
          u.phone?.toLowerCase().includes(query) ||
          (u as any).studentCode?.toLowerCase().includes(query) ||
          (u as any).teacherCode?.toLowerCase().includes(query) ||
          (u as any).parentCode?.toLowerCase().includes(query)
        );
      })
    : filteredUsers;

  const scholarshipFilteredUsers =
    activeAccountTab === "students"
      ? searchFilteredUsers.filter((u) => {
          if (u.role !== "student") return true;

          const hasScholarship = Boolean((u as any).hasScholarship);
          const scholarshipType = (u as any).scholarshipType;

          if (scholarshipFilter === "has" && !hasScholarship) return false;
          if (scholarshipFilter === "none" && hasScholarship) return false;

          if (
            scholarshipFilter !== "none" &&
            scholarshipTypeFilter !== "all" &&
            scholarshipType !== scholarshipTypeFilter
          ) {
            return false;
          }

          return true;
        })
      : searchFilteredUsers;

  const apiStudents = scholarshipFilteredUsers.filter(
    (u) => u.role === "student",
  );
  const apiParents = scholarshipFilteredUsers.filter(
    (u) => u.role === "parent",
  );
  const apiTeachers = scholarshipFilteredUsers.filter(
    (u) => u.role === "teacher",
  );

  useEffect(() => {
    if (activeAccountTab !== "students") {
      setScholarshipFilter("all");
      setScholarshipTypeFilter("all");
    }
  }, [activeAccountTab]);

  // Get branch name by id
  const getBranchName = (branchId?: string) => {
    if (!branchId) return "Chưa phân cơ sở";
    const branch = branches.find((b) => b._id === branchId);
    return branch?.name || "Không xác định";
  };

  // Fetch branches and users on mount
  useEffect(() => {
    fetchBranches().catch(() => {
      console.log("Could not fetch branches - make sure backend is running");
    });
    fetchUsers().catch(() => {
      console.log("Could not fetch users - make sure backend is running");
    });
    fetchClasses().catch(() => {
      console.log("Could not fetch classes - make sure backend is running");
    });
    // Fetch leaderboard (initial - all branches)
    fetchLeaderboard({ limit: 10 }).catch(() => {
      console.log("Could not fetch leaderboard - make sure backend is running");
    });
    // Fetch admin stats overview
    fetchDashboardOverview().catch(() => {
      console.log(
        "Could not fetch dashboard stats - make sure backend is running",
      );
    });
    refreshTransferPendingCount().catch(() => {
      console.log(
        "Could not fetch transfer pending count - make sure backend is running",
      );
    });
  }, [
    fetchBranches,
    fetchUsers,
    fetchClasses,
    fetchClassTransferRequests,
    fetchLeaderboard,
    fetchDashboardOverview,
  ]);

  // Re-fetch leaderboard when branch filter changes
  useEffect(() => {
    const params: { branchId?: string; limit: number } = { limit: 10 };
    if (leaderboardBranch) {
      params.branchId = leaderboardBranch;
    }
    fetchLeaderboard(params).catch(() => {});
  }, [leaderboardBranch, fetchLeaderboard]);

  // Fetch finance dashboard when switching to finance tab or branch/year changes
  useEffect(() => {
    if (activeTab === "finance") {
      console.log(
        `🔄 Fetching finance dashboard: branch=${selectedBranch}, year=${selectedYear}`,
      );
      fetchDashboard(selectedBranch, selectedYear);
      fetchClassHealth(selectedBranch, classHealthRiskFilter);
      fetchWeeklyClassReport(selectedBranch);

      // Fetch expenses only if specific branch selected
      if (selectedBranch !== "ALL") {
        fetchExpenses(selectedBranch);
      }
    }
  }, [
    activeTab,
    selectedBranch,
    selectedYear,
    classHealthRiskFilter,
    fetchDashboard,
    fetchClassHealth,
    fetchWeeklyClassReport,
    fetchExpenses,
  ]);


  const handleAddExpense = async (data: {
    amount: number;
    description: string;
    expenseDate: string;
  }) => {
    try {
      await createExpense({
        branchId: selectedBranch,
        ...data,
      });

      // Refresh data parallel
      await Promise.all([
        fetchDashboard(selectedBranch, selectedYear),
        fetchClassHealth(selectedBranch, classHealthRiskFilter),
        fetchWeeklyClassReport(selectedBranch),
        selectedBranch !== "ALL"
          ? fetchExpenses(selectedBranch)
          : Promise.resolve(),
      ]);

      // Modal auto closes via onSubmit prop
    } catch (error) {
      console.error("Failed to create expense:", error);
      throw error;
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm("Bạn có chắc muốn xóa chi phí này?")) return;

    try {
      await deleteExpense(id);

      // Refresh data
      await fetchDashboard(selectedBranch, selectedYear);
      await fetchClassHealth(selectedBranch, classHealthRiskFilter);
      await fetchWeeklyClassReport(selectedBranch);
      await fetchExpenses(selectedBranch);
    } catch (error) {
      console.error("Failed to delete expense:", error);
    }
  };

  const refreshTransferPendingCount = async () => {
    try {
      const pendingRequests = await fetchClassTransferRequests("pending");
      setTransferPendingCount(pendingRequests.length);
    } catch {
      setTransferPendingCount(0);
    }
  };

  // Handlers for branches
  const handleAddBranch = () => {
    setEditingBranch(null);
    setShowBranchModal(true);
  };

  const handleEditBranch = (branch: BranchOption) => {
    setEditingBranch(branch);
    setShowBranchModal(true);
  };

  const handleDeleteBranch = async (branchId: string) => {
    if (
      confirm(
        "Bạn có chắc muốn xóa cơ sở này? Hành động này không thể hoàn tác.",
      )
    ) {
      try {
        await deleteBranch(branchId);
      } catch (error) {
        console.error("Error deleting branch:", error);
      }
    }
  };

  const handleSaveBranch = async (data: {
    name: string;
    address: string;
    phone?: string;
  }) => {
    try {
      if (editingBranch) {
        await updateBranch(editingBranch._id, data);
      } else {
        await createBranch(data);
      }
      setShowBranchModal(false);
      setEditingBranch(null);
    } catch (error) {
      console.error("Error saving branch:", error);
    }
  };

  // Handlers for import
  const handleImportUsers = async (
    file: File,
    role: "student" | "teacher" | "parent",
    branchId: string,
  ): Promise<ImportResponse> => {
    return await importUsers(file, role, branchId);
  };

  const handleDownloadTemplate = (role: "student" | "teacher" | "parent") => {
    downloadTemplate(role);
  };

  // Handler để thêm user từ AddModal
  const handleAddUser = async (data: Record<string, string>) => {
    console.log("=== handleAddUser called ===", data);
    setAddUserError(null);
    setAddUserLoading(true);

    try {
      // Validate
      if (!data.branchId) {
        throw new Error("Vui lòng chọn chi nhánh");
      }
      const name = data["Họ và tên"] || data["Họ tên"];
      const email = data["Email"];
      const phone = data["Số điện thoại"];

      if (!name?.trim()) {
        throw new Error("Vui lòng nhập họ tên");
      }
      if (!email?.trim()) {
        throw new Error("Vui lòng nhập email");
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        throw new Error("Email không hợp lệ");
      }

      // Determine role from modal title
      let role: "student" | "parent" | "teacher" = "student";
      if (showModal?.title.includes("giáo viên")) {
        role = "teacher";
      } else if (showModal?.title.includes("phụ huynh")) {
        role = "parent";
      }

      // Prepare API data
      const apiData: Record<string, unknown> = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone?.trim() || undefined,
        password: "123456",
        role,
        branchId: data.branchId,
      };

      // Add date of birth and gender (not for parent)
      if (role !== "parent") {
        if (data["Ngày sinh"]) {
          apiData.dateOfBirth = new Date(data["Ngày sinh"]);
        }
        if (data["Giới tính"]) {
          apiData.gender = data["Giới tính"];
        }
      }

      // Add student specific fields (parent info)
      if (role === "student") {
        const parentName = data["Tên phụ huynh"];
        const parentPhone = data["SĐT phụ huynh"];
        if (parentName) apiData.parentName = parentName.trim();
        if (parentPhone) apiData.parentPhone = parentPhone.trim();

        // Thêm thông tin học bổng
        apiData.hasScholarship = data["hasScholarship"] === "true";
        if (apiData.hasScholarship && data["scholarshipType"]) {
          apiData.scholarshipType = data["scholarshipType"];
          apiData.scholarshipPercent =
            parseInt(data["scholarshipPercent"]) || 0;
        }
      }

      // Add teacher specific fields
      if (role === "teacher") {
        const subjects = data["Môn dạy"];
        if (subjects) {
          apiData.subjects = subjects.split(",").map((s: string) => s.trim());
        }
      }

      // Add parent specific fields (child email)
      if (role === "parent") {
        const childEmail = data["Email con (học sinh)"];
        if (childEmail) apiData.childEmail = childEmail.trim().toLowerCase();
      }

      console.log("Creating user with:", apiData);
      await createUser(apiData as unknown as Parameters<typeof createUser>[0]);
      console.log("User created successfully!");

      // Refresh users list
      await fetchUsers();

      // Close modal
      setShowModal(null);
    } catch (err: unknown) {
      console.error("Error creating user:", err);

      // Lấy message từ error đã được dịch trong users-store
      const message = (err as Error)?.message || "Lỗi khi tạo người dùng";
      setAddUserError(message);
    } finally {
      setAddUserLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-[#89CFF0]/20 to-white">
      {/* Header với thiết kế hiện đại */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Trường Thành"
              className="w-10 h-10 rounded-xl object-contain"
            />
            <div>
              <h1 className="text-lg font-bold bg-linear-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent">
                Trường Thành Education
              </h1>
              <p className="text-xs text-gray-500">Dashboard Quản trị</p>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <NotificationCenter userRole={user.role} />
            {/* Use Dropdown in Profile */}
            <div className="relative ml-3" ref={dropdownRef}>
              {/* Avatar */}
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="relative group focus:outline-none"
              >
                {/* Avatar chính */}
                <div className="w-9 h-9 rounded-full bg-white text-gray-700 font-semibold text-sm shadow-md flex items-center justify-center transition-transform ring-2 ring-transparent group-focus:ring-gray-200 overflow-hidden">
                  {avatarPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarPreview}
                      alt={user.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    user.name.charAt(0)
                  )}
                </div>

                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-gray-700 rounded-full flex items-center justify-center border-[1.5px] border-white text-white shadow-sm">
                  <ChevronDown size={10} strokeWidth={3} />
                </div>
              </button>

              {/* Dropdown */}
              {isProfileOpen && (
                <div className="absolute right-0 mt-2 w-60 bg-white rounded-xl shadow-lg border border-gray-100 py-2 animate-in fade-in zoom-in-95 duration-200 origin-top-right z-50">
                  {/* Thông tin user tóm tắt */}
                  <div className="px-4 py-3 border-b border-gray-100 mb-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {user.name}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {user.email}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setShowSettings(true);
                      setIsProfileOpen(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 transition-colors"
                  >
                    <span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="lucide lucide-circle-user-round-icon lucide-circle-user-round"
                      >
                        <path d="M18 20a6 6 0 0 0-12 0" />
                        <circle cx="12" cy="10" r="4" />
                        <circle cx="12" cy="12" r="10" />
                      </svg>
                    </span>
                    Hồ sơ
                  </button>

                  <button
                    onClick={() => {
                      handleLogout();
                      setIsProfileOpen(false);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 transition-colors"
                  >
                    <span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="lucide lucide-log-out-icon lucide-log-out"
                      >
                        <path d="m16 17 5-5-5-5" />
                        <path d="M21 12H9" />
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      </svg>
                    </span>
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        {/* Welcome Banner */}
        <div className="bg-linear-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-2xl p-6 text-white shadow-xl shadow-blue-200/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Xin chào 👋</p>
              <h2 className="text-2xl font-bold mt-1">{user.name}</h2>
              <p className="text-blue-100 mt-2 text-sm">
                Chào mừng bạn quay trở lại bảng điều khiển quản trị!
              </p>
            </div>
            <div className="hidden md:block text-6xl opacity-80">🎯</div>
          </div>
        </div>

        <Tabs
          defaultValue="overview"
          value={activeTab}
          onValueChange={(value) => {
            setActiveTab(value);
            // Refetch data when switching tabs to ensure fresh data
            if (value === "courses") {
              fetchClasses().catch(console.error);
            } else if (value === "class-transfer") {
              refreshTransferPendingCount().catch(console.error);
            } else if (value === "accounts") {
              fetchUsers().catch(console.error);
            } else if (value === "branches") {
              fetchBranches().catch(console.error);
            }
          }}
          className="w-full"
        >
          <TabsList className="w-full overflow-x-auto flex gap-1 rounded-2xl bg-white p-1.5 shadow-sm border border-gray-100 justify-start md:justify-center">
            <TabsTrigger
              value="overview"
              className="whitespace-nowrap px-4 py-2.5 text-sm font-medium rounded-xl data-[state=active]:bg-linear-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
            >
              📊 Tổng quan
            </TabsTrigger>
            <TabsTrigger
              value="courses"
              className="whitespace-nowrap px-4 py-2.5 text-sm font-medium rounded-xl data-[state=active]:bg-linear-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
            >
              📚 Khóa học
            </TabsTrigger>
            <TabsTrigger
              value="class-transfer"
              className="whitespace-nowrap px-4 py-2.5 text-sm font-medium rounded-xl data-[state=active]:bg-linear-to-r data-[state=active]:from-indigo-600 data-[state=active]:to-violet-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
            >
              <span className="inline-flex items-center gap-2">
                <span>🔄 Chuyển lớp</span>
                {transferPendingCount > 0 && (
                  <span className="inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
                    {transferPendingCount > 99 ? "99+" : transferPendingCount}
                  </span>
                )}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="accounts"
              className="whitespace-nowrap px-4 py-2.5 text-sm font-medium rounded-xl data-[state=active]:bg-linear-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
            >
              👥 Tài khoản
            </TabsTrigger>
            <TabsTrigger
              value="leaderboard"
              className="whitespace-nowrap px-4 py-2.5 text-sm font-medium rounded-xl data-[state=active]:bg-linear-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
            >
              🥇 Bảng xếp hạng
            </TabsTrigger>
            <TabsTrigger
              value="finance"
              className="whitespace-nowrap px-4 py-2.5 text-sm font-medium rounded-xl data-[state=active]:bg-linear-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
            >
              💰 Tài chính
            </TabsTrigger>
            <TabsTrigger
              value="branches"
              className="whitespace-nowrap px-4 py-2.5 text-sm font-medium rounded-xl data-[state=active]:bg-linear-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
            >
              🏢 Cơ sở
            </TabsTrigger>
            <TabsTrigger
              value="schedule"
              className="whitespace-nowrap px-4 py-2.5 text-sm font-medium rounded-xl data-[state=active]:bg-linear-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
            >
              📅 Lịch dạy học
            </TabsTrigger>
            <TabsTrigger
              value="attendance"
              className="whitespace-nowrap px-4 py-2.5 text-sm font-medium rounded-xl data-[state=active]:bg-linear-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
            >
              📋 Điểm danh
            </TabsTrigger>
            <TabsTrigger
              value="payments"
              className="whitespace-nowrap px-4 py-2.5 text-sm font-medium rounded-xl data-[state=active]:bg-linear-to-r data-[state=active]:from-green-500 data-[state=active]:to-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
            >
              💳 Thanh toán
            </TabsTrigger>
            <TabsTrigger
              value="incidents"
              className="whitespace-nowrap px-4 py-2.5 text-sm font-medium rounded-xl data-[state=active]:bg-linear-to-r data-[state=active]:from-orange-500 data-[state=active]:to-red-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
            >
              🐛 Sự cố
            </TabsTrigger>
            <TabsTrigger
              value="evaluations"
              className="whitespace-nowrap px-4 py-2.5 text-sm font-medium rounded-xl data-[state=active]:bg-linear-to-r data-[state=active]:from-yellow-500 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
            >
              ⭐ Đánh giá GV
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="whitespace-nowrap px-4 py-2.5 text-sm font-medium rounded-xl data-[state=active]:bg-linear-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
            >
              ⚙️ Cài đặt
            </TabsTrigger>
          </TabsList>

          {/* Tab Tổng quan */}
          <TabsContent value="overview" className="mt-6">
            <OverviewTab
              statsLoading={statsLoading}
              dashboardData={dashboardData}
              studentsBySubject={studentsBySubject}
              pieColors={pieColors}
              revenueByMonth={revenueByMonth}
              pendingTransfers={pendingTransfers}
              setActiveTab={setActiveTab}
            />
          </TabsContent>
          <TabsContent value="accounts" className="mt-6">
            <UsersTab
              isAdmin={isAdmin}
              effectiveBranchFilter={effectiveBranchFilter}
              getBranchName={getBranchName}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              setShowImportModal={setShowImportModal}
              setShowModal={setShowModal}
              activeAccountTab={activeAccountTab}
              setActiveAccountTab={setActiveAccountTab}
              branches={branches}
              selectedBranchFilter={selectedBranchFilter}
              setSelectedBranchFilter={setSelectedBranchFilter}
              scholarshipFilter={scholarshipFilter}
              setScholarshipFilter={setScholarshipFilter}
              scholarshipTypeFilter={scholarshipTypeFilter}
              setScholarshipTypeFilter={setScholarshipTypeFilter}
              apiStudents={apiStudents}
              apiParents={apiParents}
              apiTeachers={apiTeachers}
              usersLoading={usersLoading}
              setSelectedUserDetail={setSelectedUserDetail}
            />
          </TabsContent>

          <TabsContent value="courses" className="mt-6">
            <ClassesTab
              classes={classes}
              setShowImportStudentsModal={setShowImportStudentsModal}
              setEditingClass={setEditingClass}
              setShowClassModal={setShowClassModal}
              classBranchFilter={classBranchFilter}
              setClassBranchFilter={setClassBranchFilter}
              classSearchQuery={classSearchQuery}
              setClassSearchQuery={setClassSearchQuery}
              branches={branches}
              setClassStudentsModal={setClassStudentsModal}
              setClassDetailModal={setClassDetailModal}
            />
          </TabsContent>

          <TabsContent value="class-transfer" className="mt-6">
            <Card className="p-6 space-y-5 bg-white border-0 shadow-lg">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-gray-900 text-lg">Quản lý chuyển lớp</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Theo dõi, duyệt và tra cứu lịch sử yêu cầu chuyển lớp tại một nơi riêng.
                  </p>
                </div>
              </div>
              <ClassTransferRequestsPanel
                onAfterDecision={async () => {
                  await fetchClasses();
                  await refreshTransferPendingCount();
                }}
                onRequestsLoaded={(requests) => {
                  const pending = requests.filter((item) => item.status === "pending").length;
                  setTransferPendingCount(pending);
                }}
              />
            </Card>
          </TabsContent>

          <TabsContent value="leaderboard" className="mt-6">
            <LeaderboardTab
              leaderboardBranch={leaderboardBranch}
              setLeaderboardBranch={setLeaderboardBranch}
              branches={branches}
              leaderboardOptions={{
                score: { label: "Điểm số" },
                attendance: { label: "Chuyên cần" },
              }}
              rankingView={rankingView}
              setRankingView={setRankingView}
              tabIcons={{ score: "���", attendance: "���" }}
              leaderboardLoading={leaderboardLoading}
              leaderboard={leaderboard}
            />
          </TabsContent>

          <TabsContent value="finance" className="mt-6">
            <FinanceTab
              selectedBranch={selectedBranch}
              setSelectedBranch={setSelectedBranch}
              selectedYear={selectedYear}
              setSelectedYear={setSelectedYear}
              branches={branches}
              financeLoading={financeLoading}
              financeError={financeError}
              clearFinanceError={clearFinanceError}
              fetchDashboard={fetchDashboard}
              financeDashboard={financeDashboard}
              weeklyClassReport={weeklyClassReport}
              classHealthRiskFilter={classHealthRiskFilter}
              setClassHealthRiskFilter={setClassHealthRiskFilter}
              classHealth={classHealth}
              setShowExpenseModal={setShowExpenseModal}
              expenses={expenses}
              handleDeleteExpense={handleDeleteExpense}
              showExpenseModal={showExpenseModal}
              handleAddExpense={handleAddExpense}
            />
          </TabsContent>

          <TabsContent value="branches" className="mt-6">
            <BranchesTab
              branches={branches}
              branchesLoading={branchesLoading}
              handleAddBranch={handleAddBranch}
              handleEditBranch={handleEditBranch}
              handleDeleteBranch={handleDeleteBranch}
            />
          </TabsContent>

          <TabsContent value="payments" className="mt-6">
            <PaymentsTab />
          </TabsContent>

          <TabsContent value="incidents" className="mt-6">
            <IncidentsTab />
          </TabsContent>

          <TabsContent value="evaluations" className="mt-6">
            <EvaluationsTab />
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <SettingsTab />
          </TabsContent>

          <TabsContent value="attendance" className="mt-6">
            <AttendanceTab />
          </TabsContent>

          <TabsContent value="schedule" className="mt-6">
            <ScheduleTab userId={user.id} userRole={user.role} />
          </TabsContent>
        </Tabs>
      </main>

      {showModal && (
        <AddModal
          title={showModal.title}
          fields={showModal.fields}
          branches={branches}
          onClose={() => {
            setShowModal(null);
            setAddUserError(null);
          }}
          onSubmit={handleAddUser}
          isLoading={addUserLoading}
          error={addUserError}
        />
      )}

      {/* Import Users Modal */}
      <ImportUsersModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        branches={branches}
        onImport={handleImportUsers}
        onDownloadTemplate={handleDownloadTemplate}
      />

      {/* Branch Modal */}
      <BranchModal
        isOpen={showBranchModal}
        branch={editingBranch}
        onClose={() => {
          setShowBranchModal(false);
          setEditingBranch(null);
        }}
        onSave={handleSaveBranch}
      />

      {/* User Detail Modal */}
      {selectedUserDetail && (
        <UserDetailModal
          user={selectedUserDetail}
          branchName={getBranchName(selectedUserDetail.branchId)}
          onClose={() => setSelectedUserDetail(null)}
          onEdit={() => {
            setEditingUser(selectedUserDetail);
            setSelectedUserDetail(null);
          }}
          onDelete={async () => {
            if (
              confirm(
                `Bạn có chắc muốn xóa tài khoản "${selectedUserDetail.name}"?`,
              )
            ) {
              try {
                const { deleteUser } = useUsersStore.getState();
                await deleteUser(selectedUserDetail._id);
                setSelectedUserDetail(null);
                await fetchUsers();
              } catch (error) {
                console.error("Error deleting user:", error);
                alert("Lỗi khi xóa tài khoản");
              }
            }
          }}
        />
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <EditUserModal
          user={editingUser}
          branches={branches}
          onClose={() => {
            setEditingUser(null);
            setEditUserError(null);
          }}
          onSave={async (data) => {
            setEditUserLoading(true);
            setEditUserError(null);
            try {
              const { updateUser } = useUsersStore.getState();
              await updateUser(editingUser._id, data);
              setEditingUser(null);
              await fetchUsers();
            } catch (err: unknown) {
              setEditUserError(
                (err as Error).message || "Lỗi khi cập nhật tài khoản",
              );
            } finally {
              setEditUserLoading(false);
            }
          }}
          isLoading={editUserLoading}
          error={editUserError}
        />
      )}

      {/* Import Students Modal */}
      {showImportStudentsModal && (
        <ImportStudentsModal
          classes={classes}
          branches={branches}
          onClose={() => setShowImportStudentsModal(false)}
          onSuccess={() => {
            fetchClasses();
            fetchUsers();
          }}
        />
      )}

      {/* Class Form Modal */}
      {showClassModal && (
        <ClassFormModal
          classData={editingClass}
          branches={branches}
          teachers={users.filter((u) => u.role === "teacher")}
          onClose={() => {
            setShowClassModal(false);
            setEditingClass(null);
          }}
          onSuccess={() => {
            fetchClasses();
          }}
        />
      )}

      {/* Class Students Modal */}
      {classStudentsModal && (
        <ClassStudentsModal
          classData={classStudentsModal}
          branchId={
            typeof classStudentsModal.branchId === "object" &&
            classStudentsModal.branchId
              ? classStudentsModal.branchId._id
              : classStudentsModal.branchId ||
                classStudentsModal.branch?._id ||
                ""
          }
          onClose={() => setClassStudentsModal(null)}
          onUpdate={() => {
            fetchClasses();
            fetchUsers();
          }}
          onTransferRequestCreated={() => {
            refreshTransferPendingCount().catch(console.error);
          }}
          onNavigateToTransferTab={() => {
            setActiveTab("class-transfer");
            refreshTransferPendingCount().catch(console.error);
          }}
        />
      )}

      {/* Class Detail Modal */}
      {classDetailModal && (
        <ClassDetailModal
          classData={classDetailModal}
          onClose={() => setClassDetailModal(null)}
        />
      )}

      {showSettings && (
        <SettingsModal
          user={
            (fullUserDetails || user) as Parameters<
              typeof SettingsModal
            >[0]["user"]
          }
          onClose={() => setShowSettings(false)}
        />
      )}
      <ToastContainer />
    </div>
  );
}
