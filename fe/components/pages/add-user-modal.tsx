"use client";
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SUBJECT_LIST, getSubjectColor } from "@/lib/constants/subjects";
import { useUsersStore } from "@/lib/stores/users-store";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { useBranchesStore, Branch } from "@/lib/stores/branches-store";

interface AddUserModalProps {
  userType: "student" | "parent" | "teacher";
  isOpen: boolean;
  onClose: () => void;
  onAdd: (user: NewUserPayload) => void;
}

type UserType = "student" | "parent" | "teacher";

type BaseForm = {
  fullName: string;
  email: string;
  phone: string;
  branchId: string;
};

// Loại học bổng
export type ScholarshipType = "teacher_child" | "poor_family" | "orphan";

export const SCHOLARSHIP_TYPES: { value: ScholarshipType; label: string }[] = [
  { value: "teacher_child", label: "Con giáo viên" },
  { value: "poor_family", label: "Hộ nghèo" },
  { value: "orphan", label: "Con mồ côi" },
];

type StudentForm = BaseForm & {
  studentId: string;
  parentName: string;
  hasScholarship: boolean;
  scholarshipType: ScholarshipType | "";
  scholarshipPercent: number;
};
type ParentForm = BaseForm & { childrenCount: string };
type TeacherForm = BaseForm & {
  subjects: string[]; // Đổi từ subject thành subjects (array)
  experience: string;
  qualification: string;
  teacherNote: string;
};

type FormDataState = StudentForm | ParentForm | TeacherForm;

type NewUserPayload = FormDataState & {
  id: string;
  role: UserType;
  createdAt: string;
};

const BASE_FORM: BaseForm = {
  fullName: "",
  email: "",
  phone: "",
  branchId: "",
};

const getDefaultForm = (userType: UserType): FormDataState => {
  if (userType === "student")
    return {
      ...BASE_FORM,
      studentId: "",
      parentName: "",
      hasScholarship: false,
      scholarshipType: "",
      scholarshipPercent: 0,
    };
  if (userType === "parent") return { ...BASE_FORM, childrenCount: "1" };
  return {
    ...BASE_FORM,
    subjects: [],
    experience: "",
    qualification: "",
    teacherNote: "",
  };
};

