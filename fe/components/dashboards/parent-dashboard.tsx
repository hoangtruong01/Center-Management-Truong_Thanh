"use client";
import { useMemo, useState, useEffect, useRef } from "react";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ChatWindow from "@/components/chat-window";
import NotificationCenter from "@/components/notification-center";
import IncidentReportModal from "@/components/pages/incident-report-modal";
import {
  useParentDashboardStore,
  type ChildInfo,
} from "@/lib/stores/parent-dashboard-store";
import { usePaymentRequestsStore } from "@/lib/stores/payment-requests-store";
import { AlertTriangle, ChevronRight, ChevronDown, Camera } from "lucide-react";
import { useAuthStore } from "@/lib/stores/auth-store";
import api from "@/lib/api";
import { uploadToCloudinary } from "@/lib/cloudinary";
import {
  studentGradingService,
  StudentGradeRecord,
  StudentRankInfo,
} from "@/lib/services/student-grading.service";
import { Bounce, ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Day names for schedule
const dayNames = [
  "CHỦ NHẬT",
  "THỨ HAI",
  "THỨ BA",
  "THỨ TƯ",
  "THỨ NĂM",
  "THỨ SÁU",
  "THỨ BẢY",
];

const DAY_NAMES = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const DAY_NAMES_VN = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

// Helper functions for week navigation
const getStartOfWeek = (date: Date): Date => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
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

const getWeeksInYear = (
  year: number,
  accountCreatedAt: Date,
  currentDate: Date,
): { value: string; label: string; startDate: Date }[] => {
  const weeks: { value: string; label: string; startDate: Date }[] = [];
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
    if (
      weekStart.getTime() >= accountStart.getTime() &&
      weekStart.getTime() <= currentWeekStart.getTime()
    ) {
      const startStr = `${weekStart.getDate().toString().padStart(2, "0")}/${(weekStart.getMonth() + 1).toString().padStart(2, "0")}`;
      const endStr = `${weekEnd.getDate().toString().padStart(2, "0")}/${(weekEnd.getMonth() + 1).toString().padStart(2, "0")}`;
      weeks.push({
        value: weekStart.toISOString(),
        label: `${startStr} To ${endStr}`,
        startDate: weekStart,
      });
    }
    date = addDays(date, 7);
    if (weekStart.getTime() > currentWeekStart.getTime()) break;
  }
  return weeks;
};

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

type ParentDaySchedule = {
  day: string;
  date: string;
  items: Array<{
    classId: string;
    className: string;
    classCode: string;
    teacherName: string;
    startTime: string;
    endTime: string;
    room?: string;
    attendanceStatus: "present" | "absent" | "late" | "excused" | null;
    sessionStatus: "past" | "in-progress" | "upcoming";
  }>;
};

