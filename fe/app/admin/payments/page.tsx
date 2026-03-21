"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/stores/auth-store";
import { usePaymentRequestsStore } from "@/lib/stores/payment-requests-store";
import { usePaymentsStore } from "@/lib/stores/payments-store";
import { useBranchesStore } from "@/lib/stores/branches-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Loader2,
  Plus,
  CheckCircle,
  RefreshCw,
  Eye,
  Trash2,
  Search,
  X,
} from "lucide-react";
import api from "@/lib/api";
import { notify } from "@/lib/notify";

interface ClassInfo {
  _id: string;
  name: string;
  subject?: string;
  grade?: string;
  fee: number;
  studentIds: string[];
  branchId?: string | { _id: string; name: string };
}

interface StudentInfo {
  _id: string;
  name?: string;
  email?: string;
  studentCode?: string;
  branchId?: string;
}

interface PaymentWithStudent {
  _id: string;
  studentId?: StudentInfo;
  amount: number;
  method: string;
  status: string;
  createdAt: string;
  branchName?: string;
  subjectName?: string;
}

interface StudentPaymentStatus {
  _id: string;
  studentName: string;
  studentCode?: string;
  finalAmount: number;
  scholarshipPercent: number;
  status: string;
}

interface StudentsData {
  total: number;
  paid: number;
  pending: number;
  students: StudentPaymentStatus[];
}

