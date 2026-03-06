"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { ChevronDown, Camera, ChevronRight } from "lucide-react";
import { Bounce, ToastContainer, toast } from "react-toastify";
// @ts-expect-error - CSS import for react-toastify
import "react-toastify/dist/ReactToastify.css";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ChatWindow from "@/components/chat-window";
import NotificationCenter from "@/components/notification-center";
import IncidentReportModal from "@/components/pages/incident-report-modal";
import StudentEvaluationTab from "@/components/student-evaluation-tab";
import { useStudentDashboardStore } from "@/lib/stores/student-dashboard-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useAttendanceStore } from "@/lib/stores/attendance-store";
import { usePaymentRequestsStore } from "@/lib/stores/payment-requests-store";
import { useDocumentsStore, Document } from "@/lib/stores/documents-store";
import { useLeaderboardStore } from "@/lib/stores/leaderboard-store";
import api, { API_BASE_URL } from "@/lib/api";
import { AlertTriangle } from "lucide-react";
import { uploadToCloudinary } from "@/lib/cloudinary";
import {
  studentGradingService,
  StudentGradeRecord,
  StudentRankInfo,
} from "@/lib/services/student-grading.service";
import { GRADE_CATEGORY_LABELS } from "@/lib/services/teacher-grading.service";

// Helper functions for week navigation
const getStartOfWeek = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  return new Date(d.setDate(diff));
};

const addDays = (date: Date, days: number): Date => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const formatDate = (date: Date): string => {
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  return `${day}/${month}`;
};

const formatWeekRange = (startOfWeek: Date): string => {
  const endOfWeek = addDays(startOfWeek, 6);
  const startDay = startOfWeek.getDate().toString().padStart(2, "0");
  const startMonth = (startOfWeek.getMonth() + 1).toString().padStart(2, "0");
  const endDay = endOfWeek.getDate().toString().padStart(2, "0");
  const endMonth = (endOfWeek.getMonth() + 1).toString().padStart(2, "0");
  const year = startOfWeek.getFullYear();

  if (startOfWeek.getMonth() === endOfWeek.getMonth()) {
    return `${startDay} - ${endDay}/${startMonth}/${year}`;
  }
  return `${startDay}/${startMonth} - ${endDay}/${endMonth}/${year}`;
};

const isSameWeek = (date1: Date, date2: Date): boolean => {
  const start1 = getStartOfWeek(date1);
  const start2 = getStartOfWeek(date2);
  return start1.getTime() === start2.getTime();
};

// Get all weeks in a year (from account creation to current date)
const getWeeksInYear = (
  year: number,
  accountCreatedAt: Date,
  currentDate: Date,
): { value: string; label: string; startDate: Date }[] => {
  const weeks: { value: string; label: string; startDate: Date }[] = [];

  // Start from first Monday of the year
  let date = new Date(year, 0, 1);
  const day = date.getDay();
  const diff = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
  date.setDate(date.getDate() + diff);

  const accountStart = getStartOfWeek(accountCreatedAt);
  accountStart.setHours(0, 0, 0, 0);
  const currentWeekStart = getStartOfWeek(currentDate);
  currentWeekStart.setHours(0, 0, 0, 0);

  while (
    date.getFullYear() === year ||
    (date.getFullYear() === year + 1 &&
      date.getMonth() === 0 &&
      date.getDate() <= 7)
  ) {
    const weekStart = new Date(date);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = addDays(weekStart, 6);

    // Only include weeks from account creation to current week
    if (
      weekStart.getTime() >= accountStart.getTime() &&
      weekStart.getTime() <= currentWeekStart.getTime()
    ) {
      const startStr = `${weekStart.getDate().toString().padStart(2, "0")}/${(
        weekStart.getMonth() + 1
      )
        .toString()
        .padStart(2, "0")}`;
      const endStr = `${weekEnd.getDate().toString().padStart(2, "0")}/${(
        weekEnd.getMonth() + 1
      )
        .toString()
        .padStart(2, "0")}`;

      weeks.push({
        value: weekStart.toISOString(),
        label: `${startStr} To ${endStr}`,
        startDate: weekStart,
      });
    }

    date = addDays(date, 7);

    // Stop if we've passed the current date
    if (weekStart.getTime() > currentWeekStart.getTime()) break;
  }

  return weeks;
};

// Get available years from account creation to current
const getAvailableYears = (
  accountCreatedAt: Date,
  currentDate: Date,
): number[] => {
  const years: number[] = [];
  const startYear = accountCreatedAt.getFullYear();
  const endYear = currentDate.getFullYear();

  for (let year = endYear; year >= startYear; year--) {
    years.push(year);
  }

  return years;
};

const DAY_NAMES = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const DAY_NAMES_VN = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

interface StudentDashboardProps {
  user: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    role: string;
    studentCode: string;
    gender: string;
    avatarUrl?: string;
  };
  onLogout: () => void;
}

type DaySchedule = {
  day: string;
  date: string;
  code: string;
  subject: string;
  teacher: string;
  room: string;
  time: string;
  status: "confirmed" | "pending" | "unconfirmed";
  sessionId?: string;
  attendanceStatus?: "present" | "absent" | "late" | "excused" | null;
};

type RankingCategory = "score" | "attendance";

const overviewCards = [
  {
    label: "Khóa học",
    value: 3,
    note: "Đang theo học",
    icon: "📚",
    color: "from-blue-500 to-blue-600",
  },
  {
    label: "Buổi học tới",
    value: 2,
    note: "Tuần này",
    icon: "📅",
    color: "from-emerald-500 to-emerald-600",
  },
  {
    label: "Điểm TB",
    value: 78.3,
    note: "Đạt kết quả tốt",
    icon: "⭐",
    color: "from-amber-500 to-orange-500",
  },
  {
    label: "Bài tập",
    value: 12,
    note: "Chưa nộp",
    icon: "📝",
    color: "from-purple-500 to-purple-600",
  },
];

// streakCards removed - now using dynamic attendance streak data

// badges removed - now using dynamic badges computed from attendance data

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

// Không còn mock data scheduleWeek - sử dụng dữ liệu thật từ API

// progressData sẽ được tính từ studentGrades thật

const contacts = [
  {
    name: "Cô Trần Thị B",
    subject: "Dạy môn Toán",
    avatar: "👩‍🏫",
    status: "online",
  },
  {
    name: "Thầy Lê Văn E",
    subject: "Dạy môn Anh văn",
    avatar: "👨‍🏫",
    status: "offline",
  },
];

const gradeBreakdown = {
  assignments: [
    {
      name: "Bài kiểm tra giữa kỳ",
      score: 8.5,
      weight: "30%",
      date: "15/01/2025",
    },
    { name: "Bài tập về nhà 1", score: 9.0, weight: "10%", date: "20/01/2025" },
    { name: "Bài tập về nhà 2", score: 8.0, weight: "10%", date: "25/01/2025" },
    { name: "Kiểm tra 15 phút", score: 7.5, weight: "20%", date: "28/01/2025" },
    { name: "Thi cuối kỳ", score: 8.8, weight: "30%", date: "05/02/2025" },
  ],
  attendance: "28/30 buổi (93.3%)",
  behavior: "Tốt - Em rất chăm chỉ và tích cực trong lớp",
  teacherComment:
    "Em học tập tốt, có tinh thần tự giác cao. Cần chú ý thêm vào phần bài tập nâng cao để phát triển tư duy.",
};

const classDetail = {
  subject: "Toán",
  day: "Thứ 2",
  time: "17:00-18:30",
  room: "Phòng A1",
  teacher: "Cô Trần Thị B",
  email: "teacher@daythempro.com",
  phone: "0123 456 789",
  content: [
    "Ôn tập kiến thức tuần trước",
    "Giới thiệu chuyên đề mới",
    "Bài tập thực hành",
    "Kiểm tra kiến thức",
  ],
  requirements: [
    "Mang theo vở ghi chép và bút chì",
    "Ôn tập bài cũ trước khi đến lớp",
    "Chuẩn bị máy tính (nếu cần thiết)",
    "Đến lớp 5 phút trước giờ bắt đầu",
  ],
  stats: { total: 12, attended: 11, absent: 1 },
};

function ClassDetailModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-3">
      <Card className="w-full max-w-3xl p-6 max-h-[90vh] overflow-y-auto bg-white">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">Chi tiết lớp học</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-lg"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 p-4 bg-blue-50">
            <h3 className="font-semibold text-gray-900 mb-2">
              Thông tin cơ bản
            </h3>
            <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
              <p>Môn học: {classDetail.subject}</p>
              <p>Ngày dạy: {classDetail.day}</p>
              <p>Giờ học: {classDetail.time}</p>
              <p>Phòng học: {classDetail.room}</p>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 p-4 bg-purple-50">
            <h3 className="font-semibold text-gray-900 mb-2">
              Thông tin giáo viên
            </h3>
            <p className="text-sm text-gray-700">{classDetail.teacher}</p>
            <p className="text-sm text-gray-700">Email: {classDetail.email}</p>
            <p className="text-sm text-gray-700">SĐT: {classDetail.phone}</p>
          </div>

          <div className="rounded-lg border border-gray-200 p-4 bg-green-50">
            <h3 className="font-semibold text-gray-900 mb-2">
              Nội dung bài học
            </h3>
            <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
              {classDetail.content.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-gray-200 p-4 bg-yellow-50">
            <h3 className="font-semibold text-gray-900 mb-2">
              Yêu cầu chuẩn bị
            </h3>
            <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
              {classDetail.requirements.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Card className="p-4 text-center">
              <p className="text-sm text-gray-500">Tổng buổi học</p>
              <p className="text-2xl font-bold text-gray-900">
                {classDetail.stats.total}
              </p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-sm text-gray-500">Buổi đã học</p>
              <p className="text-2xl font-bold text-green-600">
                {classDetail.stats.attended}
              </p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-sm text-gray-500">Vắng mặt</p>
              <p className="text-2xl font-bold text-red-600">
                {classDetail.stats.absent}
              </p>
            </Card>
          </div>

          <Button
            className="w-full bg-blue-600 hover:bg-blue-700"
            onClick={onClose}
          >
            Đóng
          </Button>
        </div>
      </Card>
    </div>
  );
}