export default function AddUserModal({
  userType,
  isOpen,
  onClose,
  onAdd,
}: AddUserModalProps) {
  const [formData, setFormData] = useState<FormDataState>(() =>
    getDefaultForm(userType),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { createUser } = useUsersStore();
  const { branches, fetchBranches } = useBranchesStore();

  // Fetch branches on mount
  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  // Reset form khi userType thay đổi hoặc modal mở lại
  useEffect(() => {
    if (isOpen) {
      setFormData(getDefaultForm(userType));
      setError(null);
      setIsLoading(false);
    }
  }, [userType, isOpen]);

  // Handlers - định nghĩa trước return
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("=== FORM SUBMITTED ==="); // Debug
    console.log("Form data:", formData); // Debug
    console.log("User type:", userType); // Debug

    setError(null);
    setIsLoading(true);

    try {
      // Validate cơ bản
      if (!formData.branchId) {
        throw new Error("Vui lòng chọn chi nhánh");
      }
      if (!formData.fullName.trim()) {
        throw new Error("Vui lòng nhập họ tên");
      }
      if (!formData.email.trim()) {
        throw new Error("Vui lòng nhập email");
      }
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        throw new Error("Email không hợp lệ");
      }
      // Validate teacher subjects
      if (
        userType === "teacher" &&
        "subjects" in formData &&
        formData.subjects.length === 0
      ) {
        throw new Error("Vui lòng chọn ít nhất một môn dạy");
      }

      // Chuẩn bị dữ liệu để gửi lên API
      const apiData: Parameters<typeof createUser>[0] = {
        name: formData.fullName.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone?.trim() || undefined,
        password: "123456", // Mật khẩu mặc định, user sẽ đổi sau
        role: userType,
        branchId: formData.branchId || undefined,
      };

      // Thêm thông tin giáo viên nếu là teacher
      if (userType === "teacher" && "subjects" in formData) {
        apiData.subjects = formData.subjects;
        apiData.qualification = formData.qualification || undefined;
        apiData.teacherNote = formData.teacherNote || undefined;
        apiData.experienceYears = formData.experience
          ? parseInt(formData.experience)
          : undefined;
      }

      // Thêm thông tin học bổng nếu là student
      if (userType === "student" && "hasScholarship" in formData) {
        apiData.hasScholarship = formData.hasScholarship;
        if (formData.hasScholarship && formData.scholarshipType) {
          apiData.scholarshipType = formData.scholarshipType;
          apiData.scholarshipPercent = formData.scholarshipPercent;
        }
      }

      console.log("=== CALLING API ==="); // Debug
      console.log("Creating user with data:", apiData);
      const newUser = await createUser(apiData);
      console.log("=== API SUCCESS ==="); // Debug
      console.log("User created successfully:", newUser);

      // Gọi onAdd để refresh list
      const newUserPayload: NewUserPayload = {
        id: newUser._id || Math.random().toString(36).slice(2, 9),
        ...formData,
        role: userType,
        createdAt: new Date().toLocaleDateString("vi-VN"),
      };
      onAdd(newUserPayload);
      onClose();
    } catch (err: unknown) {
      console.error("=== API ERROR ==="); // Debug
      const error = err as {
        response?: { data?: { message?: string | string[] } };
        message?: string;
      };
      console.error("Error creating user:", error);
      console.error("Error response:", error?.response); // Debug
      console.error("Error response data:", error?.response?.data); // Debug
      // Lấy message từ nhiều nguồn có thể
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Đã có lỗi xảy ra khi tạo người dùng";
      setError(Array.isArray(message) ? message.join(", ") : message);
    } finally {
      setIsLoading(false);
    }
  };

  const title =
    userType === "student"
      ? "Thêm học sinh"
      : userType === "parent"
        ? "Thêm phụ huynh"
        : "Thêm giáo viên";

  // Early return PHẢI sau tất cả hooks
  if (!isOpen) return null;

  console.log("=== AddUserModal RENDERED ===", {
    userType,
    isOpen,
    formData,
    branches,
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-gray-900 mb-4">{title}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Chọn chi nhánh */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Chi nhánh <span className="text-red-500">*</span>
            </label>
            <select
              name="branchId"
              value={formData.branchId}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              <option value="">-- Chọn chi nhánh --</option>
              {branches.map((branch) => (
                <option key={branch._id} value={branch._id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Họ tên</label>
            <Input
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Email</label>
            <Input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Số điện thoại
            </label>
            <Input
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              required
            />
          </div>

          {userType === "student" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Mã học sinh
                  </label>
                  <Input
                    name="studentId"
                    value={"studentId" in formData ? formData.studentId : ""}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Tên phụ huynh
                  </label>
                  <Input
                    name="parentName"
                    value={"parentName" in formData ? formData.parentName : ""}
                    onChange={handleChange}
                  />
                </div>
              </div>

              {/* Phần học bổng */}
              <div className="border rounded-lg p-3 space-y-3 bg-gray-50">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="hasScholarship"
                    checked={
                      "hasScholarship" in formData
                        ? formData.hasScholarship
                        : false
                    }
                    onChange={(e) => {
                      if ("hasScholarship" in formData) {
                        setFormData({
                          ...formData,
                          hasScholarship: e.target.checked,
                          scholarshipType: e.target.checked
                            ? formData.scholarshipType
                            : "",
                          scholarshipPercent: e.target.checked
                            ? formData.scholarshipPercent
                            : 0,
                        } as StudentForm);
                      }
                    }}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <label
                    htmlFor="hasScholarship"
                    className="text-sm font-medium text-gray-700"
                  >
                    Có học bổng
                  </label>
                </div>

                {"hasScholarship" in formData && formData.hasScholarship && (
                  <div className="space-y-3 pl-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">
                        Loại học bổng <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="scholarshipType"
                        value={
                          "scholarshipType" in formData
                            ? formData.scholarshipType
                            : ""
                        }
                        onChange={handleChange}
                        required
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                      >
                        <option value="">-- Chọn loại học bổng --</option>
                        {SCHOLARSHIP_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">
                        Phần trăm học bổng (%)
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          name="scholarshipPercent"
                          min="0"
                          max="100"
                          step="5"
                          value={
                            "scholarshipPercent" in formData
                              ? formData.scholarshipPercent
                              : 0
                          }
                          onChange={(e) => {
                            if ("scholarshipPercent" in formData) {
                              setFormData({
                                ...formData,
                                scholarshipPercent: parseInt(e.target.value),
                              } as StudentForm);
                            }
                          }}
                          className="flex-1"
                        />
                        <span className="text-sm font-semibold text-blue-600 min-w-12 text-right">
                          {"scholarshipPercent" in formData
                            ? formData.scholarshipPercent
                            : 0}
                          %
                        </span>
                      </div>
                      <input
                        type="number"
                        name="scholarshipPercentInput"
                        min="0"
                        max="100"
                        value={
                          "scholarshipPercent" in formData
                            ? formData.scholarshipPercent
                            : 0
                        }
                        onChange={(e) => {
                          if ("scholarshipPercent" in formData) {
                            const value = Math.min(
                              100,
                              Math.max(0, parseInt(e.target.value) || 0),
                            );
                            setFormData({
                              ...formData,
                              scholarshipPercent: value,
                            } as StudentForm);
                          }
                        }}
                        className="w-full px-3 py-2 border rounded-lg text-sm"
                        placeholder="Hoặc nhập trực tiếp (0-100)"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {userType === "parent" && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Số con
              </label>
              <Input
                name="childrenCount"
                value={
                  "childrenCount" in formData ? formData.childrenCount : ""
                }
                onChange={handleChange}
              />
            </div>
          )}

          {userType === "teacher" && (
            <div className="space-y-4">
              {/* Môn dạy - Multi-select */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Môn dạy <span className="text-red-500">*</span>
                </label>
                <div className="border rounded-lg p-3 max-h-40 overflow-y-auto">
                  <div className="flex flex-wrap gap-2">
                    {SUBJECT_LIST.map((subject) => {
                      const isSelected =
                        "subjects" in formData &&
                        formData.subjects.includes(subject);
                      return (
                        <button
                          key={subject}
                          type="button"
                          onClick={() => {
                            if ("subjects" in formData) {
                              const newSubjects = isSelected
                                ? formData.subjects.filter((s) => s !== subject)
                                : [...formData.subjects, subject];
                              setFormData({
                                ...formData,
                                subjects: newSubjects,
                              });
                            }
                          }}
                          className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                            isSelected
                              ? getSubjectColor(subject) +
                                " ring-2 ring-offset-1 ring-blue-400"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {isSelected && "✓ "}
                          {subject}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {"subjects" in formData && formData.subjects.length > 0 && (
                  <p className="text-xs text-gray-500">
                    Đã chọn: {formData.subjects.length} môn
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Kinh nghiệm (năm)
                  </label>
                  <Input
                    type="number"
                    name="experience"
                    min="0"
                    value={"experience" in formData ? formData.experience : ""}
                    onChange={handleChange}
                    placeholder="VD: 5"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Trình độ
                  </label>
                  <select
                    name="qualification"
                    value={
                      "qualification" in formData ? formData.qualification : ""
                    }
                    onChange={handleChange}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="">-- Chọn --</option>
                    <option value="Cử nhân">Cử nhân</option>
                    <option value="Thạc sĩ">Thạc sĩ</option>
                    <option value="Tiến sĩ">Tiến sĩ</option>
                    <option value="Giáo sư">Giáo sư</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Ghi chú
                </label>
                <textarea
                  name="teacherNote"
                  value={"teacherNote" in formData ? formData.teacherNote : ""}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      teacherNote: e.target.value,
                    } as TeacherForm)
                  }
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
                  placeholder="Ghi chú về giáo viên (chuyên môn, thành tích...)"
                />
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold disabled:opacity-60"
              disabled={isLoading}
              onClick={() => {
                console.log("=== BUTTON CLICKED ===");
                console.log("Form data at click:", formData);
              }}
            >
              {isLoading ? "Đang thêm..." : "Thêm"}
            </button>
            <button
              type="button"
              className="flex-1 border border-gray-300 text-gray-900 hover:bg-gray-50 px-4 py-2 rounded-lg font-semibold"
              onClick={onClose}
              disabled={isLoading}
            >
              Hủy
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