export default function AdminPaymentRequestsPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuthStore();
  const {
    classRequests,
    fetchClassRequests,
    createClassPaymentRequest,
    cancelClassRequest,
    getClassRequestStudents,
    approveClassRequestException,
    rejectClassRequestException,
    isLoading: requestsLoading,
  } = usePaymentRequestsStore();
  const {
    pendingCashPayments,
    allPayments,
    fetchPendingCashPayments,
    fetchAllPayments,
    confirmCashPayment,
  } = usePaymentsStore();
  const { branches, fetchBranches } = useBranchesStore();

  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // === Form state voi multi-select ===
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isCreatingMultiple, setIsCreatingMultiple] = useState(false);

  // === Filter state ===
  const [filterBranch, setFilterBranch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [viewingRequest, setViewingRequest] = useState<string | null>(null);
  const [studentsData, setStudentsData] = useState<StudentsData | null>(null);
  const [activeTab, setActiveTab] = useState<"requests" | "cash" | "history">(
    "requests",
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!user) {
        router.push("/");
        return;
      }

      if (user.role !== "admin") {
        router.push("/");
        return;
      }

      fetchClassRequests();
      fetchPendingCashPayments();
      fetchClasses();
      fetchAllPayments();
      fetchBranches();
    }, 100);

    return () => clearTimeout(timer);
  }, [user, router]);

  const fetchClasses = async () => {
    try {
      const response = await api.get("/classes");
      setClasses(response.data);
    } catch (error) {
      console.error("Error fetching classes:", error);
    }
  };

  // === Computed values cho cascade filters ===
  const getBranchId = (cls: ClassInfo): string => {
    if (!cls.branchId) return "";
    if (typeof cls.branchId === "string") return cls.branchId;
    return cls.branchId._id;
  };

  // Lay danh sach cac khoi tu classes da loc theo co so
  const availableGrades = useMemo(() => {
    let filtered = classes;
    if (selectedBranches.length > 0) {
      filtered = classes.filter((c) =>
        selectedBranches.includes(getBranchId(c)),
      );
    }
    const grades = [...new Set(filtered.map((c) => c.grade).filter(Boolean))];
    return grades.sort();
  }, [classes, selectedBranches]);

  // Lay danh sach cac mon tu classes da loc theo co so + khoi
  const availableSubjects = useMemo(() => {
    let filtered = classes;
    if (selectedBranches.length > 0) {
      filtered = filtered.filter((c) =>
        selectedBranches.includes(getBranchId(c)),
      );
    }
    if (selectedGrades.length > 0) {
      filtered = filtered.filter(
        (c) => c.grade && selectedGrades.includes(c.grade),
      );
    }
    const subjects = [
      ...new Set(filtered.map((c) => c.subject).filter(Boolean)),
    ];
    return subjects.sort();
  }, [classes, selectedBranches, selectedGrades]);

  // Lay danh sach cac lop da loc
  const filteredClasses = useMemo(() => {
    let filtered = classes;
    if (selectedBranches.length > 0) {
      filtered = filtered.filter((c) =>
        selectedBranches.includes(getBranchId(c)),
      );
    }
    if (selectedGrades.length > 0) {
      filtered = filtered.filter(
        (c) => c.grade && selectedGrades.includes(c.grade),
      );
    }
    if (selectedSubjects.length > 0) {
      filtered = filtered.filter(
        (c) => c.subject && selectedSubjects.includes(c.subject),
      );
    }
    return filtered;
  }, [classes, selectedBranches, selectedGrades, selectedSubjects]);

  // Tinh tong so hoc sinh tu cac lop da chon
  const totalStudentsInSelectedClasses = useMemo(() => {
    const classesToUse =
      selectedClasses.length > 0
        ? classes.filter((c) => selectedClasses.includes(c._id))
        : filteredClasses;
    return classesToUse.reduce(
      (sum, c) => sum + (c.studentIds?.length || 0),
      0,
    );
  }, [classes, selectedClasses, filteredClasses]);

  // === Filter data cho cac tab ===
  const filteredClassRequests = useMemo(() => {
    let result = classRequests;
    if (filterBranch) {
      result = result.filter(
        (r) =>
          r.className?.toLowerCase().includes(filterBranch.toLowerCase()) ||
          r.classSubject?.toLowerCase().includes(filterBranch.toLowerCase()),
      );
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.title.toLowerCase().includes(query) ||
          r.className?.toLowerCase().includes(query) ||
          r.classSubject?.toLowerCase().includes(query),
      );
    }
    return result;
  }, [classRequests, filterBranch, searchQuery]);

  const filteredPendingPayments = useMemo(() => {
    let result = pendingCashPayments as PaymentWithStudent[];
    if (filterBranch) {
      result = result.filter(
        (p) =>
          p.studentId?.branchId === filterBranch ||
          p.branchName?.toLowerCase().includes(filterBranch.toLowerCase()),
      );
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.studentId?.name?.toLowerCase().includes(query) ||
          p.studentId?.studentCode?.toLowerCase().includes(query) ||
          p.studentId?.email?.toLowerCase().includes(query),
      );
    }
    return result;
  }, [pendingCashPayments, filterBranch, searchQuery]);

  const filteredAllPayments = useMemo(() => {
    let result = allPayments as PaymentWithStudent[];
    if (filterBranch) {
      result = result.filter(
        (p) =>
          p.branchName?.toLowerCase().includes(filterBranch.toLowerCase()) ||
          p.studentId?.branchId === filterBranch,
      );
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.studentId?.name?.toLowerCase().includes(query) ||
          p.studentId?.studentCode?.toLowerCase().includes(query) ||
          p.studentId?.email?.toLowerCase().includes(query) ||
          p._id.toLowerCase().includes(query),
      );
    }
    return result;
  }, [allPayments, filterBranch, searchQuery]);

  const handleCreateRequest = async () => {
    if (!title) {
      const msg = "Vui long nhap tieu de";
      setError(msg);
      notify.warning(msg);
      return;
    }

    const classesToProcess =
      selectedClasses.length > 0
        ? classes.filter((c) => selectedClasses.includes(c._id))
        : filteredClasses;

    if (classesToProcess.length === 0) {
      const msg = "Vui long chon it nhat mot lop";
      setError(msg);
      notify.warning(msg);
      return;
    }

    try {
      setError(null);
      setIsCreatingMultiple(true);

      let totalStudents = 0;
      let successCount = 0;

      for (const cls of classesToProcess) {
        try {
          const result = await createClassPaymentRequest({
            classId: cls._id,
            title,
            description: description || undefined,
            amount: amount ? Number(amount) : cls.fee || undefined,
            dueDate: dueDate || undefined,
          });
          totalStudents += result.studentCount;
          successCount++;
        } catch (err) {
          console.error(`Error creating request for class ${cls.name}:`, err);
        }
      }

      notify.success(
        `Da tao ${successCount} yeu cau dong tien cho ${totalStudents} hoc sinh!`,
      );
      setShowCreateForm(false);
      resetForm();
      fetchClassRequests();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Có lỗi xảy ra";
      setError(errorMessage);
      notify.error(errorMessage);
    } finally {
      setIsCreatingMultiple(false);
    }
  };

  const resetForm = () => {
    setSelectedBranches([]);
    setSelectedGrades([]);
    setSelectedSubjects([]);
    setSelectedClasses([]);
    setTitle("");
    setDescription("");
    setAmount("");
    setDueDate("");
  };

  const handleViewStudents = async (requestId: string) => {
    try {
      const data = await getClassRequestStudents(requestId);
      setStudentsData(data);
      setViewingRequest(requestId);
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Có lỗi xảy ra");
    }
  };

  const handleCancelRequest = async (id: string) => {
    if (!confirm("Ban co chac muon huy yeu cau nay?")) {
      return;
    }

    try {
      await cancelClassRequest(id);
      notify.success("Da huy yeu cau thanh cong");
      fetchClassRequests();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Có lỗi xảy ra");
    }
  };

  const handleConfirmCash = async (paymentId: string) => {
    if (!confirm("Xac nhan da thu tien?")) return;

    try {
      await confirmCashPayment(paymentId);
      notify.success("Da xac nhan thanh cong!");
      fetchPendingCashPayments();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Có lỗi xảy ra");
    }
  };

  const handleApproveException = async (id: string) => {
    if (!confirm("Duyệt ngoại lệ học bổng cho yêu cầu này?")) {
      return;
    }

    try {
      await approveClassRequestException(id);
      notify.success("Đã duyệt ngoại lệ thành công");
      fetchClassRequests();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Có lỗi xảy ra");
    }
  };

  const handleRejectException = async (id: string) => {
    const reason =
      prompt("Nhập lý do từ chối ngoại lệ (tuỳ chọn):") || undefined;
    if (!confirm("Từ chối ngoại lệ và hủy yêu cầu này?")) {
      return;
    }

    try {
      await rejectClassRequestException(id, reason);
      notify.success("Đã từ chối ngoại lệ và hủy yêu cầu");
      fetchClassRequests();
    } catch (err) {
      notify.error(err instanceof Error ? err.message : "Có lỗi xảy ra");
    }
  };

  // Toggle select helpers
  const toggleBranch = (branchId: string) => {
    setSelectedBranches((prev) =>
      prev.includes(branchId)
        ? prev.filter((id) => id !== branchId)
        : [...prev, branchId],
    );
    setSelectedGrades([]);
    setSelectedSubjects([]);
    setSelectedClasses([]);
  };

  const toggleGrade = (grade: string) => {
    setSelectedGrades((prev) =>
      prev.includes(grade) ? prev.filter((g) => g !== grade) : [...prev, grade],
    );
    setSelectedSubjects([]);
    setSelectedClasses([]);
  };

  const toggleSubject = (subject: string) => {
    setSelectedSubjects((prev) =>
      prev.includes(subject)
        ? prev.filter((s) => s !== subject)
        : [...prev, subject],
    );
    setSelectedClasses([]);
  };

  const toggleClass = (classId: string) => {
    setSelectedClasses((prev) =>
      prev.includes(classId)
        ? prev.filter((id) => id !== classId)
        : [...prev, classId],
    );
  };

  const selectAllBranches = () => {
    setSelectedBranches(branches.map((b) => b._id));
  };

  const selectAllGrades = () => {
    setSelectedGrades(availableGrades as string[]);
  };

  const selectAllSubjects = () => {
    setSelectedSubjects(availableSubjects as string[]);
  };

  const selectAllClasses = () => {
    setSelectedClasses(filteredClasses.map((c) => c._id));
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => router.back()}>
              <ArrowLeft className="w-5 h-5 mr-2" />
              Quay lại
            </Button>
            <h1 className="text-xl font-bold text-gray-900">
              💳 Quản lý yêu cầu đóng tiền
            </h1>
          </div>
          <Button
            onClick={() => setShowCreateForm(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Tạo yêu cầu mới
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Tabs */}
        <div className="flex border-b">
          <button
            className={`px-4 py-2 font-medium ${
              activeTab === "requests"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500"
            }`}
            onClick={() => setActiveTab("requests")}
          >
            📋 Yêu cầu đóng tiền
          </button>
          <button
            className={`px-4 py-2 font-medium flex items-center gap-2 ${
              activeTab === "cash"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500"
            }`}
            onClick={() => setActiveTab("cash")}
          >
            💵 Chờ xác nhận
            {pendingCashPayments.length > 0 && (
              <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                {pendingCashPayments.length}
              </span>
            )}
          </button>
          <button
            className={`px-4 py-2 font-medium flex items-center gap-2 ${
              activeTab === "history"
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500"
            }`}
            onClick={() => setActiveTab("history")}
          >
            📜 Lịch sử giao dịch
          </button>
        </div>

        {/* Filter Bar */}
        <Card className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">
                Cơ sở:
              </label>
              <select
                value={filterBranch}
                onChange={(e) => setFilterBranch(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
              >
                <option value="">Tất cả cơ sở</option>
                {branches.map((branch) => (
                  <option key={branch._id} value={branch.name}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Tìm kiếm theo tên, mã học sinh, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </div>
          </div>
        </Card>

        {/* Tab: Requests */}
        {activeTab === "requests" && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="p-4 bg-linear-to-br from-blue-500 to-indigo-600 text-white">
                <p className="text-sm opacity-90">Tổng yêu cầu</p>
                <p className="text-2xl font-bold">
                  {filteredClassRequests.length}
                </p>
              </Card>
              <Card className="p-4 bg-linear-to-br from-green-500 to-emerald-600 text-white">
                <p className="text-sm opacity-90">Đã thu</p>
                <p className="text-2xl font-bold">
                  {filteredClassRequests
                    .reduce((sum, r) => sum + r.totalCollected, 0)
                    .toLocaleString("vi-VN")}{" "}
                  đ
                </p>
              </Card>
              <Card className="p-4 bg-linear-to-br from-yellow-500 to-orange-500 text-white">
                <p className="text-sm opacity-90">Chờ thanh toán</p>
                <p className="text-2xl font-bold">
                  {filteredClassRequests.reduce(
                    (sum, r) => sum + r.totalStudents - r.paidCount,
                    0,
                  )}
                </p>
              </Card>
              <Card className="p-4 bg-linear-to-br from-purple-500 to-pink-600 text-white">
                <p className="text-sm opacity-90">Lớp học</p>
                <p className="text-2xl font-bold">{classes.length}</p>
              </Card>
            </div>

            {/* Requests List */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-800">
                  Danh sách yêu cầu đóng tiền
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchClassRequests()}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Làm mới
                </Button>
              </div>

              {requestsLoading ? (
                <div className="text-center py-12">
                  <Loader2 className="w-8 h-8 mx-auto animate-spin text-blue-600" />
                </div>
              ) : filteredClassRequests.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p>Chưa có yêu cầu đóng tiền nào</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredClassRequests.map((req) => (
                    <div
                      key={req._id}
                      className="p-4 border rounded-xl bg-white"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900">
                            {req.title}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {req.className}
                            {req.classSubject && ` - ${req.classSubject}`}
                          </p>
                          {req.dueDate && (
                            <p className="text-xs text-gray-400 mt-1">
                              Han:{" "}
                              {new Date(req.dueDate).toLocaleDateString(
                                "vi-VN",
                              )}
                            </p>
                          )}
                        </div>

                        <div className="text-right">
                          <p className="font-semibold text-gray-900">
                            {req.amount.toLocaleString("vi-VN")} đ
                          </p>

                          <p className="text-xs mt-1">
                            {req.status === "pending_exception" ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                Chờ duyệt ngoại lệ
                              </span>
                            ) : req.status === "active" ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                                Đang hoạt động
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                                Đã hủy
                              </span>
                            )}
                          </p>

                          {/* Progress */}
                          <div className="flex items-center gap-2 mt-2">
                            <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-green-500"
                                style={{
                                  width: `${
                                    req.totalStudents > 0
                                      ? (req.paidCount / req.totalStudents) *
                                        100
                                      : 0
                                  }%`,
                                }}
                              />
                            </div>
                            <span className="text-sm text-gray-500">
                              {req.paidCount}/{req.totalStudents}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 mt-4 pt-4 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewStudents(req._id)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Chi tiết
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:bg-red-50"
                          onClick={() => handleCancelRequest(req._id)}
                          disabled={req.status !== "active"}
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Hủy
                        </Button>

                        {req.status === "pending_exception" && (
                          <>
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => handleApproveException(req._id)}
                            >
                              Duyệt ngoại lệ
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-700 border-red-300 hover:bg-red-50"
                              onClick={() => handleRejectException(req._id)}
                            >
                              Từ chối ngoại lệ
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}

        {/* Tab: Cash Pending */}
        {activeTab === "cash" && (
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">
                Thanh toán tiền mặt chờ xác nhận
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchPendingCashPayments()}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Làm mới
              </Button>
            </div>

            {filteredPendingPayments.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
                <p>Không có thanh toán chờ xác nhận</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredPendingPayments.map((payment) => (
                  <div
                    key={payment._id}
                    className="flex items-center justify-between p-4 border rounded-xl"
                  >
                    <div>
                      <p className="font-medium">
                        {payment.studentId?.name || "Học sinh"}
                      </p>
                      <p className="text-sm text-gray-500">
                        MSHS: {payment.studentId?.studentCode || "N/A"}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(payment.createdAt).toLocaleString("vi-VN")}
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      <p className="text-xl font-bold">
                        {payment.amount.toLocaleString("vi-VN")} đ
                      </p>
                      <Button
                        onClick={() => handleConfirmCash(payment._id)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Xác nhận
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Tab: History */}
        {activeTab === "history" && (
          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-700 uppercase">
                  <tr>
                    <th className="px-4 py-3">Mã GD</th>
                    <th className="px-4 py-3">MSHS</th>
                    <th className="px-4 py-3">Học sinh</th>
                    <th className="px-4 py-3">Cơ sở</th>
                    <th className="px-4 py-3">Môn học</th>
                    <th className="px-4 py-3">Học phí</th>
                    <th className="px-4 py-3">Phương thức</th>
                    <th className="px-4 py-3">Trạng thái</th>
                    <th className="px-4 py-3">Thời gian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredAllPayments.map((p) => (
                    <tr key={p._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs">
                        {p._id.slice(-8).toUpperCase()}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-blue-600 font-medium">
                        {p.studentId?.studentCode || "-"}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">
                          {p.studentId?.name || "N/A"}
                        </p>
                        <p className="text-xs text-gray-500">
                          {p.studentId?.email}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {p.branchName || "-"}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {p.subjectName || "-"}
                      </td>
                      <td className="px-4 py-3 font-bold">
                        {p.amount.toLocaleString("vi-VN")} đ
                      </td>
                      <td className="px-4 py-3">
                        {p.method === "vnpay_test"
                          ? "VNPay"
                          : p.method === "cash"
                            ? "Tiền mặt"
                            : p.method}
                      </td>
                      <td className="px-4 py-3">
                        {p.status === "success" ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            Thành công
                          </span>
                        ) : p.status === "pending" ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                            Đang xử lý
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                            {p.status}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(p.createdAt).toLocaleString("vi-VN")}
                      </td>
                    </tr>
                  ))}
                  {filteredAllPayments.length === 0 && (
                    <tr>
                      <td
                        colSpan={9}
                        className="text-center py-8 text-gray-400"
                      >
                        Chưa có giao dịch nào
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </main>

      {/* Create Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-xl font-bold mb-4">➕ Tạo yêu cầu đóng tiền</h2>

            {error && (
              <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg mb-4">
                {error}
              </div>
            )}

            <div className="space-y-4">
              {/* Branch Select */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Chọn cơ sở
                  </label>
                  <button
                    type="button"
                    onClick={selectAllBranches}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Chọn tất cả
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-gray-50 max-h-32 overflow-y-auto">
                  {branches.map((branch) => (
                    <button
                      key={branch._id}
                      type="button"
                      onClick={() => toggleBranch(branch._id)}
                      className={`px-3 py-1 rounded-full text-sm transition-colors ${
                        selectedBranches.includes(branch._id)
                          ? "bg-blue-600 text-white"
                          : "bg-white border border-gray-300 text-gray-700 hover:border-blue-400"
                      }`}
                    >
                      {branch.name}
                    </button>
                  ))}
                </div>
                {selectedBranches.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Đã chọn {selectedBranches.length} cơ sở
                  </p>
                )}
              </div>

              {/* Grade Select */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Chọn khối
                  </label>
                  {availableGrades.length > 0 && (
                    <button
                      type="button"
                      onClick={selectAllGrades}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Chọn tất cả
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-gray-50 max-h-32 overflow-y-auto">
                  {availableGrades.length === 0 ? (
                    <p className="text-sm text-gray-400">
                      Chọn cơ sở trước để xem danh sách khối
                    </p>
                  ) : (
                    availableGrades.map((grade) => (
                      <button
                        key={grade}
                        type="button"
                        onClick={() => toggleGrade(grade as string)}
                        className={`px-3 py-1 rounded-full text-sm transition-colors ${
                          selectedGrades.includes(grade as string)
                            ? "bg-green-600 text-white"
                            : "bg-white border border-gray-300 text-gray-700 hover:border-green-400"
                        }`}
                      >
                        {grade}
                      </button>
                    ))
                  )}
                </div>
                {selectedGrades.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Đã chọn {selectedGrades.length} khối
                  </p>
                )}
              </div>

              {/* Subject Select */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Chọn môn
                  </label>
                  {availableSubjects.length > 0 && (
                    <button
                      type="button"
                      onClick={selectAllSubjects}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Chọn tất cả
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-gray-50 max-h-32 overflow-y-auto">
                  {availableSubjects.length === 0 ? (
                    <p className="text-sm text-gray-400">
                      Chọn cơ sở/khối trước để xem danh sách môn
                    </p>
                  ) : (
                    availableSubjects.map((subject) => (
                      <button
                        key={subject}
                        type="button"
                        onClick={() => toggleSubject(subject as string)}
                        className={`px-3 py-1 rounded-full text-sm transition-colors ${
                          selectedSubjects.includes(subject as string)
                            ? "bg-purple-600 text-white"
                            : "bg-white border border-gray-300 text-gray-700 hover:border-purple-400"
                        }`}
                      >
                        {subject}
                      </button>
                    ))
                  )}
                </div>
                {selectedSubjects.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Đã chọn {selectedSubjects.length} môn
                  </p>
                )}
              </div>

              {/* Class Select */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-gray-700">
                    Chọn lớp (khóa học) <span className="text-red-500">*</span>
                  </label>
                  {filteredClasses.length > 0 && (
                    <button
                      type="button"
                      onClick={selectAllClasses}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Chọn tất cả ({filteredClasses.length} lớp)
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 p-3 border rounded-lg bg-gray-50 max-h-48 overflow-y-auto">
                  {filteredClasses.length === 0 ? (
                    <p className="text-sm text-gray-400">
                      Không có lớp nào phù hợp với bộ lọc
                    </p>
                  ) : (
                    filteredClasses.map((cls) => (
                      <button
                        key={cls._id}
                        type="button"
                        onClick={() => toggleClass(cls._id)}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-colors text-left ${
                          selectedClasses.includes(cls._id)
                            ? "bg-indigo-600 text-white"
                            : "bg-white border border-gray-300 text-gray-700 hover:border-indigo-400"
                        }`}
                      >
                        <span className="font-medium">{cls.name}</span>
                        <span className="text-xs opacity-75 ml-1">
                          ({cls.studentIds?.length || 0} HS)
                        </span>
                      </button>
                    ))
                  )}
                </div>
                {selectedClasses.length > 0 ? (
                  <p className="text-xs text-gray-500 mt-1">
                    Đã chọn {selectedClasses.length} lớp
                  </p>
                ) : (
                  filteredClasses.length > 0 && (
                    <p className="text-xs text-amber-600 mt-1">
                      ⚠️ Nếu không chọn lớp cụ thể, sẽ tạo yêu cầu cho tất cả{" "}
                      {filteredClasses.length} lớp phù hợp
                    </p>
                  )
                )}
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tiêu đề <span className="text-red-500">*</span>
                </label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="VD: Học phí tháng 1/2026"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mô tả
                </label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="VD: Thanh toán trước ngày 15"
                />
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Số tiền (VNĐ) - để trống sẽ dùng học phí của từng lớp
                </label>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) =>
                    setAmount(e.target.value ? Number(e.target.value) : "")
                  }
                  placeholder="Nhập số tiền hoặc để trống"
                />
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hạn thanh toán
                </label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>

              {/* Preview */}
              <div className="bg-blue-50 rounded-lg p-4 text-sm">
                <p className="font-medium text-blue-900 mb-2">📊 Tóm tắt:</p>
                <p>
                  • Cơ sở:{" "}
                  {selectedBranches.length === 0
                    ? "Tất cả"
                    : `${selectedBranches.length} cơ sở`}
                </p>
                <p>
                  • Khối:{" "}
                  {selectedGrades.length === 0
                    ? "Tất cả"
                    : selectedGrades.join(", ")}
                </p>
                <p>
                  • Môn:{" "}
                  {selectedSubjects.length === 0
                    ? "Tất cả"
                    : selectedSubjects.join(", ")}
                </p>
                <p>
                  • Số lớp:{" "}
                  <strong>
                    {selectedClasses.length > 0
                      ? selectedClasses.length
                      : filteredClasses.length}
                  </strong>
                </p>
                <p>
                  • Tổng số học sinh:{" "}
                  <strong>{totalStudentsInSelectedClasses}</strong>
                </p>
                <p className="text-xs text-blue-700 mt-2">
                  💡 Học bổng sẽ được tự động áp dụng cho từng học sinh
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowCreateForm(false);
                  resetForm();
                }}
              >
                Hủy
              </Button>
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                onClick={handleCreateRequest}
                disabled={requestsLoading || isCreatingMultiple}
              >
                {requestsLoading || isCreatingMultiple ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Đang tạo...
                  </>
                ) : (
                  "Tạo yêu cầu"
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* View Students Modal */}
      {viewingRequest && studentsData && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6">
            <h2 className="text-xl font-bold mb-4">
              📊 Chi tiết trạng thái đóng tiền
            </h2>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-gray-100 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold">{studentsData.total}</p>
                <p className="text-sm text-gray-500">Tổng</p>
              </div>
              <div className="bg-green-100 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-green-700">
                  {studentsData.paid}
                </p>
                <p className="text-sm text-green-600">Đã đóng</p>
              </div>
              <div className="bg-yellow-100 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-yellow-700">
                  {studentsData.pending}
                </p>
                <p className="text-sm text-yellow-600">Chờ đóng</p>
              </div>
            </div>

            {/* Students Table */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left">MSHS</th>
                    <th className="px-4 py-2 text-left">Học sinh</th>
                    <th className="px-4 py-2 text-right">Số tiền</th>
                    <th className="px-4 py-2 text-center">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {studentsData.students.map((s) => (
                    <tr key={s._id} className="border-t">
                      <td className="px-4 py-2 font-mono text-xs text-blue-600">
                        {s.studentCode || "-"}
                      </td>
                      <td className="px-4 py-2">
                        <p className="font-medium">{s.studentName}</p>
                      </td>
                      <td className="px-4 py-2 text-right">
                        {s.finalAmount.toLocaleString("vi-VN")} đ
                        {s.scholarshipPercent > 0 && (
                          <span className="text-xs text-green-600 block">
                            -{s.scholarshipPercent}%
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {s.status === "paid" ? (
                          <span className="text-green-600">✓ Đã đóng</span>
                        ) : (
                          <span className="text-yellow-600">⏳ Chờ</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Button
              className="w-full mt-4"
              onClick={() => {
                setViewingRequest(null);
                setStudentsData(null);
              }}
            >
              Đóng
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}