function GradeDetailModal({
  subject,
  grades,
  onClose,
}: {
  subject: string;
  grades: StudentGradeRecord[];
  onClose: () => void;
}) {
  // Calculate average
  const total = grades.reduce((acc, g) => acc + g.score, 0);
  const max = grades.reduce((acc, g) => acc + g.maxScore, 0);
  const average = max > 0 ? ((total / max) * 10).toFixed(1) : "N/A";

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-3">
      <Card className="w-full max-w-3xl p-6 max-h-[90vh] overflow-y-auto bg-white">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">
            Chi tiết điểm số - {subject}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-lg"
          >
            ×
          </button>
        </div>

        <p className="text-sm text-gray-700 mb-4">
          Điểm trung bình hệ số 10:{" "}
          <span className="font-bold text-blue-600">{average}</span>
        </p>

        <div className="space-y-3 mb-4 max-h-[60vh] overflow-y-auto">
          {grades.length > 0 ? (
            grades.map((g, index) => (
              <div
                key={g._id || index}
                className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    {g.gradingSheetId?.title || "Bài kiểm tra"}
                  </p>
                  <p className="text-xs text-gray-600">
                    Ngày: {new Date(g.gradedAt).toLocaleDateString("vi-VN")} •
                    Loại:{" "}
                    {GRADE_CATEGORY_LABELS[
                      g.gradingSheetId
                        ?.category as keyof typeof GRADE_CATEGORY_LABELS
                    ] ||
                      g.gradingSheetId?.category ||
                      "Khác"}
                  </p>
                  {g.feedback && (
                    <p className="text-xs text-blue-600 italic mt-1">
                      " {g.feedback} "
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-blue-700">
                    {g.score}/{g.maxScore}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-gray-500 text-center py-4">
              Chưa có dữ liệu điểm chi tiết.
            </p>
          )}
        </div>

        <Button
          className="w-full bg-blue-600 hover:bg-blue-700"
          onClick={onClose}
        >
          Đóng
        </Button>
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
    phone?: string;
    studentCode: string;
    parentName?: string;
    parentPhone?: string;
    dateOfBirth?: string;
    gender?: string;
    avatarUrl?: string;
  };
  onClose: () => void;
}) {
  // State để hiển thị preview ảnh
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
    dateOfBirth: user.dateOfBirth
      ? new Date(user.dateOfBirth).toISOString().split("T")[0]
      : "",
    gender: user.gender || "",
  });

  // Xử lý khi chọn file ảnh
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setAvatarPreview(url);
      setSelectedFile(file);
    }
  };

  // Hàm kích hoạt input file
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
        } catch (error) {
          toast.error("Không thể tải ảnh lên. Vui lòng thử lại.");
          setIsLoading(false);
          return;
        }
      }

      await api.patch(`/users/${userId}`, {
        name: formData.name,
        phone: formData.phone,
        dateOfBirth: formData.dateOfBirth,
        gender: formData.gender,
        avatarURL: avatarUrl,
      });

      toast.success("Cập nhật thông tin thành công!");
      setIsEditing(false);
      // Reload page to reflect changes or rely on parent refetch
      window.location.reload();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Cập nhật thất bại");
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
                <img
                  src={avatarPreview}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-linear-to-br from-blue-500 to-indigo-600 text-white text-4xl font-bold select-none">
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
        x{/* Form Inputs */}
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <label className="text-gray-700 font-medium">Giới tính</label>
              {isEditing ? (
                <select
                  className="w-full rounded-lg border border-blue-300 px-3 py-2.5 transition-all appearance-none"
                  value={formData.gender}
                  onChange={(e) => handleInputChange("gender", e.target.value)}
                >
                  <option value="">Chọn giới tính</option>
                  <option value="male">Nam</option>
                  <option value="female">Nữ</option>
                  <option value="other">Khác</option>
                </select>
              ) : (
                <input
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 focus:outline-none bg-gray-50 text-gray-700"
                  defaultValue={
                    user.gender === "male"
                      ? "Nam"
                      : user.gender === "female"
                        ? "Nữ"
                        : user.gender === "other"
                          ? "Khác"
                          : "Chưa cập nhật"
                  }
                  readOnly
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-gray-700 font-medium">Ngày sinh</label>
              <input
                type={isEditing ? "date" : "text"}
                className={`w-full rounded-lg border px-3 py-2.5 transition-all ${
                  isEditing
                    ? "border-blue-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    : "border-gray-300"
                }`}
                value={
                  isEditing
                    ? formData.dateOfBirth
                    : user.dateOfBirth
                      ? new Date(user.dateOfBirth).toLocaleDateString("vi-VN")
                      : "Chưa cập nhật"
                }
                onChange={(e) =>
                  handleInputChange("dateOfBirth", e.target.value)
                }
                readOnly={!isEditing}
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
                value={
                  isEditing ? formData.phone : user.phone || "Chưa cập nhật"
                }
                onChange={(e) => handleInputChange("phone", e.target.value)}
                readOnly={!isEditing}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-gray-700 font-medium">Mã số học sinh</label>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5"
              defaultValue={user.studentCode || "Chưa có"}
              readOnly
            />
          </div>

          <div className="space-y-2">
            <label className="text-gray-700 font-medium">Email</label>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5"
              defaultValue={user.email}
              readOnly
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-gray-700 font-medium">
                Họ và tên phụ huynh
              </label>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5"
                defaultValue={user.parentName || "Chưa có"}
                readOnly
              />
            </div>
            <div className="space-y-2">
              <label className="text-gray-700 font-medium">
                Số điện thoại phụ huynh
              </label>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5"
                defaultValue={user.parentPhone || "Chưa cập nhật"}
                readOnly
              />
            </div>
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
                      dateOfBirth: user.dateOfBirth
                        ? new Date(user.dateOfBirth).toISOString().split("T")[0]
                        : "",
                      gender: user.gender || "",
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

export default function StudentDashboard({
  user,
  onLogout,
}: StudentDashboardProps) {
  const [avatarPreview, setAvatarPreview] = useState<string | null>(
    user.avatarUrl || null,
  );

  // Sync avatarPreview when user prop or fullUserDetails changes
  useEffect(() => {
    if (user.avatarUrl) {
      setAvatarPreview(user.avatarUrl);
    }
  }, [user.avatarUrl]);
  const [chatWith, setChatWith] = useState<{
    name: string;
    role: string;
  } | null>(null);
  const [showClassDetail, setShowClassDetail] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState<{
    subject: string;
    score: number;
  } | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showDocumentsModal, setShowDocumentsModal] = useState(false);
  const [studentDocuments, setStudentDocuments] = useState<Document[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [selectedBadge, setSelectedBadge] = useState<{
    title: string;
    desc: string;
    earned: boolean;
    icon: string;
    howTo: string;
    progress: string;
    progressPercent: number;
  } | null>(null);

  const handleLogout = () => {
    toast.info("Đang đăng xuất...", {
      position: "top-right",
      autoClose: 500,
      hideProgressBar: true,
      closeOnClick: true,
      pauseOnHover: false,
      draggable: true,
      progress: undefined,
      theme: "light",
      transition: Bounce,
    });
    setTimeout(() => {
      onLogout();
    }, 500);
  };

  //Dropdown Profile
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [rankingView, setRankingView] = useState<RankingCategory>("score");
  //Xử lý click ra ngoài để đóng menu
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

  // Week navigation state
  const [selectedYear, setSelectedYear] = useState<number>(() =>
    new Date().getFullYear(),
  );
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(() =>
    getStartOfWeek(new Date()),
  );

  // Fetch real data from API
  const {
    data: dashboardData,
    isLoading: dashboardLoading,
    fetchDashboardData,
  } = useStudentDashboardStore();
  const { user: authUser, accessToken } = useAuthStore();

  const { records: attendanceRecords, fetchAttendance } = useAttendanceStore();
  const { myRequests, fetchMyRequests } = usePaymentRequestsStore();

  // Attendance streak data
  const [attendanceStreak, setAttendanceStreak] = useState<{
    currentStreak: number;
    bestStreak: number;
    totalPresent: number;
    totalSessions: number;
  }>({ currentStreak: 0, bestStreak: 0, totalPresent: 0, totalSessions: 0 });

  // Leaderboard store
  const {
    leaderboard,
    myRank,
    loading: leaderboardLoading,
    fetchLeaderboard,
    fetchMyRank,
  } = useLeaderboardStore();

  // State to hold full user details including sensitive/personal info not in initial props
  const [fullUserDetails, setFullUserDetails] = useState<any>(null);

  // REAL GRADING DATA INTEGRATION (Moved here to access authUser)
  const [studentGrades, setStudentGrades] = useState<StudentGradeRecord[]>([]);

  // State cho xếp hạng theo từng lớp
  const [classRankings, setClassRankings] = useState<
    Record<string, StudentRankInfo>
  >({});

  useEffect(() => {
    const fetchGrades = async () => {
      try {
        const userId = authUser?._id || user.id;
        if (userId) {
          const data = await studentGradingService.getMyGrades(userId);
          setStudentGrades(data);

          // Lấy xếp hạng cho từng lớp học sinh đang học
          const classIds = [
            ...new Set(data.map((g) => g.classId?._id).filter(Boolean)),
          ];
          const rankings: Record<string, StudentRankInfo> = {};

          for (const classId of classIds) {
            try {
              const rankInfo =
                await studentGradingService.getStudentRankInClass(
                  userId,
                  classId as string,
                );
              rankings[classId as string] = rankInfo;
            } catch (err) {
              console.error(`Failed to fetch rank for class ${classId}`, err);
            }
          }
          setClassRankings(rankings);
        }
      } catch (err) {
        console.error("Failed to fetch student grades", err);
      }
    };
    fetchGrades();
  }, [authUser, user.id]);

  // Process grades into subjects for display
  const processedSubjects = useMemo(() => {
    if (!studentGrades.length) return [];

    // Group by Class Name
    const groups: Record<string, StudentGradeRecord[]> = {};
    studentGrades.forEach((g) => {
      const key = g.classId?.name || "Lớp học";
      if (!groups[key]) groups[key] = [];
      groups[key].push(g);
    });

    return Object.keys(groups).map((subject) => {
      const list = groups[subject];
      let totalScore = 0;
      let totalMax = 0;
      list.forEach((g) => {
        totalScore += g.score;
        totalMax += g.maxScore;
      });

      let avg = 0;
      if (totalMax > 0) {
        avg = (totalScore / totalMax) * 10;
      }

      const scoreVal = parseFloat(avg.toFixed(1));
      const status =
        scoreVal >= 8
          ? "Tốt"
          : scoreVal >= 6.5
            ? "Khá"
            : scoreVal >= 5
              ? "Trung bình"
              : "Yếu";

      return {
        subject,
        score: scoreVal,
        status,
        detail: `${list.length} đầu điểm`,
      };
    });
  }, [studentGrades]);

  // Tính progressData từ studentGrades - biểu đồ điểm theo các bài kiểm tra, nhóm theo môn
  const progressData = useMemo(() => {
    if (!studentGrades.length) return [];

    // Sắp xếp theo ngày chấm điểm
    const sortedGrades = [...studentGrades].sort(
      (a, b) => new Date(a.gradedAt).getTime() - new Date(b.gradedAt).getTime(),
    );

    // Tạo data cho biểu đồ: mỗi bài kiểm tra là 1 điểm trên biểu đồ
    return sortedGrades.map((grade, index) => {
      const title =
        grade.gradingSheetId?.title ||
        grade.assignmentId?.title ||
        `Bài ${index + 1}`;
      const className = grade.classId?.name || "";
      const scorePercent =
        grade.maxScore > 0 ? (grade.score / grade.maxScore) * 10 : 0;

      return {
        name: title.length > 15 ? title.substring(0, 15) + "..." : title,
        fullName: title,
        score: parseFloat(scorePercent.toFixed(1)),
        className,
        category: grade.gradingSheetId?.category || grade.category || "khac",
        date: new Date(grade.gradedAt).toLocaleDateString("vi-VN"),
      };
    });
  }, [studentGrades]);

  // Tính điểm trung bình hiện tại (tuần này / tổng)
  const averageScore = useMemo(() => {
    if (!studentGrades.length) return 0;

    let totalScore = 0;
    let totalMax = 0;
    studentGrades.forEach((g) => {
      totalScore += g.score;
      totalMax += g.maxScore;
    });

    if (totalMax === 0) return 0;
    return parseFloat(((totalScore / totalMax) * 10).toFixed(1));
  }, [studentGrades]);

  // Tính điểm tuần trước để so sánh
  const lastWeekAverage = useMemo(() => {
    if (!studentGrades.length) return 0;

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const lastWeekGrades = studentGrades.filter(
      (g) => new Date(g.gradedAt) < oneWeekAgo,
    );

    if (!lastWeekGrades.length) return 0;

    let totalScore = 0;
    let totalMax = 0;
    lastWeekGrades.forEach((g) => {
      totalScore += g.score;
      totalMax += g.maxScore;
    });

    if (totalMax === 0) return 0;
    return parseFloat(((totalScore / totalMax) * 10).toFixed(1));
  }, [studentGrades]);

  // Tạo data cho biểu đồ theo từng môn
  const progressBySubject = useMemo(() => {
    if (!studentGrades.length) return [];

    // Nhóm theo classId (môn học)
    const groups: Record<
      string,
      { name: string; classId: string; grades: typeof studentGrades }
    > = {};

    studentGrades.forEach((g) => {
      const key = g.classId?._id || "unknown";
      const name = g.classId?.name || "Lớp học";
      if (!groups[key]) {
        groups[key] = { name, classId: key, grades: [] };
      }
      groups[key].grades.push(g);
    });

    // Tạo series data cho mỗi môn
    return Object.values(groups).map((group) => {
      const sortedGrades = [...group.grades].sort(
        (a, b) =>
          new Date(a.gradedAt).getTime() - new Date(b.gradedAt).getTime(),
      );

      // Lấy thông tin xếp hạng của lớp này
      const rankInfo = classRankings[group.classId];

      return {
        name: group.name,
        classId: group.classId,
        rank: rankInfo?.rank || null,
        totalStudents: rankInfo?.totalStudents || 0,
        data: sortedGrades.map((g, i) => ({
          label: g.gradingSheetId?.title || `Bài ${i + 1}`,
          score:
            g.maxScore > 0
              ? parseFloat(((g.score / g.maxScore) * 10).toFixed(1))
              : 0,
          date: new Date(g.gradedAt).toLocaleDateString("vi-VN"),
        })),
      };
    });
  }, [studentGrades, classRankings]);

  // Tính tổng xếp hạng (trung bình các lớp)
  const overallRanking = useMemo(() => {
    const ranks = Object.values(classRankings).filter((r) => r.rank !== null);
    if (ranks.length === 0) return null;

    // Tìm ranking tốt nhất (số thứ tự thấp nhất)
    const bestRank = Math.min(...ranks.map((r) => r.rank!));
    const totalStudentsOfBestRank =
      ranks.find((r) => r.rank === bestRank)?.totalStudents || 0;

    return {
      bestRank,
      totalStudents: totalStudentsOfBestRank,
      classCount: ranks.length,
    };
  }, [classRankings]);

  // Shadow actual data over mock 'grades'
  const grades = processedSubjects.length > 0 ? processedSubjects : [];

  useEffect(() => {
    const fetchFullUserDetails = async () => {
      try {
        const userId = authUser?._id || user.id;
        if (userId) {
          const response = await api.get(`/users/${userId}`);
          setFullUserDetails(response.data);
          console.log("Data của user:", response.data);
        }
      } catch (error) {
        console.error("Failed to fetch full user details:", error);
      }
    };
    fetchFullUserDetails();
  }, [authUser, user.id]);

  // Sync avatarPreview when fullUserDetails is loaded
  useEffect(() => {
    if (fullUserDetails?.avatarURL) {
      setAvatarPreview(fullUserDetails.avatarURL);
    } else if (fullUserDetails?.avatarUrl) {
      // Handle both casing just in case
      setAvatarPreview(fullUserDetails.avatarUrl);
    }
  }, [fullUserDetails]);

  // Fetch documents for student
  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        setDocumentsLoading(true);
        const response = await api.get("/documents/for-student");
        setStudentDocuments(response.data);
      } catch (error) {
        console.error("Failed to fetch documents:", error);
      } finally {
        setDocumentsLoading(false);
      }
    };
    if (authUser || user) {
      fetchDocuments();
    }
  }, [authUser, user]);

  // Function to increment download count
  const incrementDownload = async (documentId: string) => {
    try {
      await api.patch(`/documents/${documentId}/download`);
    } catch (error) {
      console.error("Failed to increment download count:", error);
    }
  };

  useEffect(() => {
    if (user || authUser) {
      fetchMyRequests();
    }
  }, [user, authUser, fetchMyRequests]);

  const pendingPayments = myRequests.filter(
    (r) => r.status === "pending" || r.status === "overdue",
  );
  const paidPayments = myRequests.filter((r) => r.status === "paid");
  const totalPendingAmount = pendingPayments.reduce(
    (sum, r) => sum + r.finalAmount,
    0,
  );
  const totalPaidAmount = paidPayments.reduce(
    (sum, r) => sum + r.finalAmount,
    0,
  );

  // Calculate the earliest date (account creation date)
  const accountCreatedAt = useMemo(() => {
    const createdAt = authUser?.createdAt;
    if (createdAt) {
      return getStartOfWeek(new Date(createdAt));
    }
    // Default to 1 year ago if no createdAt
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    return getStartOfWeek(oneYearAgo);
  }, [authUser?.createdAt]);

  // Current week start for comparison
  const currentWeekStart = useMemo(() => getStartOfWeek(new Date()), []);
  const currentDate = useMemo(() => new Date(), []);

  // Get available years and weeks
  const availableYears = useMemo(
    () => getAvailableYears(accountCreatedAt, currentDate),
    [accountCreatedAt, currentDate],
  );

  const weeksInSelectedYear = useMemo(
    () => getWeeksInYear(selectedYear, accountCreatedAt, currentDate),
    [selectedYear, accountCreatedAt, currentDate],
  );

  // Check if current week is selected
  const isCurrentWeek = isSameWeek(selectedWeekStart, new Date());

  // Handle year change
  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    // Auto-select the latest week in that year
    const weeks = getWeeksInYear(year, accountCreatedAt, currentDate);
    if (weeks.length > 0) {
      // If it's current year, select current week; otherwise select last week of that year
      if (year === currentDate.getFullYear()) {
        setSelectedWeekStart(currentWeekStart);
      } else {
        setSelectedWeekStart(weeks[weeks.length - 1].startDate);
      }
    }
  };

  // Handle week change
  const handleWeekChange = (weekValue: string) => {
    setSelectedWeekStart(new Date(weekValue));
  };

  // Go to current week
  const goToCurrentWeek = () => {
    setSelectedYear(currentDate.getFullYear());
    setSelectedWeekStart(currentWeekStart);
  };

  // Helper function to get attendance status for a session or by date
  const getAttendanceForSession = (sessionId: string) => {
    const record = attendanceRecords.find((r) => {
      // sessionId might be a string or populated object
      const sid =
        typeof r.sessionId === "string"
          ? r.sessionId
          : (r.sessionId as any)?._id;
      return sid === sessionId;
    });
    return record?.status || null;
  };

  // Helper function to get attendance by date and class
  const getAttendanceByDateAndClass = (date: Date, classId?: string) => {
    // Format date to compare (YYYY-MM-DD)
    const targetYear = date.getFullYear();
    const targetMonth = date.getMonth();
    const targetDay = date.getDate();

    const record = attendanceRecords.find((r) => {
      // Check if sessionId is populated with date info
      const session = r.sessionId as any;
      if (session?.startTime) {
        const sessionDate = new Date(session.startTime);
        const sessionYear = sessionDate.getFullYear();
        const sessionMonth = sessionDate.getMonth();
        const sessionDay = sessionDate.getDate();

        if (
          sessionYear === targetYear &&
          sessionMonth === targetMonth &&
          sessionDay === targetDay
        ) {
          // If classId provided, match it too
          if (classId && session.classId) {
            const sessionClassId =
              typeof session.classId === "string"
                ? session.classId
                : session.classId._id;
            return sessionClassId === classId;
          }
          return true;
        }
      }
      // Also check createdAt if sessionId is not populated
      if (r.createdAt) {
        const recordDate = new Date(r.createdAt);
        const recordYear = recordDate.getFullYear();
        const recordMonth = recordDate.getMonth();
        const recordDay = recordDate.getDate();

        if (
          recordYear === targetYear &&
          recordMonth === targetMonth &&
          recordDay === targetDay
        ) {
          return true;
        }
      }
      return false;
    });
    return record?.status || null;
  };

  // Generate schedule for selected week
  const weekSchedule = useMemo(() => {
    const schedule: DaySchedule[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 7; i++) {
      const dayDate = addDays(selectedWeekStart, i);
      const dayName = DAY_NAMES[i];
      const dateStr = formatDate(dayDate);
      const isPast = dayDate < today;
      const isToday = dayDate.getTime() === today.getTime();

      // Check if there's a session from API data for this day
      let sessionForDay = null;
      if (dashboardData?.upcomingSessions) {
        sessionForDay = dashboardData.upcomingSessions.find((session) => {
          const sessionDate = new Date(session.date);
          sessionDate.setHours(0, 0, 0, 0);
          return sessionDate.getTime() === dayDate.getTime();
        });
      }

      // Also check class schedules from API
      let classForDay = null;
      if (dashboardData?.classes) {
        const dayOfWeek = dayDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
        for (const cls of dashboardData.classes) {
          const matchingSchedule = cls.schedule?.find(
            (s) => s.dayOfWeek === dayOfWeek,
          );
          if (matchingSchedule) {
            classForDay = { class: cls, schedule: matchingSchedule };
            break;
          }
        }
      }

      // Get attendance status - try by sessionId first, then by date
      const sessionId = sessionForDay?._id;
      let attendanceStatus = sessionId
        ? getAttendanceForSession(sessionId)
        : null;

      // If no attendance found by sessionId, try by date and class
      if (!attendanceStatus && classForDay) {
        attendanceStatus = getAttendanceByDateAndClass(
          dayDate,
          classForDay.class._id,
        );
      } else if (!attendanceStatus) {
        attendanceStatus = getAttendanceByDateAndClass(dayDate);
      }

      if (sessionForDay) {
        schedule.push({
          day: dayName,
          date: dateStr,
          code:
            sessionForDay.class?.name?.substring(0, 7).toUpperCase() || "CLASS",
          subject: sessionForDay.class?.name || "Lớp học",
          teacher: sessionForDay.class?.teacher?.name || "Giáo viên",
          room: "Phòng học",
          time: `${sessionForDay.startTime}-${sessionForDay.endTime}`,
          status: isPast
            ? "confirmed"
            : sessionForDay.status === "scheduled"
              ? "pending"
              : "confirmed",
          sessionId: sessionForDay._id,
          attendanceStatus,
        });
      } else if (classForDay) {
        schedule.push({
          day: dayName,
          date: dateStr,
          code: classForDay.class.name.substring(0, 7).toUpperCase(),
          subject: classForDay.class.name,
          teacher: classForDay.class.teacherName,
          room: classForDay.schedule.room || "Phòng học",
          time: `${classForDay.schedule.startTime}-${classForDay.schedule.endTime}`,
          status: isPast ? "confirmed" : "pending",
          attendanceStatus,
        });
      } else {
        // Không có lịch học ngày này
        schedule.push({
          day: dayName,
          date: dateStr,
          code: "",
          subject: "",
          teacher: "",
          room: "",
          time: "",
          status: "unconfirmed",
        });
      }
    }

    return schedule;
  }, [selectedWeekStart, dashboardData, attendanceRecords]);

  // Debug: log attendance records
  useEffect(() => {
    if (attendanceRecords.length > 0) {
      console.log("Attendance Records loaded:", attendanceRecords);
      attendanceRecords.forEach((r) => {
        const session = r.sessionId as any;
        console.log("Record:", {
          status: r.status,
          sessionId: r.sessionId,
          sessionStartTime: session?.startTime,
          sessionClassId: session?.classId,
          createdAt: r.createdAt,
        });
      });
    }
  }, [attendanceRecords]);

  useEffect(() => {
    // Fetch dashboard data when component mounts
    const studentId = authUser?._id || user.id;
    if (studentId) {
      fetchDashboardData(studentId).catch(console.error);
      // Fetch attendance records for this student
      fetchAttendance({ studentId }).catch(console.error);
      // Fetch attendance streak
      api
        .get("/attendance/streak", { params: { studentId } })
        .then((res) => setAttendanceStreak(res.data))
        .catch(console.error);
      // Fetch leaderboard (scoped to student's branch)
      const leaderboardParams: { branchId?: string; limit: number } = {
        limit: 10,
      };
      if (authUser?.branchId) {
        leaderboardParams.branchId = authUser.branchId;
      }
      fetchLeaderboard(leaderboardParams).catch(console.error);
      // Fetch my rank
      fetchMyRank().catch(console.error);
    }
    console.log("studentId: ", studentId);
  }, [
    authUser,
    user.id,
    fetchDashboardData,
    fetchAttendance,
    fetchLeaderboard,
    fetchMyRank,
  ]);

  // Compute dynamic overview cards based on real data
  const dynamicOverviewCards = dashboardData
    ? [
        {
          label: "Khóa học",
          value: dashboardData.classes.length,
          note: "Đang theo học",
          icon: "📚",
          color: "from-blue-500 to-blue-600",
        },
        {
          label: "Buổi học tới",
          value: dashboardData.upcomingSessions.length,
          note: "Sắp diễn ra",
          icon: "📅",
          color: "from-emerald-500 to-emerald-600",
        },
        {
          label: "Điểm TB",
          value:
            dashboardData.recentGrades.length > 0
              ? (
                  dashboardData.recentGrades.reduce(
                    (acc, g) => acc + g.percentage,
                    0,
                  ) / dashboardData.recentGrades.length
                ).toFixed(1)
              : "N/A",
          note:
            dashboardData.recentGrades.length > 0
              ? "Đạt kết quả"
              : "Chưa có điểm",
          icon: "⭐",
          color: "from-amber-500 to-orange-500",
        },
        {
          label: "Chuyên cần",
          value: `${dashboardData.attendanceStats.rate || 0}%`,
          note: `${dashboardData.attendanceStats.present}/${dashboardData.attendanceStats.total} buổi`,
          icon: "✅",
          color: "from-purple-500 to-purple-600",
        },
      ]
    : overviewCards;

  const statusStyle = (status: DaySchedule["status"]) => {
    if (status === "confirmed")
      return {
        label: "Đã xác nhận",
        className: "bg-emerald-500 hover:bg-emerald-600 text-white",
      };
    if (status === "pending")
      return {
        label: "Chưa xác nhận",
        className: "bg-amber-400 hover:bg-amber-500 text-white",
      };
    return {
      label: "Chưa xác nhận",
      className: "bg-[#89CFF0]/30 text-blue-700 hover:bg-[#89CFF0]/40",
    };
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-[#89CFF0]/20 to-white">
      <ToastContainer />
      {/* Header với thiết kế hiện đại */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Trường Thành" className="w-10 h-10 rounded-xl object-contain" />
            <div>
              <h1 className="text-lg font-bold bg-linear-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent">
                Trường Thành Education
              </h1>
              <p className="text-xs text-gray-500">Dashboard Học sinh</p>
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
                <div className="w-9 h-9 rounded-full bg-white text-white font-semibold text-sm shadow-md flex items-center justify-center transition-transform ring-2 ring-transparent group-focus:ring-gray-200 overflow-hidden">
                  {avatarPreview ? (
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
                    onClick={handleLogout}
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

      <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {pendingPayments.length > 0 && (
          <div
            onClick={() => (window.location.href = "/payment")}
            className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r cursor-pointer hover:bg-red-100 transition-colors shadow-sm"
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center">
                <AlertTriangle className="w-5 h-5 text-red-500 mr-3" />
                <div>
                  <p className="text-sm font-bold text-red-700">
                    Thông báo học phí
                  </p>
                  <p className="text-sm text-red-600">
                    Bạn có{" "}
                    <span className="font-bold">{pendingPayments.length}</span>{" "}
                    khoản cần thanh toán. Tổng tiền:{" "}
                    <span className="font-bold text-red-800">
                      {totalPendingAmount.toLocaleString("vi-VN")} đ
                    </span>
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="destructive"
                className="bg-red-600 hover:bg-red-700"
              >
                Thanh toán ngay
              </Button>
            </div>
          </div>
        )}
        {/* Lời chào thân thiện */}
        <div className="bg-linear-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-2xl p-6 text-white shadow-xl shadow-blue-200/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Xin chào 👋</p>
              <h2 className="text-2xl font-bold mt-1">{user.name}</h2>
              <p className="text-blue-100 mt-2 text-sm">
                Hôm nay là một ngày tuyệt vời để học tập!
              </p>
            </div>
            <div className="hidden md:block text-6xl opacity-80">🎓</div>
          </div>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="w-full overflow-x-auto flex gap-1 rounded-2xl bg-white p-1.5 shadow-sm border border-gray-100 justify-start md:justify-center">
            <TabsTrigger
              value="overview"
              className="whitespace-nowrap px-4 py-2.5 text-sm font-medium rounded-xl data-[state=active]:bg-linear-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
            >
              📊 Tổng quan
            </TabsTrigger>
            <TabsTrigger
              value="schedule"
              className="whitespace-nowrap px-4 py-2.5 text-sm font-medium rounded-xl data-[state=active]:bg-linear-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
            >
              📅 Lịch học
            </TabsTrigger>
            <TabsTrigger
              value="progress"
              className="whitespace-nowrap px-4 py-2.5 text-sm font-medium rounded-xl data-[state=active]:bg-linear-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
            >
              📈 Tiến độ
            </TabsTrigger>
            <TabsTrigger
              value="grades"
              className="whitespace-nowrap px-4 py-2.5 text-sm font-medium rounded-xl data-[state=active]:bg-linear-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
            >
              🏆 Điểm số
            </TabsTrigger>
            <TabsTrigger
              value="leaderboard"
              className="whitespace-nowrap px-4 py-2.5 text-sm font-medium rounded-xl data-[state=active]:bg-linear-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
            >
              🥇 Bảng xếp hạng
            </TabsTrigger>
            <TabsTrigger
              value="contact"
              className="whitespace-nowrap px-4 py-2.5 text-sm font-medium rounded-xl data-[state=active]:bg-linear-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
            >
              💬 Liên hệ
            </TabsTrigger>
            <TabsTrigger
              value="documents"
              className="whitespace-nowrap px-4 py-2.5 text-sm font-medium rounded-xl data-[state=active]:bg-linear-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
            >
              📚 Tài liệu
            </TabsTrigger>
            <TabsTrigger
              value="payment"
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
              value="evaluation"
              className="whitespace-nowrap px-4 py-2.5 text-sm font-medium rounded-xl data-[state=active]:bg-linear-to-r data-[state=active]:from-yellow-500 data-[state=active]:to-orange-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
            >
              ⭐ Đánh giá GV
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            {/* Loading state */}
            {dashboardLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-500">Đang tải dữ liệu...</p>
                </div>
              </div>
            )}

            {/* Overview Cards với gradient */}
            {!dashboardLoading && (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {dynamicOverviewCards.map((card) => (
                    <Card
                      key={card.label}
                      className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                    >
                      <div
                        className={`absolute inset-0 bg-linear-to-br ${card.color} opacity-90`}
                      />
                      <div className="relative p-5 text-white">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-white/80 text-sm font-medium">
                              {card.label}
                            </p>
                            <p className="text-3xl font-bold mt-2">
                              {card.value}
                            </p>
                            <p className="text-white/70 text-xs mt-1">
                              {card.note}
                            </p>
                          </div>
                          <span className="text-4xl opacity-80">
                            {card.icon}
                          </span>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </>
            )}

            {/* Financial Summary Card */}
            <Card className="rounded-2xl shadow-sm border border-gray-100 p-6 bg-white mt-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  💰 Thông tin học phí
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => (window.location.href = "/payment")}
                >
                  Chi tiết <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-red-50 border border-red-100">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm text-gray-600">Cần thanh toán</p>
                    <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">
                      {pendingPayments.length} khoản
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-red-600 truncate">
                    {totalPendingAmount.toLocaleString("vi-VN")} đ
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-green-50 border border-green-100">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm text-gray-600">Đã thanh toán</p>
                    <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full font-medium">
                      {paidPayments.length} khoản
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-green-600 truncate">
                    {totalPaidAmount.toLocaleString("vi-VN")} đ
                  </p>
                </div>
              </div>
            </Card>

            {/* Chuỗi điểm danh */}
            <div className="mt-6">
              <Card
                className="p-5 bg-linear-to-br from-emerald-50 to-green-50 border-emerald-200 border-2 hover:shadow-lg transition-all duration-300"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">🔥</span>
                    <div>
                      <p className="text-sm font-semibold text-gray-700">
                        Chuỗi điểm danh
                      </p>
                      <p className="text-2xl font-bold text-gray-900 mt-0.5">
                        {attendanceStreak.currentStreak} buổi
                      </p>
                    </div>
                  </div>
                  <span className="text-xs px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">
                    🔥 Streak
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-3">
                  Kỷ lục: {attendanceStreak.bestStreak} buổi • Tổng có mặt: {attendanceStreak.totalPresent}/{attendanceStreak.totalSessions} buổi
                </p>
                <div className="mt-3 h-2.5 w-full rounded-full bg-white/80 overflow-hidden shadow-inner">
                  <div
                    className="h-full bg-linear-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-500"
                    style={{
                      width: `${attendanceStreak.bestStreak > 0 ? Math.min((attendanceStreak.currentStreak / attendanceStreak.bestStreak) * 100, 100) : 0}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-gray-600 mt-3 bg-white/60 rounded-lg px-3 py-2">
                  💡 {attendanceStreak.currentStreak >= attendanceStreak.bestStreak && attendanceStreak.currentStreak > 0
                    ? "Tuyệt vời! Bạn đang ở kỷ lục mới!"
                    : attendanceStreak.currentStreak > 0
                      ? `Giữ vững thêm ${attendanceStreak.bestStreak - attendanceStreak.currentStreak} buổi để phá kỷ lục!`
                      : "Hãy đi học đều đặn để xây dựng chuỗi điểm danh!"}
                </p>
              </Card>
            </div>

            {/* Huy hiệu động viên */}
            {(() => {
              const dynamicBadges = [
                {
                  title: "Chăm chỉ",
                  desc: "Điểm danh 5 buổi liên tục",
                  earned: attendanceStreak.bestStreak >= 5,
                  icon: "🏃",
                  howTo: "Đi học liên tục 5 buổi không vắng. Mỗi buổi được giáo viên điểm danh có mặt hoặc đi muộn đều được tính.",
                  progress: `${Math.min(attendanceStreak.bestStreak, 5)}/5 buổi`,
                  progressPercent: Math.min((attendanceStreak.bestStreak / 5) * 100, 100),
                },
                {
                  title: "Kiên trì",
                  desc: "Điểm danh 10 buổi liên tục",
                  earned: attendanceStreak.bestStreak >= 10,
                  icon: "💪",
                  howTo: "Đi học liên tục 10 buổi không vắng. Giữ chuỗi điểm danh bằng cách tham gia đầy đủ các buổi học.",
                  progress: `${Math.min(attendanceStreak.bestStreak, 10)}/10 buổi`,
                  progressPercent: Math.min((attendanceStreak.bestStreak / 10) * 100, 100),
                },
                {
                  title: "Siêu sao",
                  desc: "Điểm danh 20 buổi liên tục",
                  earned: attendanceStreak.bestStreak >= 20,
                  icon: "⭐",
                  howTo: "Đi học liên tục 20 buổi không vắng. Đây là huy hiệu cao nhất về chuỗi điểm danh!",
                  progress: `${Math.min(attendanceStreak.bestStreak, 20)}/20 buổi`,
                  progressPercent: Math.min((attendanceStreak.bestStreak / 20) * 100, 100),
                },
                {
                  title: "Điểm cao",
                  desc: "Điểm TB ≥ 8.0",
                  earned: averageScore >= 8,
                  icon: "🎯",
                  howTo: "Đạt điểm trung bình từ 8.0 trở lên trên tất cả các bài kiểm tra và bài tập được chấm điểm.",
                  progress: `Điểm TB hiện tại: ${averageScore > 0 ? averageScore : "Chưa có"}`,
                  progressPercent: averageScore > 0 ? Math.min((averageScore / 8) * 100, 100) : 0,
                },
                {
                  title: "Chuyên cần",
                  desc: "Tỷ lệ có mặt ≥ 90%",
                  earned: attendanceStreak.totalSessions > 0 && (attendanceStreak.totalPresent / attendanceStreak.totalSessions) * 100 >= 90,
                  icon: "🏆",
                  howTo: "Duy trì tỷ lệ có mặt từ 90% trở lên trong tổng số buổi học. Cố gắng không vắng quá nhiều buổi.",
                  progress: attendanceStreak.totalSessions > 0
                    ? `${Math.round((attendanceStreak.totalPresent / attendanceStreak.totalSessions) * 100)}% (${attendanceStreak.totalPresent}/${attendanceStreak.totalSessions} buổi)`
                    : "Chưa có dữ liệu",
                  progressPercent: attendanceStreak.totalSessions > 0
                    ? Math.min(((attendanceStreak.totalPresent / attendanceStreak.totalSessions) * 100 / 90) * 100, 100)
                    : 0,
                },
                {
                  title: "Hoàn hảo",
                  desc: "100% điểm danh",
                  earned: attendanceStreak.totalSessions > 0 && attendanceStreak.totalPresent === attendanceStreak.totalSessions,
                  icon: "👑",
                  howTo: "Tham gia 100% tất cả các buổi học, không vắng buổi nào. Đây là huy hiệu danh giá nhất!",
                  progress: attendanceStreak.totalSessions > 0
                    ? `${attendanceStreak.totalPresent}/${attendanceStreak.totalSessions} buổi`
                    : "Chưa có dữ liệu",
                  progressPercent: attendanceStreak.totalSessions > 0
                    ? (attendanceStreak.totalPresent / attendanceStreak.totalSessions) * 100
                    : 0,
                },
              ];
              return (
                <Card className="mt-6 p-6 bg-white border-0 shadow-lg">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🎖️</span>
                      <div>
                        <p className="font-bold text-gray-900 text-lg">
                          Huy hiệu động viên
                        </p>
                        <p className="text-xs text-gray-500">
                          Thu thập để giữ động lực học tập
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-blue-600 font-medium bg-blue-50 px-3 py-1.5 rounded-full">
                      {dynamicBadges.filter((b) => b.earned).length}/{dynamicBadges.length} đã đạt
                    </span>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    {dynamicBadges.map((b) => (
                      <div
                        key={b.title}
                        onClick={() => setSelectedBadge(b)}
                        className={`rounded-2xl border-2 px-5 py-4 transition-all duration-300 hover:scale-[1.02] cursor-pointer ${
                          b.earned
                            ? "border-emerald-200 bg-linear-to-br from-emerald-50 to-green-50 shadow-md shadow-emerald-100"
                            : "border-gray-100 bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`text-3xl ${
                              b.earned ? "" : "grayscale opacity-50"
                            }`}
                          >
                            {b.icon}
                          </span>
                          <div>
                            <p
                              className={`font-bold ${
                                b.earned ? "text-emerald-700" : "text-gray-500"
                              }`}
                            >
                              {b.title}
                            </p>
                            <p className="text-xs text-gray-500">{b.desc}</p>
                          </div>
                        </div>
                        {b.earned ? (
                          <span className="inline-flex mt-3 text-xs px-3 py-1.5 rounded-full bg-emerald-600 text-white font-semibold shadow-sm">
                            ✓ Đã đạt
                          </span>
                        ) : (
                          <span className="inline-flex mt-3 text-xs px-3 py-1.5 rounded-full bg-gray-200 text-gray-600 font-medium">
                            Chưa đạt
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Badge Detail Modal */}
                  {selectedBadge && (
                    <div
                      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-3 animate-in fade-in duration-200"
                      onClick={() => setSelectedBadge(null)}
                    >
                      <Card
                        className="w-full max-w-md p-0 overflow-hidden bg-white shadow-2xl rounded-2xl animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Header */}
                        <div className={`p-6 text-center ${selectedBadge.earned ? "bg-linear-to-br from-emerald-500 to-green-600" : "bg-linear-to-br from-gray-400 to-gray-500"}`}>
                          <span className={`text-6xl block mb-3 ${selectedBadge.earned ? "" : "grayscale"}`}>
                            {selectedBadge.icon}
                          </span>
                          <h3 className="text-xl font-bold text-white">
                            {selectedBadge.title}
                          </h3>
                          <p className="text-white/80 text-sm mt-1">
                            {selectedBadge.desc}
                          </p>
                          <span className={`inline-flex mt-3 text-xs px-4 py-1.5 rounded-full font-semibold ${selectedBadge.earned ? "bg-white/20 text-white" : "bg-white/20 text-white"}`}>
                            {selectedBadge.earned ? "✓ Đã đạt được" : "✗ Chưa đạt"}
                          </span>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-4">
                          {/* How to earn */}
                          <div>
                            <p className="text-sm font-semibold text-gray-700 mb-2">
                              📋 Cách đạt huy hiệu
                            </p>
                            <p className="text-sm text-gray-600 bg-blue-50 rounded-xl p-3 border border-blue-100">
                              {selectedBadge.howTo}
                            </p>
                          </div>

                          {/* Progress */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-semibold text-gray-700">
                                📊 Tiến độ
                              </p>
                              <p className="text-xs text-gray-500">
                                {selectedBadge.progress}
                              </p>
                            </div>
                            <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-700 ${selectedBadge.earned ? "bg-linear-to-r from-emerald-400 to-emerald-600" : "bg-linear-to-r from-amber-400 to-orange-500"}`}
                                style={{ width: `${selectedBadge.progressPercent}%` }}
                              />
                            </div>
                          </div>

                          <Button
                            className="w-full bg-gray-800 hover:bg-gray-900 text-white rounded-xl"
                            onClick={() => setSelectedBadge(null)}
                          >
                            Đóng
                          </Button>
                        </div>
                      </Card>
                    </div>
                  )}
                </Card>
              );
            })()}
          </TabsContent>

          <TabsContent value="schedule" className="mt-6">
            <Card className="p-6 space-y-5 bg-white border-0 shadow-lg">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📅</span>
                  <div>
                    <p className="font-bold text-gray-900 text-lg">
                      {isCurrentWeek ? "Lịch học tuần này" : "Lịch học"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {isCurrentWeek
                        ? "Theo dõi các buổi học sắp tới"
                        : `Tuần ${formatWeekRange(selectedWeekStart)}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Year Selector */}
                  <select
                    value={selectedYear}
                    onChange={(e) => handleYearChange(Number(e.target.value))}
                    className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer"
                  >
                    {availableYears.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>

                  {/* Week Selector */}
                  <select
                    value={
                      weeksInSelectedYear.find(
                        (w) =>
                          w.startDate.toDateString() ===
                          selectedWeekStart.toDateString(),
                      )?.value || ""
                    }
                    onChange={(e) => handleWeekChange(e.target.value)}
                    className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer min-w-35"
                  >
                    {weeksInSelectedYear.map((week) => (
                      <option key={week.value} value={week.value}>
                        {week.label}
                      </option>
                    ))}
                  </select>

                  {/* Current Week Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToCurrentWeek}
                    className="text-sm border-gray-200 hover:bg-gray-50"
                  >
                    Tuần hiện tại
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
                {weekSchedule.map((slot) => {
                  const style = statusStyle(slot.status);
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const slotDate = addDays(
                    selectedWeekStart,
                    DAY_NAMES.indexOf(slot.day),
                  );
                  const isToday = slotDate.getTime() === today.getTime();
                  const isPast = slotDate < today;

                  return (
                    <div
                      key={slot.day}
                      className={`rounded-2xl border-2 bg-white shadow-sm overflow-hidden flex flex-col transition-all duration-300 hover:shadow-md ${
                        isToday
                          ? "border-blue-400 ring-2 ring-blue-100"
                          : isPast
                            ? "border-gray-200 opacity-80"
                            : "border-gray-100"
                      }`}
                    >
                      <div
                        className={`px-3 py-3 text-center ${
                          isToday
                            ? "bg-linear-to-r from-blue-600 to-indigo-600 text-white"
                            : isPast
                              ? "bg-linear-to-r from-gray-500 to-gray-600 text-white"
                              : "bg-linear-to-r from-gray-700 to-gray-800 text-white"
                        }`}
                      >
                        <p className="text-xs font-bold leading-tight">
                          {slot.day}
                        </p>
                        <p className="text-lg font-bold leading-tight">
                          {slot.date.split("/")[0]}
                        </p>
                        {isToday && (
                          <p className="text-[10px] mt-0.5 text-blue-200">
                            Hôm nay
                          </p>
                        )}
                        {isPast && !isToday && (
                          <p className="text-[10px] mt-0.5 text-gray-300">
                            Đã qua
                          </p>
                        )}
                      </div>

                      {slot.code ? (
                        <div className="flex-1 p-3 space-y-2 text-center">
                          <div
                            className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${
                              isPast
                                ? "bg-gray-100 text-gray-600"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {slot.subject || slot.code}
                          </div>
                          <div className="text-xs text-gray-500">
                            📍 {slot.room || "123"}
                          </div>
                          <div className="text-sm text-gray-900 font-bold">
                            {slot.time || "N/A"}
                          </div>
                          {slot.teacher && (
                            <div className="text-xs text-gray-600">
                              👨‍🏫 {slot.teacher}
                            </div>
                          )}
                          <div className="space-y-2 pt-2">
                            <Button
                              className="w-full bg-linear-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white text-xs rounded-xl shadow-md"
                              onClick={() => setShowDocumentsModal(true)}
                            >
                              📄 Tài liệu
                            </Button>
                            {/* Attendance Status */}
                            {slot.attendanceStatus ? (
                              <div
                                className={`w-full text-xs rounded-xl py-2 px-3 font-medium ${
                                  slot.attendanceStatus === "present"
                                    ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                                    : slot.attendanceStatus === "absent"
                                      ? "bg-red-100 text-red-700 border border-red-200"
                                      : slot.attendanceStatus === "late"
                                        ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                                        : slot.attendanceStatus === "excused"
                                          ? "bg-blue-100 text-blue-700 border border-blue-200"
                                          : "bg-gray-100 text-gray-600"
                                }`}
                              >
                                {slot.attendanceStatus === "present" &&
                                  "✅ Có mặt"}
                                {slot.attendanceStatus === "absent" &&
                                  "❌ Vắng"}
                                {slot.attendanceStatus === "late" &&
                                  "✅ Có mặt (muộn)"}
                                {slot.attendanceStatus === "excused" &&
                                  "📝 Nghỉ phép"}
                              </div>
                            ) : isPast && slot.code ? (
                              <div className="w-full text-xs rounded-xl py-2 px-3 font-medium bg-red-100 text-red-700 border border-red-200">
                                ❌ Vắng
                              </div>
                            ) : slot.code ? (
                              <div className="w-full text-xs rounded-xl py-2 px-3 font-medium bg-amber-100 text-amber-700 border border-amber-200">
                                ⏳ Chưa xác nhận
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-300 py-8">
                          <span className="text-3xl mb-2">😴</span>
                          <span className="text-xs">Nghỉ</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="progress" className="mt-6">
            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2 p-6 bg-white border-0 shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-2xl">📈</span>
                  <div>
                    <p className="font-bold text-gray-900 text-lg">
                      Tiến độ học tập
                    </p>
                    <p className="text-xs text-gray-500">
                      Điểm số qua các bài kiểm tra
                    </p>
                  </div>
                </div>
                {progressData.length === 0 ? (
                  <div className="h-72 flex items-center justify-center">
                    <div className="text-center text-gray-500">
                      <span className="text-4xl mb-3 block">📊</span>
                      <p className="font-medium">Chưa có dữ liệu điểm</p>
                      <p className="text-sm">
                        Điểm số sẽ hiển thị sau khi giáo viên chấm bài
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={progressData}
                        margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
                      >
                        <defs>
                          <linearGradient
                            id="colorScore"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#3b82f6"
                              stopOpacity={0.3}
                            />
                            <stop
                              offset="95%"
                              stopColor="#3b82f6"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 10, fill: "#4b5563" }}
                          angle={-20}
                          textAnchor="end"
                          height={60}
                        />
                        <YAxis
                          domain={[0, 10]}
                          tick={{ fontSize: 12, fill: "#4b5563" }}
                        />
                        <Tooltip
                          contentStyle={{
                            borderRadius: "12px",
                            border: "none",
                            boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
                          }}
                          formatter={(value: number) => [
                            `${value} điểm`,
                            "Điểm",
                          ]}
                          labelFormatter={(label, payload) => {
                            if (payload && payload[0]) {
                              const data = payload[0].payload;
                              return `${data.fullName || label} (${data.className}) - ${data.date}`;
                            }
                            return label;
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="score"
                          stroke="#3b82f6"
                          strokeWidth={3}
                          fill="url(#colorScore)"
                          dot={{
                            r: 6,
                            fill: "#3b82f6",
                            stroke: "#fff",
                            strokeWidth: 2,
                          }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card>

              <Card className="p-6 bg-white border-0 shadow-lg">
                <p className="font-bold text-gray-900 text-lg mb-4">
                  📊 Thống kê nhanh
                </p>
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-linear-to-r from-blue-50 to-indigo-50 border border-blue-100">
                    <p className="text-xs text-blue-600 font-medium">
                      Điểm trung bình
                    </p>
                    <p className="text-2xl font-bold text-blue-700">
                      {averageScore > 0 ? averageScore : "—"}
                    </p>
                    {averageScore > 0 && lastWeekAverage > 0 && (
                      <p
                        className={`text-xs mt-1 ${averageScore >= lastWeekAverage ? "text-green-600" : "text-red-600"}`}
                      >
                        {averageScore >= lastWeekAverage ? "↑" : "↓"}{" "}
                        {Math.abs(averageScore - lastWeekAverage).toFixed(1)} so
                        với trước
                      </p>
                    )}
                  </div>
                  <div className="p-4 rounded-xl bg-linear-to-r from-emerald-50 to-green-50 border border-emerald-100">
                    <p className="text-xs text-emerald-600 font-medium">
                      Số bài đã chấm
                    </p>
                    <p className="text-2xl font-bold text-emerald-700">
                      {studentGrades.length}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {processedSubjects.length} môn học
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-linear-to-r from-amber-50 to-orange-50 border border-amber-100">
                    <p className="text-xs text-amber-600 font-medium">
                      Xếp hạng trong lớp
                    </p>
                    <p className="text-2xl font-bold text-amber-700">
                      {overallRanking
                        ? `#${overallRanking.bestRank}/${overallRanking.totalStudents}`
                        : "—"}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {overallRanking
                        ? `Dựa trên điểm TB (${overallRanking.classCount} lớp)`
                        : "Chưa có xếp hạng"}
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Chi tiết điểm theo từng môn */}
            {progressBySubject.length > 0 && (
              <Card className="mt-6 p-6 bg-white border-0 shadow-lg">
                <p className="font-bold text-gray-900 text-lg mb-4">
                  📚 Chi tiết điểm theo môn học
                </p>
                <div className="space-y-4">
                  {progressBySubject.map((subject, idx) => (
                    <div
                      key={idx}
                      className="border border-gray-100 rounded-xl p-4"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-semibold text-gray-900">
                            {subject.name}
                          </p>
                          {subject.rank && (
                            <p className="text-xs text-amber-600 font-medium">
                              🏆 Xếp hạng: #{subject.rank}/
                              {subject.totalStudents}
                            </p>
                          )}
                        </div>
                        <span className="text-sm text-gray-500">
                          {subject.data.length} bài kiểm tra
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {subject.data.map((item, i) => (
                          <div
                            key={i}
                            className={`px-3 py-2 rounded-lg text-sm ${
                              item.score >= 8
                                ? "bg-green-100 text-green-700"
                                : item.score >= 6.5
                                  ? "bg-blue-100 text-blue-700"
                                  : item.score >= 5
                                    ? "bg-yellow-100 text-yellow-700"
                                    : "bg-red-100 text-red-700"
                            }`}
                            title={`${item.label} - ${item.date}`}
                          >
                            <span className="font-bold">{item.score}</span>
                            <span className="text-xs ml-1 opacity-75">
                              {item.label.length > 10
                                ? item.label.substring(0, 10) + "..."
                                : item.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="grades" className="mt-6">
            <Card className="p-6 space-y-4 bg-white border-0 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🏆</span>
                  <div>
                    <p className="font-bold text-gray-900 text-lg">
                      Điểm số các môn
                    </p>
                    <p className="text-xs text-gray-500">
                      Theo dõi kết quả học tập của bạn
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Điểm trung bình</p>
                  <p className="text-2xl font-bold text-blue-600">78.3</p>
                </div>
              </div>
              <div className="space-y-3">
                {grades.map((g) => (
                  <div
                    key={g.subject}
                    className="flex items-center gap-4 rounded-2xl border-2 border-gray-100 px-5 py-4 hover:border-blue-200 hover:shadow-md transition-all duration-300 bg-linear-to-r from-white to-gray-50"
                  >
                    <div className="w-12 h-12 rounded-xl bg-linear-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-xl font-bold shadow-md">
                      {g.subject.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-gray-900">{g.subject}</p>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            g.status === "Tốt"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {g.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{g.detail}</p>
                      <div className="mt-2 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            g.score >= 80
                              ? "bg-linear-to-r from-emerald-400 to-green-500"
                              : g.score >= 70
                                ? "bg-linear-to-r from-blue-400 to-blue-500"
                                : "bg-linear-to-r from-amber-400 to-orange-500"
                          }`}
                          style={{ width: `${g.score}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold bg-linear-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                        {g.score}
                      </p>
                      <p className="text-xs text-gray-400">điểm</p>
                    </div>
                    <Button
                      variant="outline"
                      className="border-blue-200 text-blue-600 hover:bg-blue-50 rounded-xl"
                      onClick={() =>
                        setSelectedGrade({ subject: g.subject, score: g.score })
                      }
                    >
                      Chi tiết →
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="leaderboard" className="mt-4">
            <Card className="p-5 space-y-4">
              <div className="space-y-1">
                <p className="text-lg font-bold text-gray-900">Bảng Xếp Hạng</p>
                <p className="text-sm text-gray-600">
                  Vinh danh những nỗ lực xuất sắc
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1">
                {Object.entries(leaderboardOptions).map(([key, opt]) => (
                  <button
                    key={key}
                    onClick={() => setRankingView(key as RankingCategory)}
                    className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                      rankingView === key
                        ? "bg-white text-blue-700 shadow-sm"
                        : "text-gray-700 hover:bg-white"
                    }`}
                  >
                    <span className="text-base leading-none">
                      {tabIcons[key as RankingCategory]}
                    </span>
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>

              {/* Loading State */}
              {leaderboardLoading && (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-gray-500 mt-4">
                    Đang tải bảng xếp hạng...
                  </p>
                </div>
              )}

              {/* Leaderboard List */}
              {!leaderboardLoading && (
                <div className="space-y-3">
                  {rankingView === "score" &&
                    leaderboard?.score?.map((row) => (
                      <div
                        key={`score-${row.rank}-${row.studentId}`}
                        className={`flex items-center justify-between rounded-xl border px-4 py-3 shadow-sm ${
                          row.studentId === (authUser?._id || user.id)
                            ? "border-blue-300 bg-blue-50"
                            : "border-gray-200 bg-white"
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-full bg-gray-50 flex items-center justify-center text-lg">
                            {row.rank === 1 && (
                              <span className="text-amber-500">🏆</span>
                            )}
                            {row.rank === 2 && (
                              <span className="text-gray-400">🥈</span>
                            )}
                            {row.rank === 3 && (
                              <span className="text-orange-400">🥉</span>
                            )}
                            {row.rank > 3 && (
                              <span className="text-sm font-semibold text-gray-700">
                                {row.rank}
                              </span>
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 leading-tight">
                              {row.studentName}
                              {row.studentId === (authUser?._id || user.id) && (
                                <span className="ml-2 text-xs text-blue-600">
                                  (Bạn)
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-gray-500 leading-tight">
                              {row.className ||
                                `${row.totalGrades} bài kiểm tra`}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-blue-700">
                            {row.averageScore.toFixed(1)}
                          </p>
                          <p className="text-xs text-gray-500">Điểm TB</p>
                        </div>
                      </div>
                    ))}

                  {rankingView === "attendance" &&
                    leaderboard?.attendance?.map((row) => (
                      <div
                        key={`attendance-${row.rank}-${row.studentId}`}
                        className={`flex items-center justify-between rounded-xl border px-4 py-3 shadow-sm ${
                          row.studentId === (authUser?._id || user.id)
                            ? "border-emerald-300 bg-emerald-50"
                            : "border-gray-200 bg-white"
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-full bg-gray-50 flex items-center justify-center text-lg">
                            {row.rank === 1 && (
                              <span className="text-amber-500">🏆</span>
                            )}
                            {row.rank === 2 && (
                              <span className="text-gray-400">🥈</span>
                            )}
                            {row.rank === 3 && (
                              <span className="text-orange-400">🥉</span>
                            )}
                            {row.rank > 3 && (
                              <span className="text-sm font-semibold text-gray-700">
                                {row.rank}
                              </span>
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 leading-tight">
                              {row.studentName}
                              {row.studentId === (authUser?._id || user.id) && (
                                <span className="ml-2 text-xs text-emerald-600">
                                  (Bạn)
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-gray-500 leading-tight">
                              Đã theo học {row.daysEnrolled} ngày
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-emerald-700">
                            {row.attendanceRate}%
                          </p>
                          <p className="text-xs text-gray-500">
                            {row.presentCount}/{row.totalSessions} buổi
                          </p>
                        </div>
                      </div>
                    ))}

                  {/* Empty State */}
                  {!leaderboardLoading &&
                    ((rankingView === "score" &&
                      (!leaderboard?.score ||
                        leaderboard.score.length === 0)) ||
                      (rankingView === "attendance" &&
                        (!leaderboard?.attendance ||
                          leaderboard.attendance.length === 0))) && (
                      <div className="text-center py-8 text-gray-500">
                        <p className="text-4xl mb-2">📊</p>
                        <p>Chưa có dữ liệu xếp hạng</p>
                      </div>
                    )}
                </div>
              )}

              {/* My Rank */}
              <div className="rounded-xl bg-blue-50 text-blue-700 text-sm text-center px-4 py-3">
                Vị trí hiện tại của bạn:{" "}
                <span className="font-semibold">
                  {rankingView === "score"
                    ? myRank?.scoreRank
                      ? `Hạng ${myRank.scoreRank}`
                      : "Chưa có xếp hạng"
                    : myRank?.attendanceRank
                      ? `Hạng ${myRank.attendanceRank}`
                      : "Chưa có xếp hạng"}
                </span>{" "}
                trong {leaderboardOptions[rankingView].label}
                {myRank?.totalStudents && (
                  <span className="text-gray-500 ml-1">
                    ({myRank.totalStudents} học sinh)
                  </span>
                )}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="contact" className="mt-6">
            <Card className="p-6 space-y-4 bg-white border-0 shadow-lg">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">💬</span>
                <div>
                  <p className="font-bold text-gray-900 text-lg">
                    Liên hệ với giáo viên
                  </p>
                  <p className="text-xs text-gray-500">
                    Nhắn tin trực tiếp với giáo viên của bạn
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                {contacts.map((c) => (
                  <div
                    key={c.name}
                    className="flex items-center justify-between rounded-2xl border-2 border-gray-100 px-5 py-4 hover:border-blue-200 hover:shadow-md transition-all duration-300 bg-linear-to-r from-white to-gray-50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="w-14 h-14 rounded-full bg-linear-to-br from-blue-100 to-indigo-100 flex items-center justify-center text-3xl">
                          {c.avatar}
                        </div>
                        <span
                          className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white ${
                            c.status === "online"
                              ? "bg-emerald-500"
                              : "bg-gray-300"
                          }`}
                        />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{c.name}</p>
                        <p className="text-sm text-gray-500">{c.subject}</p>
                        <p
                          className={`text-xs mt-0.5 ${
                            c.status === "online"
                              ? "text-emerald-600"
                              : "text-gray-400"
                          }`}
                        >
                          {c.status === "online"
                            ? "● Đang hoạt động"
                            : "○ Không hoạt động"}
                        </p>
                      </div>
                    </div>
                    <Button
                      className="bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl px-6 shadow-md shadow-blue-200"
                      onClick={() =>
                        setChatWith({ name: c.name, role: "teacher" })
                      }
                    >
                      💬 Chat
                    </Button>
                  </div>
                ))}
              </div>

              {/* Quick Actions */}
              <div className="mt-6 pt-6 border-t border-gray-100">
                <p className="text-sm font-semibold text-gray-700 mb-3">
                  Hỗ trợ nhanh
                </p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <button className="p-4 rounded-xl bg-blue-50 hover:bg-blue-100 transition-colors text-center">
                    <span className="text-2xl">📞</span>
                    <p className="text-xs text-gray-700 mt-1 font-medium">
                      Gọi hotline
                    </p>
                  </button>
                  <button className="p-4 rounded-xl bg-emerald-50 hover:bg-emerald-100 transition-colors text-center">
                    <span className="text-2xl">📧</span>
                    <p className="text-xs text-gray-700 mt-1 font-medium">
                      Gửi email
                    </p>
                  </button>
                  <button className="p-4 rounded-xl bg-amber-50 hover:bg-amber-100 transition-colors text-center">
                    <span className="text-2xl">❓</span>
                    <p className="text-xs text-gray-700 mt-1 font-medium">
                      Câu hỏi thường gặp
                    </p>
                  </button>
                  <button className="p-4 rounded-xl bg-purple-50 hover:bg-purple-100 transition-colors text-center">
                    <span className="text-2xl">📋</span>
                    <p className="text-xs text-gray-700 mt-1 font-medium">
                      Góp ý
                    </p>
                  </button>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="payment" className="mt-6">
            <Card className="p-6 border-0 shadow-lg rounded-2xl">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-linear-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white text-2xl shadow-lg shadow-green-200">
                    💳
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      Thanh toán học phí
                    </h2>
                    <p className="text-sm text-gray-500">
                      Quản lý các yêu cầu đóng tiền của bạn
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => (window.location.href = "/payment")}
                  className="bg-linear-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
                >
                  Xem tất cả →
                </Button>
              </div>

              {/* Quick Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="p-4 bg-linear-to-br from-yellow-500 to-orange-500 rounded-xl text-white">
                  <p className="text-sm opacity-90">Chờ thanh toán</p>
                  <p className="text-2xl font-bold">
                    {totalPendingAmount.toLocaleString("vi-VN")} đ
                  </p>
                </div>
                <div className="p-4 bg-linear-to-br from-green-500 to-emerald-600 rounded-xl text-white">
                  <p className="text-sm opacity-90">Đã thanh toán</p>
                  <p className="text-2xl font-bold">
                    {totalPaidAmount.toLocaleString("vi-VN")} đ
                  </p>
                </div>
                <div className="p-4 bg-linear-to-br from-blue-500 to-indigo-600 rounded-xl text-white">
                  <p className="text-sm opacity-90">Học bổng</p>
                  <p className="text-2xl font-bold">
                    {(authUser as any)?.scholarshipPercent || 0}%
                  </p>
                </div>
              </div>

              {/* CTA */}
              <div className="text-center py-8 bg-gray-50 rounded-xl">
                <div className="text-5xl mb-4">💰</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Quản lý thanh toán học phí
                </h3>
                <p className="text-gray-500 mb-4">
                  Xem và thanh toán các yêu cầu đóng tiền từ trung tâm
                </p>
                <Button
                  onClick={() => (window.location.href = "/payment")}
                  className="bg-linear-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
                  size="lg"
                >
                  Vào trang thanh toán
                </Button>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="documents" className="mt-6">
            <Card className="p-6 border-0 shadow-lg rounded-2xl">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-2xl shadow-lg shadow-blue-200">
                    📚
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      Tài liệu học tập
                    </h2>
                    <p className="text-sm text-gray-500">
                      Tài liệu từ giáo viên của bạn
                    </p>
                  </div>
                </div>
              </div>

              {/* Filter buttons */}
              <div className="flex gap-2 mb-6 flex-wrap">
                <button className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white">
                  Tất cả ({studentDocuments.length})
                </button>
                <button className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200">
                  🔒 Lớp học (
                  {
                    studentDocuments.filter((d) => d.visibility === "class")
                      .length
                  }
                  )
                </button>
                <button className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200">
                  🌐 Cộng đồng (
                  {
                    studentDocuments.filter((d) => d.visibility === "community")
                      .length
                  }
                  )
                </button>
              </div>

              {/* Documents list */}
              {documentsLoading ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-gray-500">Đang tải tài liệu...</p>
                </div>
              ) : studentDocuments.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <span className="text-6xl mb-4 block">📭</span>
                  <p className="text-lg font-medium">Chưa có tài liệu nào</p>
                  <p className="text-sm">
                    Giáo viên của bạn chưa chia sẻ tài liệu
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {studentDocuments.map((doc) => {
                    const fileName =
                      doc.originalFileName ||
                      doc.fileUrl.split("/").pop() ||
                      "";
                    const ext = fileName.split(".").pop()?.toLowerCase() || "";
                    const getIcon = () => {
                      switch (ext) {
                        case "pdf":
                          return {
                            icon: "📕",
                            bg: "bg-red-100",
                            color: "text-red-600",
                          };
                        case "doc":
                        case "docx":
                          return {
                            icon: "📘",
                            bg: "bg-blue-100",
                            color: "text-blue-600",
                          };
                        case "ppt":
                        case "pptx":
                          return {
                            icon: "📙",
                            bg: "bg-orange-100",
                            color: "text-orange-600",
                          };
                        case "xls":
                        case "xlsx":
                          return {
                            icon: "📗",
                            bg: "bg-green-100",
                            color: "text-green-600",
                          };
                        case "jpg":
                        case "jpeg":
                        case "png":
                        case "gif":
                        case "webp":
                          return {
                            icon: "🖼️",
                            bg: "bg-purple-100",
                            color: "text-purple-600",
                          };
                        case "mp4":
                        case "webm":
                        case "avi":
                          return {
                            icon: "🎬",
                            bg: "bg-pink-100",
                            color: "text-pink-600",
                          };
                        case "mp3":
                        case "wav":
                          return {
                            icon: "🎵",
                            bg: "bg-yellow-100",
                            color: "text-yellow-600",
                          };
                        case "zip":
                        case "rar":
                          return {
                            icon: "📦",
                            bg: "bg-gray-200",
                            color: "text-gray-600",
                          };
                        default:
                          return {
                            icon: "📄",
                            bg: "bg-gray-100",
                            color: "text-gray-600",
                          };
                      }
                    };
                    const { icon, bg, color } = getIcon();
                    return (
                      <div
                        key={doc._id}
                        className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 hover:shadow-md hover:border-blue-200 transition-all"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`h-12 w-12 rounded-xl flex items-center justify-center ${bg}`}
                          >
                            <span className="text-2xl">{icon}</span>
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">
                              {doc.title}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mt-1">
                              {ext && (
                                <span
                                  className={`px-2 py-0.5 ${bg} ${color} rounded uppercase font-medium`}
                                >
                                  {ext}
                                </span>
                              )}
                              <span>•</span>
                              <span>
                                👨‍🏫 {doc.ownerTeacherId?.name || "Giáo viên"}
                              </span>
                              <span>•</span>
                              <span>
                                {new Date(doc.createdAt).toLocaleDateString(
                                  "vi-VN",
                                )}
                              </span>
                              <span>•</span>
                              <span>⬇️ {doc.downloadCount} lượt tải</span>
                              {doc.visibility === "community" && (
                                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded">
                                  🌐 Cộng đồng
                                </span>
                              )}
                            </div>
                            {doc.description && (
                              <p className="text-xs text-gray-500 mt-1">
                                {doc.description}
                              </p>
                            )}
                            {doc.classIds && doc.classIds.length > 0 && (
                              <p className="text-xs text-blue-600 mt-1">
                                📚 {doc.classIds.map((c) => c.name).join(", ")}
                              </p>
                            )}
                          </div>
                        </div>
                        <a
                          href={`${API_BASE_URL}/documents/${doc._id}/file?token=${accessToken}`}
                          target="_self"
                          rel="noopener noreferrer"
                          className="shrink-0"
                          onClick={() => incrementDownload(doc._id)}
                        >
                          <Button
                            size="sm"
                            className="bg-linear-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-md"
                          >
                            ⬇️ Tải xuống
                          </Button>
                        </a>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="incidents" className="mt-6">
            <IncidentReportModal
              isOpen={true}
              onClose={() => {}}
              userName={user.name}
              userEmail={user.email}
              userRole={user.role}
              isEmbedded={true}
            />
          </TabsContent>

          <TabsContent value="evaluation" className="mt-6">
            <StudentEvaluationTab userId={user.id} />
          </TabsContent>
        </Tabs>
      </main>

      {chatWith && (
        <ChatWindow
          recipientName={chatWith.name}
          recipientRole={chatWith.role}
          currentUserName={user.name}
          onClose={() => setChatWith(null)}
        />
      )}

      {showClassDetail && (
        <ClassDetailModal onClose={() => setShowClassDetail(false)} />
      )}
      {selectedGrade && (
        <GradeDetailModal
          subject={selectedGrade.subject}
          grades={studentGrades.filter(
            (g) => (g.classId?.name || "Lớp học") === selectedGrade.subject,
          )}
          onClose={() => setSelectedGrade(null)}
        />
      )}
      {showSettings && (
        <SettingsModal
          user={fullUserDetails || user}
          onClose={() => setShowSettings(false)}
        />
      )}
      {showDocumentsModal && (
        <StudentDocumentsModal
          documents={studentDocuments}
          isLoading={documentsLoading}
          onClose={() => setShowDocumentsModal(false)}
          onDownload={incrementDownload}
        />
      )}
    </div>
  );
}

// Modal xem tài liệu cho học sinh
function StudentDocumentsModal({
  documents,
  isLoading,
  onClose,
  onDownload,
}: {
  documents: Document[];
  isLoading: boolean;
  onClose: () => void;
  onDownload: (id: string) => void;
}) {
  const [filter, setFilter] = useState<"all" | "class" | "community">("all");
  const { accessToken } = useAuthStore();

  const filteredDocs = documents.filter((doc) => {
    if (filter === "all") return true;
    return doc.visibility === filter;
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-3">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 bg-white">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              📚 Tài liệu học tập
            </h2>
            <p className="text-sm text-gray-500">
              Tài liệu từ giáo viên của bạn
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setFilter("all")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === "all"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Tất cả ({documents.length})
          </button>
          <button
            onClick={() => setFilter("class")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === "class"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            🔒 Lớp học (
            {documents.filter((d) => d.visibility === "class").length})
          </button>
          <button
            onClick={() => setFilter("community")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === "community"
                ? "bg-purple-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            🌐 Cộng đồng (
            {documents.filter((d) => d.visibility === "community").length})
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-gray-500">
            Đang tải tài liệu...
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <span className="text-4xl mb-3 block">📭</span>
            Chưa có tài liệu nào
          </div>
        ) : (
          <div className="space-y-3">
            {filteredDocs.map((doc) => {
              const fileName =
                doc.originalFileName || doc.fileUrl.split("/").pop() || "";
              const ext = fileName.split(".").pop()?.toLowerCase() || "";
              const getIcon = () => {
                switch (ext) {
                  case "pdf":
                    return { icon: "📕", bg: "bg-red-100" };
                  case "doc":
                  case "docx":
                    return { icon: "📘", bg: "bg-blue-100" };
                  case "ppt":
                  case "pptx":
                    return { icon: "📙", bg: "bg-orange-100" };
                  case "xls":
                  case "xlsx":
                    return { icon: "📗", bg: "bg-green-100" };
                  case "jpg":
                  case "jpeg":
                  case "png":
                  case "gif":
                  case "webp":
                    return { icon: "🖼️", bg: "bg-purple-100" };
                  case "mp4":
                  case "webm":
                  case "avi":
                    return { icon: "🎬", bg: "bg-pink-100" };
                  case "mp3":
                  case "wav":
                    return { icon: "🎵", bg: "bg-yellow-100" };
                  case "zip":
                  case "rar":
                    return { icon: "📦", bg: "bg-gray-200" };
                  default:
                    return { icon: "📄", bg: "bg-gray-100" };
                }
              };
              const { icon, bg } = getIcon();
              return (
                <div
                  key={doc._id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-10 w-10 rounded-lg flex items-center justify-center ${bg}`}
                    >
                      <span className="text-lg">{icon}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{doc.title}</p>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                        {ext && (
                          <span className="px-2 py-0.5 bg-gray-100 rounded uppercase">
                            {ext}
                          </span>
                        )}
                        <span>•</span>
                        <span>
                          👨‍🏫 {doc.ownerTeacherId?.name || "Giáo viên"}
                        </span>
                        <span>•</span>
                        <span>
                          {new Date(doc.createdAt).toLocaleDateString("vi-VN")}
                        </span>
                        {doc.visibility === "community" && (
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded">
                            🌐 Cộng đồng
                          </span>
                        )}
                      </div>
                      {doc.description && (
                        <p className="text-xs text-gray-500 mt-1">
                          {doc.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <a
                    href={`${API_BASE_URL}/documents/${doc._id}/file?token=${accessToken}`}
                    target="_self"
                    rel="noopener noreferrer"
                    className="shrink-0"
                    onClick={() => onDownload(doc._id)}
                  >
                    <Button
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      ⬇️ Tải xuống
                    </Button>
                  </a>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
