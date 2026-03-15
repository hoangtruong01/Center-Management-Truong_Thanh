"use client";
import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useScheduleStore,
  Session,
  SessionType,
  CreateSessionData,
  UpdateSessionData,
} from "@/lib/stores/schedule-store";
import { Class, useClassesStore } from "@/lib/stores/classes-store";
import { Branch, useBranchesStore } from "@/lib/stores/branches-store";
import { SUBJECT_LIST } from "@/lib/constants/subjects";
import { notificationService } from "@/lib/services/notificationService.service";
import { toast } from "react-toastify";

interface SessionFormModalProps {
  session: Session | null;
  classes: Class[];
  branches?: Branch[];
  onClose: () => void;
}

export default function SessionFormModal({
  session,
  classes: initialClasses,
  branches: initialBranches = [],
  onClose,
}: SessionFormModalProps) {
  const {
    createSession,
    updateSession,
    deleteSession,
    checkConflict,
    isLoading,
  } = useScheduleStore();

  // Use stores directly for fresh data
  const { branches: storeBranches, fetchBranches } = useBranchesStore();
  const { classes: storeClasses, fetchClasses } = useClassesStore();

  // Local state for data
  const [localBranches, setLocalBranches] = useState<Branch[]>(initialBranches);
  const [isLoadingData, setIsLoadingData] = useState(false);

  // Fetch fresh data when modal opens
  useEffect(() => {
    const loadFreshData = async () => {
      setIsLoadingData(true);
      try {
        // Fetch branches và danh sách lớp mới nhất
        await Promise.all([fetchBranches(), fetchClasses()]);
      } catch (error) {
        console.error("Error loading fresh data:", error);
      } finally {
        setIsLoadingData(false);
      }
    };

    loadFreshData();
  }, [fetchBranches, fetchClasses]);

  // Update local state when store data changes
  useEffect(() => {
    if (storeBranches.length > 0) {
      setLocalBranches(storeBranches);
    }
  }, [storeBranches]);

  // Khi chỉnh sửa, ưu tiên lớp/cơ sở đã có trong danh sách hiện có để select hiển thị được option tương ứng
  const branches = useMemo(() => {
    if (localBranches.length > 0) return localBranches;
    if (initialBranches.length > 0) return initialBranches;
    return storeBranches;
  }, [localBranches, initialBranches, storeBranches]);

  const classes = useMemo(() => {
    const source = storeClasses.length > 0 ? storeClasses : initialClasses;
    if (!session || !source.some((c) => c._id === session.classId)) {
      return source;
    }
    return source;
  }, [storeClasses, initialClasses, session]);

  const [formData, setFormData] = useState({
    branchId: "", // Cơ sở được chọn
    classId: "", // Lớp được chọn
    teacherId: "",
    subject: "", // Môn học được chọn
    grade: "", // Khối lớp được chọn
    title: "",
    room: "",
    date: "",
    startTime: "08:00",
    endTime: "09:30",
    type: SessionType.Makeup, // Default to makeup since we removed regular
    note: "",
  });

  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Filter classes by selected branch, subject, and grade
  const filteredClasses = useMemo(() => {
    let result = classes.filter((c) => c.status === "active");

    // Filter by branch if selected
    if (formData.branchId) {
      result = result.filter((c) => {
        const classBranchId =
          typeof c.branchId === "string"
            ? c.branchId
            : c.branchId?._id || c.branch?._id;
        return classBranchId === formData.branchId;
      });
    }

    // Filter by subject if selected
    if (formData.subject) {
      result = result.filter((c) => c.subject === formData.subject);
    }

    // Filter by grade if selected
    if (formData.grade) {
      result = result.filter((c) => c.grade === formData.grade);
    }

    return result;
  }, [classes, formData.branchId, formData.subject, formData.grade]);

  const selectedClass = useMemo(() => {
    return classes.find((c) => c._id === formData.classId) || null;
  }, [classes, formData.classId]);

  // Initialize form data when editing
  useEffect(() => {
    if (session) {
      const startDate = new Date(session.startTime);
      const endDate = new Date(session.endTime);

      // Get teacherId directly from session or from classId
      let teacherId = "";
      let subject = "";
      let branchId = "";
      let classId = "";
      let grade = "";

      const sessionClassId =
        typeof session.classId === "string"
          ? session.classId
          : session.classId?._id;

      const classFromStore = sessionClassId
        ? classes.find((c) => c._id === sessionClassId)
        : undefined;

      // First try to get from session directly (new format)
      if (session.teacherId) {
        teacherId =
          typeof session.teacherId === "string"
            ? session.teacherId
            : session.teacherId._id;
      }
      if (session.subject) {
        subject = session.subject;
      }

      const classCandidates = [
        typeof session.classId === "string" ? undefined : session.classId,
        classFromStore,
      ].filter(Boolean) as Class[];

      for (const classInfo of classCandidates) {
        classId = classInfo._id || classId;
        grade = classInfo.grade || grade;
        if (!teacherId && classInfo.teacherId) {
          teacherId =
            typeof classInfo.teacherId === "string"
              ? classInfo.teacherId
              : classInfo.teacherId._id;
        }
        if (!subject) {
          subject = classInfo.subject || classInfo.name || "";
        }
        if (!branchId && classInfo.branchId) {
          branchId =
            typeof classInfo.branchId === "string"
              ? classInfo.branchId
              : classInfo.branchId?._id || classInfo.branchId?.id || "";
        }
        if (!branchId && classInfo.branch) {
          branchId = classInfo.branch._id;
        }
      }

      if (!classId && sessionClassId) {
        classId = sessionClassId;
      }

      if (!grade) {
        grade =
          typeof session.classId !== "string" &&
          session.classId &&
          "grade" in session.classId
            ? (session.classId as any).grade || ""
            : "";
      }

      if (!branchId && typeof session.classId !== "string") {
        const classBranch = (session.classId as any)?.branch;
        if (classBranch?._id) {
          branchId = classBranch._id;
        }
      }

      setFormData({
        branchId: branchId,
        classId,
        teacherId: teacherId,
        subject: subject,
        grade,
        title: session.title || "",
        room: session.room || "",
        date: startDate.toISOString().split("T")[0],
        startTime: startDate.toTimeString().slice(0, 5),
        endTime: endDate.toTimeString().slice(0, 5),
        type: session.type,
        note: session.note || "",
      });
    }
  }, [session, classes]);

  // Check for conflicts when time changes
  useEffect(() => {
    const checkForConflicts = async () => {
      if (
        !formData.teacherId ||
        !formData.date ||
        !formData.startTime ||
        !formData.endTime
      ) {
        setConflictWarning(null);
        return;
      }

      const startDateTime = new Date(`${formData.date}T${formData.startTime}`);
      const endDateTime = new Date(`${formData.date}T${formData.endTime}`);

      try {
        const result = await checkConflict({
          teacherId: formData.teacherId,
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          excludeSessionId: session?._id,
        });

        if (result.hasConflict) {
          setConflictWarning(
            `⚠️ Giáo viên đã có ${result.conflicts.length} buổi học trùng thời gian này!`,
          );
        } else {
          setConflictWarning(null);
        }
      } catch (error) {
        console.error("Error checking conflict:", error);
      }
    };

    const debounceTimer = setTimeout(checkForConflicts, 500);
    return () => clearTimeout(debounceTimer);
  }, [
    formData.teacherId,
    formData.date,
    formData.startTime,
    formData.endTime,
    session?._id,
    checkConflict,
  ]);

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.branchId) {
      newErrors.branchId = "Vui lòng chọn cơ sở";
    }
    if (!formData.subject) {
      newErrors.subject = "Vui lòng chọn môn học";
    }
    if (!formData.classId) {
      newErrors.classId = "Vui lòng chọn lớp";
    }
    if (!formData.title.trim()) {
      newErrors.title = "Vui lòng nhập tiêu đề buổi học";
    }
    if (!formData.date) {
      newErrors.date = "Vui lòng chọn ngày";
    }
    if (!formData.startTime) {
      newErrors.startTime = "Vui lòng chọn giờ bắt đầu";
    }
    if (!formData.endTime) {
      newErrors.endTime = "Vui lòng chọn giờ kết thúc";
    }
    if (formData.startTime >= formData.endTime) {
      newErrors.endTime = "Giờ kết thúc phải sau giờ bắt đầu";
    }

    if (!newErrors.date && formData.date && formData.startTime) {
      const startDateTime = new Date(`${formData.date}T${formData.startTime}`);
      const now = new Date();
      if (startDateTime.getTime() < now.getTime()) {
        newErrors.date = "Không thể tạo buổi học trong quá khứ";
      }
    }

    const parseMinutes = (time: string) => {
      const [h, m] = time.split(":").map(Number);
      return h * 60 + m;
    };
    const MIN_START_MINUTES = 7 * 60;
    const MAX_END_MINUTES = 20 * 60;

    if (!newErrors.startTime && formData.startTime) {
      const startMinutes = parseMinutes(formData.startTime);
      if (startMinutes < MIN_START_MINUTES) {
        newErrors.startTime = "Giờ bắt đầu phải từ 07:00 trở đi";
      }
      if (startMinutes > MAX_END_MINUTES) {
        newErrors.startTime = "Giờ bắt đầu không được sau 20:00";
      }
    }

    if (!newErrors.endTime && formData.endTime) {
      const endMinutes = parseMinutes(formData.endTime);
      if (endMinutes > MAX_END_MINUTES) {
        newErrors.endTime = "Giờ kết thúc phải trước hoặc bằng 20:00";
      }
      if (endMinutes < MIN_START_MINUTES) {
        newErrors.endTime = "Giờ kết thúc không được trước 07:00";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    const startDateTime = new Date(`${formData.date}T${formData.startTime}`);
    const endDateTime = new Date(`${formData.date}T${formData.endTime}`);

    try {
      if (session) {
        // Update existing session - send all relevant fields
        const updateData: UpdateSessionData = {
          classId: formData.classId || undefined,
          teacherId: formData.teacherId || undefined,
          subject: formData.subject || undefined,
          title: formData.title || undefined,
          room: formData.room || undefined,
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          type: formData.type,
          note: formData.note || undefined,
        };
        await updateSession(session._id, updateData);
      } else {
        // Create new session
        const createData: CreateSessionData & {
          title?: string;
          room?: string;
          teacherId?: string;
          subject?: string;
        } = {
          classId: formData.classId || undefined, // Use selected class if available
          teacherId: formData.teacherId,
          subject: formData.subject,
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          type: formData.type,
          note: formData.note || undefined,
          title: formData.title || undefined,
          room: formData.room || undefined,
        };
        await createSession(createData as CreateSessionData);
      }

      // Tự động bắn thông báo nếu là lịch học bù
      if (formData.type === SessionType.Makeup && formData.classId) {
        notificationService.notifyMakeUpClass({
          classId: formData.classId,
          className: selectedClass?.name || "Lớp học",
          subject: formData.subject,
          date: formData.date,
          startTime: formData.startTime,
          endTime: formData.endTime,
          room: formData.room || "Chưa xác định"
        }).then(() => {
          toast.success("Đã gửi thông báo lịch học bù cho GV, HS và PH");
        }).catch(err => {
          console.error("Lỗi gửi thông báo học bù:", err);
          toast.error("Không thể gửi thông báo tự động");
        });
      }

      toast.success(session ? "Cập nhật thành công" : "Tạo buổi học thành công");
      onClose();
    } catch (error) {
      console.error("Error saving session:", error);
    }
  };

  // Handle input change with data refresh
  const handleChange = async (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when user changes value
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
    // Reset dependent fields when branch changes
    if (name === "branchId") {
      setFormData((prev) => ({
        ...prev,
        branchId: value,
        subject: "",
        grade: "",
        classId: "",
        teacherId: "",
      }));
    }
    // Reset class and teacher when subject changes
    if (name === "subject") {
      setFormData((prev) => ({
        ...prev,
        subject: value,
        classId: "",
        teacherId: "",
      }));
    }
    // Reset class when grade changes
    if (name === "grade") {
      setFormData((prev) => ({
        ...prev,
        grade: value,
        classId: "",
      }));
    }
    // Auto-fill teacher from class if class is selected
    if (name === "classId") {
      if (value) {
        const selectedClass = classes.find((c) => c._id === value);
        if (selectedClass) {
          const classTeacherId =
            typeof selectedClass.teacherId === "string"
              ? selectedClass.teacherId
              : selectedClass.teacherId?._id || selectedClass.teacher?._id;
          setFormData((prev) => ({
            ...prev,
            classId: value,
            teacherId: classTeacherId || "",
          }));
        }
      } else {
        setFormData((prev) => ({
          ...prev,
          teacherId: "",
        }));
      }
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <Card className="w-full max-w-lg p-6 bg-white shadow-2xl border-0 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-lg">
            📅
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-900">
              {session ? "Chỉnh sửa buổi học" : "Thêm buổi học bất thường"}
            </h3>
            <p className="text-sm text-gray-500">
              {session
                ? "Cập nhật thông tin buổi học"
                : "Tạo buổi học bù hoặc kiểm tra"}
            </p>
          </div>
          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            title="Đóng"
          >
            <span className="text-lg">✕</span>
          </button>
        </div>

        {/* Loading indicator */}
        {isLoadingData && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800 text-sm flex items-center gap-2">
            <span className="animate-spin">⏳</span>
            Đang tải dữ liệu mới nhất...
          </div>
        )}

        {/* Conflict Warning */}
        {conflictWarning && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
            {conflictWarning}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4" onClick={(e) => e.stopPropagation()}>
          {/* Branch Selection - First Step */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Cơ sở <span className="text-red-500">*</span>
              <span className="text-xs text-gray-400 ml-2">
                ({branches.length} cơ sở)
              </span>
            </label>
            <select
              name="branchId"
              value={formData.branchId}
              onChange={handleChange}
              disabled={!!session || isLoadingData}
              className={`nice-select w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.branchId ? "border-red-300" : "border-gray-200"
              } ${session || isLoadingData ? "bg-gray-100" : ""}`}
            >
              <option value="">
                {isLoadingData ? "⏳ Đang tải..." : "-- Chọn cơ sở --"}
              </option>
              {branches.map((b) => (
                <option key={b._id} value={b._id}>
                  🏫 {b.name}
                </option>
              ))}
            </select>
            {errors.branchId && (
              <p className="text-red-500 text-xs mt-1">{errors.branchId}</p>
            )}
          </div>

          {/* Subject Selection - Second Step */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Môn học <span className="text-red-500">*</span>
            </label>
            <select
              name="subject"
              value={formData.subject}
              onChange={handleChange}
              disabled={!!session || !formData.branchId || isLoadingData}
              className={`nice-select w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.subject ? "border-red-300" : "border-gray-200"
              } ${session || !formData.branchId || isLoadingData ? "bg-gray-100" : ""}`}
            >
              <option value="">
                {!formData.branchId
                  ? "-- Chọn cơ sở trước --"
                  : "-- Chọn môn học --"}
              </option>
              {SUBJECT_LIST.map((subject) => (
                <option key={subject} value={subject}>
                  📖 {subject}
                </option>
              ))}
            </select>
            {errors.subject && (
              <p className="text-red-500 text-xs mt-1">{errors.subject}</p>
            )}
          </div>

          {/* Class Selection - Third Step (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Khối lớp
              <span className="text-xs text-gray-400 ml-2">
                (lọc theo khối)
              </span>
            </label>
            <select
              name="grade"
              value={formData.grade}
              onChange={handleChange}
              disabled={!!session || !formData.subject || isLoadingData}
              className={`nice-select w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 border-gray-200 ${
                session || !formData.subject || isLoadingData
                  ? "bg-gray-100"
                  : ""
              }`}
            >
              <option value="">-- Tất cả khối --</option>
              {["6", "7", "8", "9", "10", "11", "12"].map((g) => (
                <option key={g} value={g}>
                  🎓 Khối {g}
                </option>
              ))}
            </select>
          </div>

          {/* Class Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lớp học <span className="text-red-500">*</span>
              <span className="text-xs text-gray-400 ml-2">
                ({filteredClasses.length} lớp phù hợp)
              </span>
            </label>
            <select
              name="classId"
              value={formData.classId}
              onChange={handleChange}
              disabled={!!session || !formData.subject || isLoadingData}
              className={`nice-select w-full px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.classId ? "border-red-300" : "border-gray-200"
              } ${session || !formData.subject || isLoadingData ? "bg-gray-100" : ""}`}
            >
              <option value="">
                {!formData.subject
                  ? "-- Chọn môn học trước --"
                  : "-- Chọn lớp --"}
              </option>
              {filteredClasses.map((c) => {
                const teacherName =
                  c.teacher?.name ||
                  (typeof c.teacherId === "object" ? c.teacherId?.name : "") ||
                  "Chưa có GV";
                return (
                  <option key={c._id} value={c._id}>
                    📚 {c.name} - GV: {teacherName}
                  </option>
                );
              })}
            </select>
            {errors.classId && (
              <p className="text-red-500 text-xs mt-1">{errors.classId}</p>
            )}
            {formData.subject &&
              filteredClasses.length === 0 &&
              !isLoadingData && (
                <p className="text-amber-600 text-xs mt-1">
                  ⚠️ Không có lớp nào dạy môn {formData.subject} tại cơ sở này.
                </p>
              )}
          </div>

          {selectedClass && (
            <div className="p-3 rounded-xl border border-gray-100 bg-gray-50">
              <div className="text-sm font-medium text-gray-700">
                Giáo viên phụ trách
              </div>
              <p className="text-sm text-gray-600 mt-1">
                {selectedClass.teacher?.name ||
                  (typeof selectedClass.teacherId === "object"
                    ? selectedClass.teacherId?.name
                    : "Chưa phân công") ||
                  "Chưa phân công"}
              </p>
              {!formData.teacherId && (
                <p className="text-xs text-amber-600 mt-1">
                  ⚠️ Lớp này chưa có giáo viên, vui lòng phân công trong phần
                  quản lý lớp trước khi tạo buổi học.
                </p>
              )}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tiêu đề buổi học <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="VD: Bài 5 - Phương trình bậc 2"
              className={`rounded-xl ${errors.title ? "border-red-300" : ""}`}
            />
            {errors.title && (
              <p className="text-red-500 text-xs mt-1">{errors.title}</p>
            )}
          </div>

          {/* Room */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phòng học
            </label>
            <Input
              type="text"
              name="room"
              value={formData.room}
              onChange={handleChange}
              placeholder="VD: Phòng 101, Tầng 1"
              className="rounded-xl"
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ngày <span className="text-red-500">*</span>
            </label>
            <Input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              className={`rounded-xl ${errors.date ? "border-red-300" : ""}`}
            />
            {errors.date && (
              <p className="text-red-500 text-xs mt-1">{errors.date}</p>
            )}
          </div>

          {/* Time Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Giờ bắt đầu <span className="text-red-500">*</span>
              </label>
              <Input
                type="time"
                name="startTime"
                value={formData.startTime}
                onChange={handleChange}
                className={`rounded-xl ${
                  errors.startTime ? "border-red-300" : ""
                }`}
              />
              {errors.startTime && (
                <p className="text-red-500 text-xs mt-1">{errors.startTime}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Giờ kết thúc <span className="text-red-500">*</span>
              </label>
              <Input
                type="time"
                name="endTime"
                value={formData.endTime}
                onChange={handleChange}
                className={`rounded-xl ${
                  errors.endTime ? "border-red-300" : ""
                }`}
              />
              {errors.endTime && (
                <p className="text-red-500 text-xs mt-1">{errors.endTime}</p>
              )}
            </div>
          </div>

          {/* Session Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Loại buổi học
            </label>
            <select
              name="type"
              value={formData.type}
              onChange={handleChange}
              className="nice-select w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={SessionType.Makeup}>🔄 Học bù</option>
              <option value={SessionType.Exam}>📝 Kiểm tra</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Chỉ tạo buổi học bất thường tại đây. Buổi học thường được tự động
              tạo từ lịch học của lớp.
            </p>
          </div>

          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ghi chú
            </label>
            <textarea
              name="note"
              value={formData.note}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="Thêm ghi chú cho buổi học..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-lg shadow-blue-200"
            >
              {isLoading ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Đang xử lý...
                </>
              ) : session ? (
                "💾 Lưu thay đổi"
              ) : (
                "➕ Tạo buổi học bất thường"
              )}
            </Button>
            {session && session.type !== "regular" && (
              <Button
                type="button"
                variant="outline"
                disabled={isLoading}
                onClick={async () => {
                  if (confirm("Bạn có chắc muốn xóa buổi học này?")) {
                    try {
                      await deleteSession(session._id);
                      onClose();
                    } catch (error) {
                      console.error("Error deleting session:", error);
                    }
                  }
                }}
                className="rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                🗑️ Xóa
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-xl"
            >
              Hủy
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