interface ParentDashboardProps {
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

const overviewStats = [
  {
    label: "Khóa học",
    value: 3,
    note: "Đang theo học",
    icon: "📚",
    color: "from-blue-500 to-blue-600",
  },
  {
    label: "Điểm TB",
    value: 8.2,
    note: "Kết quả tốt",
    icon: "⭐",
    color: "from-emerald-500 to-emerald-600",
  },
  {
    label: "Buổi học",
    value: 28,
    note: "Tổng buổi",
    icon: "📅",
    color: "from-amber-500 to-orange-500",
  },
  {
    label: "Xếp loại",
    value: "Tốt",
    note: "Đánh giá chung",
    icon: "🏆",
    color: "from-purple-500 to-purple-600",
  },
];

const child = {
  name: "Nguyễn Thị C",
  grade: "Lớp 10",
  classCount: 3,
  avgScore: 8.2,
  rating: "Tốt",
  tuition: 2_500_000,
  paid: true,
};

const courses = [
  {
    subject: "Toán",
    total: 12,
    attended: 11,
    score: 8.5,
    teacher: "Cô Trần Thị B",
  },
  {
    subject: "Anh văn",
    total: 10,
    attended: 9,
    score: 7.8,
    teacher: "Thầy Lê Văn E",
  },
  {
    subject: "Văn",
    total: 8,
    attended: 8,
    score: 8.2,
    teacher: "Cô Trần Thị B",
  },
];

// progressData sẽ được tính từ childGrades thật

const weeklySchedule = [
  {
    day: "MON",
    date: "06/01",
    code: "MATH101",
    time: "17:00-18:30",
    room: "Phòng 604",
    teacher: "Cô Trần Thị B",
    status: "confirmed",
    attendanceStatus: "present" as const,
  },
  {
    day: "TUE",
    date: "07/01",
    code: "ENG102",
    time: "18:00-19:30",
    room: "Phòng 417",
    teacher: "Thầy Lê Văn E",
    status: "confirmed",
    attendanceStatus: "present" as const,
  },
  {
    day: "WED",
    date: "08/01",
    code: "-",
    time: "-",
    room: "",
    teacher: "",
    status: "empty",
    attendanceStatus: null,
  },
  {
    day: "THU",
    date: "09/01",
    code: "PHY103",
    time: "17:00-18:30",
    room: "Phòng 506",
    teacher: "Thầy Nguyễn Văn F",
    status: "pending",
    attendanceStatus: "absent" as const,
  },
  {
    day: "FRI",
    date: "10/01",
    code: "MATH101",
    time: "17:00-18:30",
    room: "Phòng 604",
    teacher: "Cô Trần Thị B",
    status: "confirmed",
    attendanceStatus: null, // Chưa diễn ra
  },
  {
    day: "SAT",
    date: "11/01",
    code: "-",
    time: "-",
    room: "",
    teacher: "",
    status: "empty",
    attendanceStatus: null,
  },
  {
    day: "SUN",
    date: "12/01",
    code: "-",
    time: "-",
    room: "",
    teacher: "",
    status: "empty",
    attendanceStatus: null,
  },
];

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const teacherNotes = [
  {
    teacher: "Cô Trần Thị B",
    subject: "Toán",
    note: "Em học rất chăm chỉ, có tiến bộ rõ rệt. Kiến thức nền tảng tốt, cần luyện tập thêm các bài toán khó.",
    date: "15/1/2024",
  },
  {
    teacher: "Thầy Lê Văn E",
    subject: "Anh văn",
    note: "Em phát âm tốt, tuy nhiên cần cải thiện kỹ năng viết. Gợi ý luyện tập thêm writing skill.",
    date: "14/1/2024",
  },
];

const contacts = [
  { name: "Cô Trần Thị B", subject: "Dạy môn Toán" },
  { name: "Thầy Lê Văn E", subject: "Dạy môn Anh văn" },
];

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
    parentCode?: string;
    childEmail?: string;
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
        avatarURL: avatarUrl,
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
                /* eslint-disable-next-line @next/next/no-img-element */
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-gray-700 font-medium">Họ và tên</label>
              <input
                className={`w-full rounded-lg border px-3 py-2.5 transition-all ${isEditing
                    ? "border-blue-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    : "border-gray-300"
                  }`}
                value={isEditing ? formData.name : user.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                readOnly={!isEditing}
              />
            </div>
            <div className="space-y-2">
              <label className="text-gray-700 font-medium">Số điện thoại</label>
              <input
                className={`w-full rounded-lg border px-3 py-2.5 transition-all ${isEditing
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
            <label className="text-gray-700 font-medium">Email</label>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2.5"
              defaultValue={user.email}
              readOnly
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-gray-700 font-medium">Mã phụ huynh</label>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5"
                defaultValue={user.parentCode || "Chưa có"}
                readOnly
              />
            </div>
            <div className="space-y-2">
              <label className="text-gray-700 font-medium">Email con</label>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5"
                defaultValue={user.childEmail || "Chưa có"}
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

function DetailModal({
  onClose,
  childInfo,
  grades,
}: {
  onClose: () => void;
  childInfo: ChildInfo & Record<string, unknown>;
  grades: StudentGradeRecord[];
}) {
  // Process grades into courses
  const courses = useMemo(() => {
    const groups: Record<string, StudentGradeRecord[]> = {};
    grades.forEach((g) => {
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

      return {
        subject,
        score: avg.toFixed(1),
        total: list.length, // total assignments
        attended: list.length, // Assume attended if graded
        teacher: list[0]?.gradedBy?.name || "Giáo viên",
      };
    });
  }, [grades]);

  // Extract recent feedback
  const feedbackList = useMemo(() => {
    return grades
      .filter((g) => g.feedback)
      .sort(
        (a, b) =>
          new Date(b.gradedAt).getTime() - new Date(a.gradedAt).getTime(),
      )
      .slice(0, 5)
      .map((g) => ({
        teacher: g.gradedBy?.name || "Giáo viên",
        subject: g.classId?.name || "Môn học",
        note: g.feedback,
        date: new Date(g.gradedAt).toLocaleDateString(),
      }));
  }, [grades]);

  // Chart data
  const chartData = useMemo(() => {
    return grades
      .sort(
        (a, b) =>
          new Date(a.gradedAt).getTime() - new Date(b.gradedAt).getTime(),
      )
      .map((g) => ({
        week: new Date(g.gradedAt).toLocaleDateString("vi-VN"),
        score: (g.score / g.maxScore) * 10,
      }));
  }, [grades]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-3">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
        <div className="bg-linear-to-r from-blue-500 to-purple-500 text-white px-6 py-5 flex items-start justify-between">
          <div>
            <p className="text-xl font-bold">{childInfo.name}</p>
            <p className="text-sm opacity-90">
              {childInfo.studentCode || "Học viên"}
            </p>
          </div>
          <button onClick={onClose} className="text-lg font-semibold">
            ×
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-3 bg-blue-50 border-blue-100">
              <p className="text-xs text-gray-600">Điểm TB (Hệ 10)</p>
              <p className="text-xl font-bold text-blue-700">
                {courses.length > 0
                  ? (
                    courses.reduce((acc, c) => acc + parseFloat(c.score), 0) /
                    courses.length
                  ).toFixed(1)
                  : "N/A"}
              </p>
            </Card>
            <Card className="p-3 bg-green-50 border-green-100">
              <p className="text-xs text-gray-600">Khóa học</p>
              <p className="text-xl font-bold text-green-700">
                {courses.length}
              </p>
            </Card>
            <Card className="p-3 bg-purple-50 border-purple-100">
              <p className="text-xs text-gray-600">Bài kiểm tra</p>
              <p className="text-xl font-bold text-purple-700">
                {grades.length}
              </p>
            </Card>
            <Card className="p-3 bg-amber-50 border-amber-100">
              <p className="text-xs text-gray-600">Xếp loại</p>
              <p className="text-xl font-bold text-amber-600">--</p>
            </Card>
          </div>

          <Card className="p-4">
            <p className="font-semibold text-gray-900 mb-3">Tiến độ điểm số</p>
            <div className="h-64">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="week"
                      tick={{ fontSize: 12, fill: "#4b5563" }}
                    />
                    <YAxis
                      domain={[0, 10]}
                      tick={{ fontSize: 12, fill: "#4b5563" }}
                    />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#2563eb"
                      strokeWidth={3}
                      dot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-gray-500">
                  Chưa có dữ liệu biểu đồ
                </p>
              )}
            </div>
          </Card>

          <Card className="p-4 space-y-3">
            <p className="font-semibold text-gray-900">Các khóa học</p>
            {courses.length > 0 ? (
              courses.map((course) => (
                <div
                  key={course.subject}
                  className="rounded-lg border border-gray-200 p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-gray-900">
                      {course.subject}
                    </p>
                    <p className="text-blue-700 text-sm font-semibold">
                      {course.score}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                    <p>Bài kiểm tra: {course.total}</p>
                    <p>Giáo viên: {course.teacher}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500">Chưa có dữ liệu khóa học</p>
            )}
          </Card>

          <Card className="p-4 space-y-3">
            <p className="font-semibold text-gray-900">
              Nhận xét từ giáo viên (Mới nhất)
            </p>
            {feedbackList.length > 0 ? (
              feedbackList.map((note, idx) => (
                <Card key={idx} className="p-3 bg-blue-50 border-blue-100">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-gray-900">
                      {note.teacher}
                    </p>
                    <p className="text-xs text-gray-600">{note.subject}</p>
                  </div>
                  <p className="text-sm text-gray-800 mt-2 leading-relaxed">
                    {note.note}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{note.date}</p>
                </Card>
              ))
            ) : (
              <p className="text-gray-500">Chưa có nhận xét nào.</p>
            )}
          </Card>

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

export default function ParentDashboard({
  user,
  onLogout,
}: ParentDashboardProps) {
  const [chatWith, setChatWith] = useState<{
    name: string;
    role: string;
  } | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Week navigation state
  const [selectedYear, setSelectedYear] = useState<number>(() =>
    new Date().getFullYear(),
  );
  const [selectedWeekStart, setSelectedWeekStart] = useState<Date>(() =>
    getStartOfWeek(new Date()),
  );
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Fetch real data from API
  const {
    data: dashboardData,
    isLoading: dashboardLoading,
    fetchDashboardData,
  } = useParentDashboardStore();
  const { childrenRequests, fetchChildrenRequests } = usePaymentRequestsStore();

  useEffect(() => {
    fetchChildrenRequests();
  }, [fetchChildrenRequests]);

  // fetch child grades
  const [childGrades, setChildGrades] = useState<StudentGradeRecord[]>([]);

  // State cho xếp hạng theo từng lớp
  const [classRankings, setClassRankings] = useState<
    Record<string, StudentRankInfo>
  >({});

  useEffect(() => {
    const fetchGradesAndRankings = async () => {
      if (dashboardData?.child?._id) {
        try {
          const grades = await studentGradingService.getMyGrades(
            dashboardData.child._id,
          );
          setChildGrades(grades);

          // Lấy xếp hạng cho từng lớp
          const classIds = [
            ...new Set(grades.map((g) => g.classId?._id).filter(Boolean)),
          ];
          const rankings: Record<string, StudentRankInfo> = {};

          for (const classId of classIds) {
            try {
              const rankInfo =
                await studentGradingService.getStudentRankInClass(
                  dashboardData.child._id,
                  classId as string,
                );
              rankings[classId as string] = rankInfo;
            } catch (err) {
              console.error(`Failed to fetch rank for class ${classId}`, err);
            }
          }
          setClassRankings(rankings);
        } catch (err) {
          console.error("Failed to fetch child grades", err);
        }
      }
    };
    fetchGradesAndRankings();
  }, [dashboardData?.child?._id]);

  // Tính progressData từ childGrades - biểu đồ điểm theo các bài kiểm tra
  const progressData = useMemo(() => {
    if (!childGrades.length) return [];

    // Sắp xếp theo ngày chấm điểm
    const sortedGrades = [...childGrades].sort(
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
  }, [childGrades]);

  // Tính điểm trung bình hiện tại
  const averageScore = useMemo(() => {
    if (!childGrades.length) return 0;

    let totalScore = 0;
    let totalMax = 0;
    childGrades.forEach((g) => {
      totalScore += g.score;
      totalMax += g.maxScore;
    });

    if (totalMax === 0) return 0;
    return parseFloat(((totalScore / totalMax) * 10).toFixed(1));
  }, [childGrades]);

  // Tính điểm tuần trước để so sánh
  const lastWeekAverage = useMemo(() => {
    if (!childGrades.length) return 0;

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const lastWeekGrades = childGrades.filter(
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
  }, [childGrades]);

  // Tạo data theo từng môn
  const progressBySubject = useMemo(() => {
    if (!childGrades.length) return [];

    // Nhóm theo classId (môn học)
    const groups: Record<
      string,
      { name: string; classId: string; grades: typeof childGrades }
    > = {};

    childGrades.forEach((g) => {
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
  }, [childGrades, classRankings]);

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

  const allRequests = childrenRequests.flatMap((c) => c.requests);
  const pendingPayments = allRequests.filter(
    (r) => r.status === "pending" || r.status === "overdue",
  );
  const paidPayments = allRequests.filter((r) => r.status === "paid");

  const totalPendingAmount = pendingPayments.reduce(
    (sum, r) => sum + r.finalAmount,
    0,
  );
  const totalPaidAmount = paidPayments.reduce(
    (sum, r) => sum + r.finalAmount,
    0,
  );
  const { user: authUser } = useAuthStore();

  // State to hold full user details including sensitive/personal info not in initial props
  const [fullUserDetails, setFullUserDetails] = useState<Record<
    string,
    unknown
  > | null>(null);

  // Fetch data on mount
  useEffect(() => {
    const parentId = authUser?._id || user.id;
    const childEmail = (authUser as unknown as Record<string, unknown>)
      ?.childEmail as string | undefined;
    if (parentId) {
      fetchDashboardData(parentId, childEmail).catch(console.error);

      // Fetch full user details for profile
      api
        .get(`/users/${parentId}`)
        .then((res: { data: Record<string, unknown> }) =>
          setFullUserDetails(res.data),
        )
        .catch((err: unknown) =>
          console.error("Failed to fetch full user details:", err),
        );
    }
  }, [authUser, user.id, fetchDashboardData]);

  const avatarPreview = useMemo(() => {
    if (fullUserDetails?.avatarURL) return fullUserDetails.avatarURL as string;
    if (fullUserDetails?.avatarUrl) return fullUserDetails.avatarUrl as string;
    if (user.avatarUrl) return user.avatarUrl;
    return null;
  }, [user.avatarUrl, fullUserDetails]);

  // Debug: log attendance records for parent
  useEffect(() => {
    if (dashboardData?.attendanceRecords?.length) {
      console.log(
        "Parent - Attendance Records:",
        dashboardData.attendanceRecords,
      );
    }
  }, [dashboardData?.attendanceRecords]);

  // Week navigation computed values
  const authUserCreatedAt = (authUser as unknown as Record<string, unknown>)
    ?.createdAt as string | undefined;
  const accountCreatedAt = useMemo(() => {
    if (authUserCreatedAt) return getStartOfWeek(new Date(authUserCreatedAt));
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    return getStartOfWeek(oneYearAgo);
  }, [authUserCreatedAt]);

  const currentWeekStartMemo = useMemo(() => getStartOfWeek(new Date()), []);
  const currentDateMemo = useMemo(() => new Date(), []);

  const availableYears = useMemo(
    () => getAvailableYears(accountCreatedAt, currentDateMemo),
    [accountCreatedAt, currentDateMemo],
  );

  const weeksInSelectedYear = useMemo(
    () => getWeeksInYear(selectedYear, accountCreatedAt, currentDateMemo),
    [selectedYear, accountCreatedAt, currentDateMemo],
  );

  const isCurrentWeek = isSameWeek(selectedWeekStart, new Date());

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    const weeks = getWeeksInYear(year, accountCreatedAt, currentDateMemo);
    if (weeks.length > 0) {
      if (year === currentDateMemo.getFullYear()) {
        setSelectedWeekStart(currentWeekStartMemo);
      } else {
        setSelectedWeekStart(weeks[weeks.length - 1].startDate);
      }
    }
  };

  const handleWeekChange = (weekValue: string) => {
    setSelectedWeekStart(new Date(weekValue));
  };

  const goToCurrentWeek = () => {
    setSelectedYear(currentDateMemo.getFullYear());
    setSelectedWeekStart(currentWeekStartMemo);
  };

  // Use real data or fallback to mock data
  const childData = dashboardData?.child || child;
  const classesData = dashboardData?.classes?.length
    ? dashboardData.classes.map((c) => ({
      subject: c.name,
      total: 12,
      attended: 10,
      score: 8.0,
      teacher: c.teacherName,
    }))
    : courses;

  const attendanceStats = dashboardData?.attendanceStats || {
    present: 28,
    absent: 2,
    late: 0,
    total: 30,
    rate: 93,
  };

  // Dynamic overview stats
  const dynamicOverviewStats = dashboardData
    ? [
      {
        label: "Khóa học",
        value: dashboardData.classes.length,
        note: "Đang theo học",
        icon: "📚",
        color: "from-blue-500 to-blue-600",
      },
      {
        label: "Điểm TB",
        value:
          dashboardData.recentGrades.length > 0
            ? (
              dashboardData.recentGrades.reduce(
                (acc, g) => acc + (g.percentage ?? 0),
                0,
              ) /
              dashboardData.recentGrades.length /
              10
            ).toFixed(1)
            : "N/A",
        note: "Kết quả học tập",
        icon: "⭐",
        color: "from-emerald-500 to-emerald-600",
      },
      {
        label: "Buổi học",
        value: attendanceStats.total,
        note: `${attendanceStats.present} buổi tham dự`,
        icon: "📅",
        color: "from-amber-500 to-orange-500",
      },
      {
        label: "Chuyên cần",
        value: `${attendanceStats.rate}%`,
        note: "Tỉ lệ tham gia",
        icon: "🏆",
        color: "from-purple-500 to-purple-600",
      },
    ]
    : overviewStats;

  // Build timetable from classes (child's enrolled classes)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const timetableByDay = useMemo(() => {
    if (!dashboardData?.classes?.length) return [];

    // Group all schedule entries by dayOfWeek
    const scheduleMap = new Map<
      number,
      Array<{
        classInfo: (typeof dashboardData.classes)[0];
        schedule: {
          dayOfWeek: number;
          startTime: string;
          endTime: string;
          room?: string;
        };
      }>
    >();

    dashboardData.classes
      .filter((c: any) => !c.status || c.status === "active")
      .forEach((classItem) => {
        const scheduleArray = classItem.schedule || [];
        scheduleArray.forEach((sched) => {
          const day = sched.dayOfWeek;
          if (!scheduleMap.has(day)) {
            scheduleMap.set(day, []);
          }
          scheduleMap.get(day)!.push({
            classInfo: classItem,
            schedule: sched,
          });
        });
      });

    // Convert to array sorted by dayOfWeek (0-6)
    const result: Array<{
      dayOfWeek: number;
      dayName: string;
      items: Array<{
        classId: string;
        className: string;
        classCode: string;
        teacherName: string;
        startTime: string;
        endTime: string;
        room?: string;
      }>;
    }> = [];

    for (let day = 0; day < 7; day++) {
      const items = scheduleMap.get(day) || [];
      result.push({
        dayOfWeek: day,
        dayName: dayNames[day],
        items: items.map((item) => ({
          classId: item.classInfo._id,
          className: item.classInfo.name,
          classCode: item.classInfo.name.substring(0, 7).toUpperCase(),
          teacherName: item.classInfo.teacherName,
          startTime: item.schedule.startTime,
          endTime: item.schedule.endTime,
          room: item.schedule.room,
        })),
      });
    }

    return result;
  }, [dashboardData]);

  // Build week schedule with attendance status (week-navigated, like student)
  const weekSchedule = useMemo((): ParentDaySchedule[] => {
    if (!dashboardData?.classes?.length) return [];

    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result: ParentDaySchedule[] = [];

    for (let i = 0; i < 7; i++) {
      const dayDate = addDays(selectedWeekStart, i);
      dayDate.setHours(0, 0, 0, 0);
      const dayOfWeek = dayDate.getDay();
      const isPast = dayDate < today;
      const isToday = dayDate.getTime() === today.getTime();

      const items: ParentDaySchedule["items"] = [];

      dashboardData.classes
        .filter((c: any) => !c.status || c.status === "active")
        .forEach((classItem) => {
          const scheduleArray = classItem.schedule || [];
          scheduleArray.forEach((sched) => {
            if (sched.dayOfWeek === dayOfWeek) {
              const targetYear = dayDate.getFullYear();
              const targetMonth = dayDate.getMonth();
              const targetDay = dayDate.getDate();

              // Look up attendance from records
              let attendanceStatus:
                | "present"
                | "absent"
                | "late"
                | "excused"
                | null = null;

              let attendanceRecord = dashboardData.attendanceRecords?.find(
                (r) => {
                  const session = r.sessionId as {
                    _id: string;
                    startTime: string;
                    classId: { _id: string; name: string } | string;
                  };
                  if (session?.startTime) {
                    const sessionDate = new Date(session.startTime);
                    if (
                      sessionDate.getFullYear() === targetYear &&
                      sessionDate.getMonth() === targetMonth &&
                      sessionDate.getDate() === targetDay
                    ) {
                      const sessionClassId =
                        typeof session.classId === "object" && session.classId
                          ? (session.classId as { _id: string })._id
                          : session.classId;
                      return sessionClassId === classItem._id;
                    }
                  }
                  return false;
                },
              );

              if (!attendanceRecord) {
                attendanceRecord = dashboardData.attendanceRecords?.find(
                  (r) => {
                    const session = r.sessionId as {
                      _id: string;
                      startTime: string;
                      classId: { _id: string; name: string } | string;
                    };
                    if (session?.startTime) {
                      const sessionDate = new Date(session.startTime);
                      return (
                        sessionDate.getFullYear() === targetYear &&
                        sessionDate.getMonth() === targetMonth &&
                        sessionDate.getDate() === targetDay
                      );
                    }
                    return false;
                  },
                );
              }

              if (attendanceRecord) {
                attendanceStatus = attendanceRecord.status;
              } else {
                const sessionRecord = dashboardData.upcomingSessions?.find(
                  (s) => {
                    const sessionDate = new Date(s.date);
                    return (
                      sessionDate.getFullYear() === targetYear &&
                      sessionDate.getMonth() === targetMonth &&
                      sessionDate.getDate() === targetDay &&
                      s.classId === classItem._id
                    );
                  },
                );
                if (sessionRecord) {
                  attendanceStatus = sessionRecord.attendanceStatus || null;
                }
              }

              // Determine session status: past / in-progress / upcoming
              let sessionStatus: "past" | "in-progress" | "upcoming" =
                "upcoming";
              if (isPast && !isToday) {
                sessionStatus = "past";
              } else if (isToday) {
                // Parse startTime and endTime (format "HH:mm")
                const [startH, startM] = sched.startTime.split(":").map(Number);
                const [endH, endM] = sched.endTime.split(":").map(Number);
                const sessionStart = new Date(dayDate);
                sessionStart.setHours(startH, startM, 0, 0);
                const sessionEnd = new Date(dayDate);
                sessionEnd.setHours(endH, endM, 0, 0);

                if (now >= sessionStart && now <= sessionEnd) {
                  sessionStatus = "in-progress";
                } else if (now > sessionEnd) {
                  sessionStatus = "past";
                } else {
                  sessionStatus = "upcoming";
                }
              }

              // Auto absent: if session is past and no attendance was recorded
              if (sessionStatus === "past" && !attendanceStatus) {
                attendanceStatus = "absent";
              }

              items.push({
                classId: classItem._id,
                className: classItem.name,
                classCode:
                  ((classItem as unknown as Record<string, unknown>)
                    .code as string) ||
                  classItem.name.substring(0, 7).toUpperCase(),
                teacherName: classItem.teacherName,
                startTime: sched.startTime,
                endTime: sched.endTime,
                room: sched.room,
                attendanceStatus,
                sessionStatus,
              });
            }
          });
        });

      result.push({
        day: DAY_NAMES[i],
        date: formatDate(dayDate),
        items: items.sort((a, b) => a.startTime.localeCompare(b.startTime)),
      });
    }

    return result;
  }, [selectedWeekStart, dashboardData]);

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
  // Weekly schedule with attendance
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const scheduleWithAttendance = dashboardData?.upcomingSessions?.length
    ? dashboardData.upcomingSessions.slice(0, 7).map((s) => {
      const sessionDate = new Date(s.date);
      const days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
      return {
        day: days[sessionDate.getDay()],
        date: sessionDate.toLocaleDateString("vi-VN", {
          day: "2-digit",
          month: "2-digit",
        }),
        code: s.className.substring(0, 7).toUpperCase(),
        time: `${new Date(s.startTime).toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        })}-${new Date(s.endTime).toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        })}`,
        room: "Phòng học",
        teacher: "Giáo viên",
        status: s.status === "completed" ? "confirmed" : "pending",
        attendanceStatus: s.attendanceStatus,
      };
    })
    : weeklySchedule;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const paidBadge = child.paid ? (
    <Badge variant="success">Đã thanh toán</Badge>
  ) : (
    <Badge variant="warning">Chưa thanh toán</Badge>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
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
              <p className="text-xs text-gray-500">Dashboard Phụ huynh</p>
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
                    /* eslint-disable-next-line @next/next/no-img-element */
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
                    khoản cần thanh toán cho con. Tổng tiền:{" "}
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
        {/* Welcome Banner */}
        <div className="bg-linear-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-2xl p-6 text-white shadow-xl shadow-blue-200/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm">Xin chào 👋</p>
              <h2 className="text-2xl font-bold mt-1">{user.name}</h2>
              <p className="text-blue-100 mt-2 text-sm">
                Chào mừng bạn quay trở lại theo dõi việc học của con!
              </p>
            </div>
            <div className="hidden md:block text-6xl opacity-80">👨‍👩‍👧</div>
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
              value="payment"
              className="whitespace-nowrap px-4 py-2.5 text-sm font-medium rounded-xl data-[state=active]:bg-linear-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
            >
              💳 Thanh toán
            </TabsTrigger>
            <TabsTrigger
              value="contact"
              className="whitespace-nowrap px-4 py-2.5 text-sm font-medium rounded-xl data-[state=active]:bg-linear-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
            >
              💬 Liên hệ
            </TabsTrigger>
            <TabsTrigger
              value="incidents"
              className="whitespace-nowrap px-4 py-2.5 text-sm font-medium rounded-xl data-[state=active]:bg-linear-to-r data-[state=active]:from-orange-500 data-[state=active]:to-red-500 data-[state=active]:text-white data-[state=active]:shadow-md transition-all"
            >
              🐛 Sự cố
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6 space-y-4">
            {dashboardLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">Đang tải dữ liệu...</span>
              </div>
            ) : (
              <>
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
                  {dynamicOverviewStats.map((item) => (
                    <Card
                      key={item.label}
                      className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                    >
                      <div
                        className={`absolute inset-0 bg-linear-to-br ${item.color} opacity-90`}
                      />
                      <div className="relative p-5 text-white">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-white/80 text-sm font-medium">
                              {item.label}
                            </p>
                            <p className="text-3xl font-bold mt-2">
                              {item.value}
                            </p>
                            <p className="text-white/70 text-xs mt-1">
                              {item.note}
                            </p>
                          </div>
                          <span className="text-4xl opacity-80">
                            {item.icon}
                          </span>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                <Card className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900 text-lg">
                        Thông tin con
                      </p>
                      <p className="text-sm text-gray-500">
                        {childData.name} -{" "}
                        {((childData as Record<string, unknown>)
                          .grade as string) || "Lớp 10"}
                      </p>
                    </div>
                    <Button
                      className="bg-blue-600 hover:bg-blue-700"
                      onClick={() => setShowDetail(true)}
                    >
                      Xem chi tiết
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {classesData.map((course) => (
                      <Card key={course.subject} className="p-3 bg-gray-50">
                        <p className="font-semibold text-gray-900">
                          {course.subject}
                        </p>
                        <p className="text-lg font-bold text-blue-600">
                          {course.score}
                        </p>
                        <p className="text-xs text-gray-500">
                          {course.teacher}
                        </p>
                      </Card>
                    ))}
                  </div>
                </Card>

                {/* Financial Summary Card */}
                <Card className="rounded-2xl shadow-sm border border-gray-100 p-6 bg-white">
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
              </>
            )}
          </TabsContent>

          <TabsContent value="schedule" className="mt-6">
            <Card className="p-6 space-y-5 bg-white border-0 shadow-lg">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📅</span>
                  <div>
                    <p className="font-bold text-gray-900 text-lg">
                      {isCurrentWeek ? "Lịch học con tuần này" : "Lịch học con"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {isCurrentWeek
                        ? "Theo dõi các buổi học của con"
                        : `Tuần ${formatWeekRange(selectedWeekStart)}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Year Selector */}
                  <select
                    value={selectedYear}
                    onChange={(e) => handleYearChange(Number(e.target.value))}
                    className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white hover:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent cursor-pointer"
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
                    className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white hover:border-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent cursor-pointer min-w-35"
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

              {weekSchedule.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
                  {weekSchedule.map((dayData, dayIndex) => {
                    const dayDate = addDays(selectedWeekStart, dayIndex);
                    const todayDate = new Date();
                    todayDate.setHours(0, 0, 0, 0);
                    dayDate.setHours(0, 0, 0, 0);
                    const isToday = dayDate.getTime() === todayDate.getTime();
                    const isPast = dayDate < todayDate;

                    return (
                      <div
                        key={dayData.day}
                        className={`rounded-2xl border-2 bg-white shadow-sm overflow-hidden flex flex-col transition-all duration-300 hover:shadow-md ${isToday
                            ? "border-amber-400 ring-2 ring-amber-100"
                            : isPast
                              ? "border-gray-200 opacity-80"
                              : "border-gray-100"
                          }`}
                      >
                        <div
                          className={`px-3 py-3 text-center ${isToday
                              ? "bg-linear-to-r from-amber-500 to-orange-500 text-white"
                              : isPast
                                ? "bg-linear-to-r from-gray-500 to-gray-600 text-white"
                                : "bg-linear-to-r from-gray-700 to-gray-800 text-white"
                            }`}
                        >
                          <p className="text-xs font-bold leading-tight">
                            {DAY_NAMES_VN[dayIndex]}
                          </p>
                          <p className="text-lg font-bold leading-tight">
                            {dayData.date.split("/")[0]}
                          </p>
                          {isToday && (
                            <p className="text-[10px] mt-0.5 text-amber-200">
                              Hôm nay
                            </p>
                          )}
                          {isPast && !isToday && (
                            <p className="text-[10px] mt-0.5 text-gray-300">
                              Đã qua
                            </p>
                          )}
                        </div>

                        {dayData.items.length === 0 ? (
                          <div className="flex-1 flex flex-col items-center justify-center text-gray-300 py-8">
                            <span className="text-3xl mb-2">😴</span>
                            <span className="text-xs">Nghỉ</span>
                          </div>
                        ) : (
                          <div className="flex-1 p-2 space-y-2">
                            {dayData.items.map((item, idx) => (
                              <div
                                key={`${item.classId}-${idx}`}
                                className="rounded-lg bg-linear-to-br from-amber-50 to-orange-50 border border-amber-100 p-2 space-y-1 hover:shadow-md transition-shadow"
                              >
                                <div className="text-xs font-bold text-amber-700 truncate">
                                  {item.className}
                                </div>
                                <div className="text-[10px] font-medium text-gray-800">
                                  ⏰ {item.startTime} - {item.endTime}
                                </div>
                                {item.room && (
                                  <div className="text-[10px] text-gray-500">
                                    📍 {item.room}
                                  </div>
                                )}
                                <div className="text-[10px] text-amber-600 truncate">
                                  👨‍🏫 {item.teacherName}
                                </div>
                                {/* Attendance / Session Status */}
                                {item.sessionStatus === "in-progress" ? (
                                  <div className="w-full text-[10px] rounded-md py-1 px-1 font-medium text-center bg-green-100 text-green-700 border border-green-200 animate-pulse">
                                    🟢 Đang học
                                  </div>
                                ) : item.attendanceStatus ? (
                                  <div
                                    className={`w-full text-[10px] rounded-md py-1 px-1 font-medium text-center ${item.attendanceStatus === "present"
                                        ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                                        : item.attendanceStatus === "absent"
                                          ? "bg-red-100 text-red-700 border border-red-200"
                                          : item.attendanceStatus === "late"
                                            ? "bg-amber-100 text-amber-700 border border-amber-200"
                                            : "bg-blue-100 text-blue-700 border border-blue-200"
                                      }`}
                                  >
                                    {item.attendanceStatus === "present" &&
                                      "✅ Có mặt"}
                                    {item.attendanceStatus === "absent" &&
                                      "❌ Vắng"}
                                    {item.attendanceStatus === "late" &&
                                      "⏰ Đi muộn"}
                                    {item.attendanceStatus === "excused" &&
                                      "📝 Nghỉ phép"}
                                  </div>
                                ) : item.sessionStatus === "upcoming" ? (
                                  <div className="w-full text-[10px] rounded-md py-1 px-1 font-medium text-center bg-gray-100 text-gray-600 border border-gray-200">
                                    ⏭ Tiếp theo
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <p className="text-4xl mb-4">📅</p>
                  <p className="font-medium">Chưa có lịch học</p>
                  <p className="text-sm mt-2">
                    Con chưa được xếp lịch học vào lớp nào
                  </p>
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="progress" className="mt-6">
            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2 p-6 bg-white border-0 shadow-lg">
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-2xl">📈</span>
                  <div>
                    <p className="font-bold text-gray-900 text-lg">
                      Tiến độ học tập con
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
                      <LineChart
                        data={progressData}
                        margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
                      >
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
                        <Line
                          type="monotone"
                          dataKey="score"
                          stroke="#2563eb"
                          strokeWidth={3}
                          dot={{
                            r: 6,
                            fill: "#2563eb",
                            stroke: "#fff",
                            strokeWidth: 2,
                          }}
                        />
                      </LineChart>
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
                      {childGrades.length}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {progressBySubject.length} môn học
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
                            className={`px-3 py-2 rounded-lg text-sm ${item.score >= 8
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
                      Xem và thanh toán các khoản phí cho con
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => (window.location.href = "/payment")}
                  className="bg-linear-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-lg shadow-green-200"
                >
                  Vào trang thanh toán →
                </Button>
              </div>

              {/* Quick Status */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div
                  onClick={() => (window.location.href = "/payment")}
                  className="p-5 rounded-xl bg-linear-to-r from-blue-50 to-indigo-50 border border-blue-100 cursor-pointer hover:shadow-lg transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-white shadow flex items-center justify-center text-xl">
                      📋
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">
                        Danh sách yêu cầu
                      </h3>
                      <p className="text-sm text-gray-500">
                        Kiểm tra các khoản cần đóng
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  onClick={() => (window.location.href = "/payment")}
                  className="p-5 rounded-xl bg-linear-to-r from-orange-50 to-red-50 border border-orange-100 cursor-pointer hover:shadow-lg transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-white shadow flex items-center justify-center text-xl">
                      history
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">
                        Lịch sử giao dịch
                      </h3>
                      <p className="text-sm text-gray-500">
                        Xem lại các khoản đã thanh toán
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="contact" className="mt-6">
            <Card className="p-5 space-y-3">
              <p className="font-semibold text-gray-900">
                Liên hệ với giáo viên
              </p>
              {contacts.map((c) => (
                <div
                  key={c.name}
                  className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3"
                >
                  <div>
                    <p className="font-semibold text-gray-900">{c.name}</p>
                    <p className="text-xs text-gray-500">{c.subject}</p>
                  </div>
                  <Button
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={() =>
                      setChatWith({ name: c.name, role: "teacher" })
                    }
                  >
                    Chat
                  </Button>
                </div>
              ))}
            </Card>
          </TabsContent>

          <TabsContent value="incidents" className="mt-6">
            <IncidentReportModal
              isOpen={true}
              onClose={() => { }}
              userName={user.name}
              userEmail={user.email}
              userRole={user.role}
              isEmbedded={true}
            />
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
      {showDetail && (
        <DetailModal
          onClose={() => setShowDetail(false)}
          childInfo={childData as ChildInfo & Record<string, unknown>}
          grades={childGrades}
        />
      )}
      {showSettings && (
        <SettingsModal
          user={
            (fullUserDetails as typeof user & {
              _id?: string;
              parentCode?: string;
              childEmail?: string;
            }) || user
          }
          onClose={() => setShowSettings(false)}
        />
      )}
      <ToastContainer />
    </div>
  );
}
