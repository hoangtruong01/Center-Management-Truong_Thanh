"use client";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Star,
  Plus,
  Edit,
  Trash2,
  Calendar,
  Users,
  BarChart3,
  Clock,
  CheckCircle,
  XCircle,
  MessageSquare,
  Building,
  BookOpen,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "react-toastify";
import {
  feedbackService,
  EvaluationPeriod,
  TeacherStatistic,
  ClassStatistic,
  CreateEvaluationPeriodDto,
  CRITERIA_LABELS,
  EvaluationCriteria,
} from "@/lib/services/feedback.service";
import api from "@/lib/api";

interface Branch {
  _id: string;
  name: string;
}

interface ClassOption {
  _id: string;
  name: string;
  branchId?: string;
}

export default function AdminEvaluationManager() {
  // Data states
  const [branches, setBranches] = useState<Branch[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [periods, setPeriods] = useState<EvaluationPeriod[]>([]);
  const [statistics, setStatistics] = useState<TeacherStatistic[]>([]);
  const [classStatistics, setClassStatistics] = useState<ClassStatistic[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("periods");

  // Filter states
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [selectedPeriodFilter, setSelectedPeriodFilter] = useState<string>("");

  // Modal states
  const [isPeriodModalOpen, setIsPeriodModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<EvaluationPeriod | null>(
    null,
  );
  const [selectedClass, setSelectedClass] = useState<ClassStatistic | null>(
    null,
  );
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(
    new Set(),
  );

  // Form state
  const [periodForm, setPeriodForm] = useState<CreateEvaluationPeriodDto>({
    name: "",
    description: "",
    startDate: "",
    endDate: "",
    branchId: "",
    classIds: [],
    teacherIds: [],
    status: "draft",
  });

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  // Load statistics when tab changes or filters change
  const loadStatistics = useCallback(async () => {
    try {
      const [teacherStats, classStats] = await Promise.all([
        feedbackService.getStatistics({
          periodId: selectedPeriodFilter || undefined,
          branchId: selectedBranch || undefined,
        }),
        feedbackService.getStatisticsByClass({
          periodId: selectedPeriodFilter || undefined,
          branchId: selectedBranch || undefined,
        }),
      ]);
      setStatistics(teacherStats);
      setClassStatistics(classStats);
    } catch (error) {
      console.error("Error loading statistics:", error);
    }
  }, [selectedPeriodFilter, selectedBranch]);

  useEffect(() => {
    if (activeTab === "statistics" || activeTab === "classes") {
      loadStatistics();
    }
  }, [activeTab, loadStatistics]);

  // Load periods when branch filter changes
  const loadPeriods = useCallback(async () => {
    try {
      const data = await feedbackService.getEvaluationPeriods(
        selectedBranch || undefined,
      );
      setPeriods(data);
    } catch (error) {
      console.error("Error loading periods:", error);
    }
  }, [selectedBranch]);

  useEffect(() => {
    loadPeriods();
  }, [loadPeriods]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [branchesRes, classesRes, periodsData] = await Promise.all([
        api.get("/branches"),
        api.get("/classes"),
        feedbackService.getEvaluationPeriods(),
      ]);
      setBranches(branchesRes.data);
      setClasses(classesRes.data);
      setPeriods(periodsData);

      // Auto-select first branch if available
      if (branchesRes.data.length > 0) {
        setSelectedBranch(branchesRes.data[0]._id);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Không thể tải dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  // Period modal handlers
  const openCreatePeriodModal = () => {
    setEditingPeriod(null);
    setPeriodForm({
      name: "",
      description: "",
      startDate: new Date().toISOString().split("T")[0],
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0],
      branchId: selectedBranch || "",
      classIds: [],
      teacherIds: [],
      status: "draft",
    });
    setIsPeriodModalOpen(true);
  };

  const openEditPeriodModal = (period: EvaluationPeriod) => {
    setEditingPeriod(period);
    setPeriodForm({
      name: period.name,
      description: period.description || "",
      startDate: period.startDate.split("T")[0],
      endDate: period.endDate.split("T")[0],
      branchId: period.branchId?._id || "",
      classIds: period.classIds.map((c) => c._id),
      teacherIds: period.teacherIds.map((t) => t._id),
      status: period.status,
    });
    setIsPeriodModalOpen(true);
  };

  const handleSavePeriod = async () => {
    if (!periodForm.name || !periodForm.startDate || !periodForm.endDate) {
      toast.error("Vui lòng điền đầy đủ thông tin bắt buộc");
      return;
    }

    try {
      if (editingPeriod) {
        await feedbackService.updateEvaluationPeriod(
          editingPeriod._id,
          periodForm,
        );
        toast.success("Cập nhật đợt đánh giá thành công");
      } else {
        await feedbackService.createEvaluationPeriod(periodForm);
        toast.success("Tạo đợt đánh giá thành công");
      }
      setIsPeriodModalOpen(false);
      loadPeriods();
    } catch (error) {
      console.error("Error saving period:", error);
      toast.error("Không thể lưu đợt đánh giá");
    }
  };

  const handleDeletePeriod = async (id: string) => {
    if (!confirm("Bạn có chắc muốn xóa đợt đánh giá này?")) return;

    try {
      await feedbackService.deleteEvaluationPeriod(id);
      toast.success("Xóa đợt đánh giá thành công");

      // Reset filter if we deleted the currently selected period
      if (selectedPeriodFilter === id) {
        setSelectedPeriodFilter("");
      }

      loadPeriods();
      // Reload statistics to reflect deletion immediately
      if (activeTab === "statistics" || activeTab === "classes") {
        setTimeout(loadStatistics, 500); // Small delay to ensure DB propagation
      }
    } catch (error) {
      console.error("Error deleting period:", error);
      toast.error("Không thể xóa đợt đánh giá");
    }
  };

  const toggleClassExpand = (classId: string) => {
    setExpandedClasses((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(classId)) {
        newSet.delete(classId);
      } else {
        newSet.add(classId);
      }
      return newSet;
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" />
            Đang mở
          </Badge>
        );
      case "closed":
        return (
          <Badge className="bg-gray-100 text-gray-800">
            <XCircle className="w-3 h-3 mr-1" />
            Đã đóng
          </Badge>
        );
      default:
        return (
          <Badge className="bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3 mr-1" />
            Nháp
          </Badge>
        );
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${star <= rating
                ? "fill-yellow-400 text-yellow-400"
                : "text-gray-300"
              }`}
          />
        ))}
        <span className="ml-1 text-sm font-medium">{rating.toFixed(1)}</span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-lg rounded-2xl bg-white">
        <div className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-2xl shadow-lg shadow-blue-200">
              ⭐
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Quản lý đánh giá giáo viên
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Theo dõi chất lượng giảng dạy và tạo đợt đánh giá đồng bộ giữa các cơ sở
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Building className="w-4 h-4 text-gray-500" />
              Cơ sở:
            </span>
            <select
              value={selectedBranch || "all"}
              onChange={(e) =>
                setSelectedBranch(e.target.value === "all" ? "" : e.target.value)
              }
              className="nice-select rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-48"
            >
              <option value="all">Tất cả cơ sở</option>
              {branches.map((branch) => (
                <option key={branch._id} value={branch._id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 rounded-xl bg-gray-100 p-1">
          <TabsTrigger
            value="periods"
            className="flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-gray-600 transition-colors data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm"
          >
            <Calendar className="w-4 h-4" />
            Đợt đánh giá
          </TabsTrigger>
          <TabsTrigger
            value="classes"
            className="flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-gray-600 transition-colors data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm"
          >
            <BookOpen className="w-4 h-4" />
            Theo lớp
          </TabsTrigger>
          <TabsTrigger
            value="statistics"
            className="flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-gray-600 transition-colors data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm"
          >
            <BarChart3 className="w-4 h-4" />
            Theo giáo viên
          </TabsTrigger>
        </TabsList>

        {/* Periods Tab */}
        <TabsContent value="periods" className="space-y-4">
          <Card className="p-6 space-y-5 bg-white border-0 shadow-lg rounded-2xl">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">
                  Danh sách đợt đánh giá
                </p>
                <h3 className="text-xl font-bold text-gray-900">
                  {branches.find((b) => b._id === selectedBranch)?.name ||
                    "Tất cả cơ sở"}
                </h3>
              </div>
              <Button
                onClick={openCreatePeriodModal}
                className="rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-200"
              >
                <Plus className="w-4 h-4 mr-2" />
                Tạo đợt đánh giá
              </Button>
            </div>

            {periods.length === 0 ? (
              <div className="py-12 text-center text-gray-500">
                <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p>Chưa có đợt đánh giá nào</p>
                <Button
                  className="mt-4 rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-200"
                  onClick={openCreatePeriodModal}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Tạo đợt đánh giá đầu tiên
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {periods.map((period) => (
                  <div
                    key={period._id}
                    className="border border-gray-100 rounded-2xl p-4 bg-white shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-3 mb-2">
                          <h4 className="text-lg font-semibold text-gray-900">
                            {period.name}
                          </h4>
                          {getStatusBadge(period.status)}
                        </div>
                        {period.description && (
                          <p className="text-gray-600 text-sm mb-2">
                            {period.description}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Building className="w-4 h-4" />
                            {period.branchId?.name || "Tất cả cơ sở"}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {new Date(period.startDate).toLocaleDateString(
                              "vi-VN",
                            )}{" "}
                            -{" "}
                            {new Date(period.endDate).toLocaleDateString(
                              "vi-VN",
                            )}
                          </span>
                          <span className="flex items-center gap-1">
                            <BookOpen className="w-4 h-4" />
                            {period.classIds.length > 0
                              ? `${period.classIds.length} lớp`
                              : "Tất cả lớp"}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-lg"
                          onClick={() => openEditPeriodModal(period)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-lg text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => handleDeletePeriod(period._id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Classes Tab */}
        <TabsContent value="classes" className="space-y-4">
          <Card className="p-6 space-y-5 bg-white border-0 shadow-lg rounded-2xl">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">
                  Thống kê theo lớp
                </p>
                <h3 className="text-xl font-bold text-gray-900">
                  {branches.find((b) => b._id === selectedBranch)?.name ||
                    "Tất cả cơ sở"}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600">
                  Đợt đánh giá:
                </span>
                <select
                  value={selectedPeriodFilter}
                  onChange={(e) => setSelectedPeriodFilter(e.target.value)}
                  className="nice-select rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-52"
                >
                  <option value="">Tất cả đợt đánh giá</option>
                  {periods.map((period) => (
                    <option key={period._id} value={period._id}>
                      {period.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {classStatistics.length === 0 ? (
              <div className="py-12 text-center text-gray-500">
                <BookOpen className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p>Chưa có dữ liệu đánh giá</p>
              </div>
            ) : (
              <div className="space-y-4">
                {classStatistics.map((cls) => (
                  <div
                    key={cls.classId}
                    className="border border-gray-100 rounded-2xl p-4 bg-white shadow-sm hover:shadow-md transition-shadow"
                  >
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-4"
                      onClick={() => toggleClassExpand(cls.classId)}
                    >
                      <div className="flex-1 text-left">
                        <div className="flex flex-wrap items-center gap-3 mb-2">
                          <h4 className="text-lg font-semibold text-gray-900">
                            {cls.className}
                          </h4>
                          {cls.averageRating > 0 &&
                            renderStars(cls.averageRating)}
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            GV: {cls.teacherName || "Chưa phân công"}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            {cls.totalEvaluated}/{cls.totalStudents} học sinh đã
                            đánh giá ({cls.evaluationRate}%)
                          </span>
                        </div>
                        <div className="mt-3">
                          <Progress
                            value={cls.evaluationRate}
                            className="h-2 rounded-full"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            cls.totalEvaluated > 0
                              ? "bg-blue-50 text-blue-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {cls.feedbacks?.length || 0} đánh giá
                        </Badge>
                        {expandedClasses.has(cls.classId) ? (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                    </button>

                    {expandedClasses.has(cls.classId) &&
                      cls.feedbacks && cls.feedbacks.length > 0 && (
                        <div className="mt-4 pt-4 border-t space-y-3">
                          <h5 className="font-medium text-sm text-gray-700">
                            Chi tiết đánh giá:
                          </h5>
                          {cls.feedbacks.map((fb) => (
                            <div
                              key={fb._id}
                              className="p-3 bg-gray-50 rounded-xl"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-sm">
                                    {fb.studentName || "Ẩn danh"}
                                  </span>
                                  {renderStars(fb.rating)}
                                </div>
                                <span className="text-xs text-gray-500">
                                  {new Date(fb.createdAt).toLocaleDateString(
                                    "vi-VN",
                                  )}
                                </span>
                              </div>
                              {fb.criteria && (
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs mb-2">
                                  {(
                                    Object.entries(fb.criteria) as [
                                      keyof EvaluationCriteria,
                                      number,
                                    ][]
                                  ).map(([key, value]) => (
                                    <div
                                      key={key}
                                      className="flex items-center gap-1"
                                    >
                                      <span className="text-gray-500">
                                        {CRITERIA_LABELS[key]}:
                                      </span>
                                      <span className="font-medium">
                                        {value}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {fb.comment && (
                                <p className="text-sm text-gray-600 italic">
                                  &ldquo;{fb.comment}&rdquo;
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Statistics Tab */}
        <TabsContent value="statistics" className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-gray-900">
              Thống kê theo giáo viên -{" "}
              {branches.find((b) => b._id === selectedBranch)?.name ||
                "Tất cả cơ sở"}
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-600">
                Đợt đánh giá:
              </span>
              <select
                value={selectedPeriodFilter}
                onChange={(e) => setSelectedPeriodFilter(e.target.value)}
                className="nice-select rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-48"
              >
                <option value="">Tất cả đợt đánh giá</option>
                {periods.map((period) => (
                  <option key={period._id} value={period._id}>
                    {period.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {statistics.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">
                <BarChart3 className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p>Chưa có dữ liệu thống kê</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Giáo viên</TableHead>
                      <TableHead className="text-center">Số đánh giá</TableHead>
                      <TableHead className="text-center">
                        Điểm trung bình
                      </TableHead>
                      <TableHead className="text-center">Giảng dạy</TableHead>
                      <TableHead className="text-center">Giao tiếp</TableHead>
                      <TableHead className="text-center">Đúng giờ</TableHead>
                      <TableHead className="text-center">Chuẩn bị</TableHead>
                      <TableHead className="text-center">Tương tác</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {statistics.map((stat) => (
                      <TableRow key={stat.teacherId}>
                        <TableCell>
                          <div>
                            <div className="font-medium">
                              {stat.teacherName}
                            </div>
                            <div className="text-sm text-gray-500">
                              {stat.teacherEmail}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline">{stat.totalFeedbacks}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {renderStars(stat.averageRating)}
                        </TableCell>
                        <TableCell className="text-center">
                          {stat.avgTeachingQuality?.toFixed(1) || "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          {stat.avgCommunication?.toFixed(1) || "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          {stat.avgPunctuality?.toFixed(1) || "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          {stat.avgMaterialPreparation?.toFixed(1) || "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          {stat.avgStudentInteraction?.toFixed(1) || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Create/Edit Period Modal */}
      <Dialog open={isPeriodModalOpen} onOpenChange={setIsPeriodModalOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPeriod
                ? "Chỉnh sửa đợt đánh giá"
                : "Tạo đợt đánh giá mới"}
            </DialogTitle>
            <DialogDescription>
              Thiết lập thông tin cho đợt đánh giá giáo viên
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>
                Tên đợt đánh giá <span className="text-red-500">*</span>
              </Label>
              <Input
                value={periodForm.name}
                onChange={(e) =>
                  setPeriodForm({ ...periodForm, name: e.target.value })
                }
                placeholder="VD: Đánh giá tháng 2/2026"
              />
            </div>

            <div>
              <Label>Mô tả</Label>
              <Textarea
                value={periodForm.description}
                onChange={(e) =>
                  setPeriodForm({ ...periodForm, description: e.target.value })
                }
                placeholder="Mô tả về đợt đánh giá..."
              />
            </div>

            <div>
              <Label>Cơ sở</Label>
              <select
                value={periodForm.branchId || "all"}
                onChange={(e) =>
                  setPeriodForm({
                    ...periodForm,
                    branchId: e.target.value === "all" ? "" : e.target.value,
                    classIds: [],
                  })
                }
                className="nice-select w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tất cả cơ sở</option>
                {branches.map((branch) => (
                  <option key={branch._id} value={branch._id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>
                  Ngày bắt đầu <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="date"
                  value={periodForm.startDate}
                  onChange={(e) =>
                    setPeriodForm({ ...periodForm, startDate: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>
                  Ngày kết thúc <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="date"
                  value={periodForm.endDate}
                  onChange={(e) =>
                    setPeriodForm({ ...periodForm, endDate: e.target.value })
                  }
                />
              </div>
            </div>

            <div>
              <Label>Trạng thái</Label>
              <select
                value={periodForm.status || "draft"}
                onChange={(e) =>
                  setPeriodForm({
                    ...periodForm,
                    status: e.target.value as "draft" | "active" | "closed",
                  })
                }
                className="nice-select w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="draft">Nháp</option>
                <option value="active">Đang mở</option>
                <option value="closed">Đã đóng</option>
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsPeriodModalOpen(false)}
              className="rounded-xl"
            >
              Hủy
            </Button>
            <Button
              onClick={handleSavePeriod}
              className="rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            >
              {editingPeriod ? "Cập nhật" : "Tạo mới"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Class Detail Modal */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Chi tiết đánh giá - {selectedClass?.className}
            </DialogTitle>
            <DialogDescription>
              Giáo viên: {selectedClass?.teacherName || "Chưa phân công"}
            </DialogDescription>
          </DialogHeader>

          {selectedClass && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {selectedClass.totalStudents}
                    </div>
                    <div className="text-sm text-gray-500">Tổng học sinh</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {selectedClass.totalEvaluated}
                    </div>
                    <div className="text-sm text-gray-500">Đã đánh giá</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-yellow-600">
                      {selectedClass.averageRating.toFixed(1)}
                    </div>
                    <div className="text-sm text-gray-500">Điểm TB</div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Các đánh giá ({selectedClass.feedbacks.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedClass.feedbacks.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">
                      Chưa có đánh giá
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {selectedClass.feedbacks.map((fb) => (
                        <div key={fb._id} className="p-3 bg-gray-50 rounded-lg">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <span className="font-medium">
                                {fb.studentName || "Ẩn danh"}
                              </span>
                              <div className="flex items-center gap-1 mt-1">
                                {renderStars(fb.rating)}
                              </div>
                            </div>
                            <span className="text-xs text-gray-500">
                              {new Date(fb.createdAt).toLocaleDateString(
                                "vi-VN",
                              )}
                            </span>
                          </div>
                          {fb.comment && (
                            <p className="text-gray-600 italic text-sm">
                              &ldquo;{fb.comment}&rdquo;
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
