"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Star,
  User,
  BookOpen,
  CheckCircle,
  Clock,
  AlertCircle,
} from "lucide-react";
import { toast } from "react-toastify";
import {
  feedbackService,
  PendingEvaluation,
  EvaluationCriteria,
  CRITERIA_LABELS,
} from "@/lib/services/feedback.service";

interface ActivePeriod {
  _id: string;
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
  branchName: string;
}

export default function StudentEvaluationTab({ userId }: { userId?: string }) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _userId = userId;
  const [pendingEvaluations, setPendingEvaluations] = useState<
    PendingEvaluation[]
  >([]);
  const [activePeriods, setActivePeriods] = useState<ActivePeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] =
    useState<PendingEvaluation | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [criteria, setCriteria] = useState<EvaluationCriteria>({
    teachingQuality: 0,
    communication: 0,
    punctuality: 0,
    materialPreparation: 0,
    studentInteraction: 0,
  });
  const [comment, setComment] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await feedbackService.getPendingEvaluations();
      setPendingEvaluations(data.pendingEvaluations);
      setActivePeriods(data.activePeriods);
    } catch (error) {
      console.error("Error loading evaluations:", error);
      toast.error("Không thể tải danh sách đánh giá");
    } finally {
      setLoading(false);
    }
  };

  const openEvaluationModal = (teacher: PendingEvaluation) => {
    setSelectedTeacher(teacher);
    setCriteria({
      teachingQuality: 0,
      communication: 0,
      punctuality: 0,
      materialPreparation: 0,
      studentInteraction: 0,
    });
    setComment("");
    setIsModalOpen(true);
  };

  const calculateAverageRating = (): number => {
    const values = Object.values(criteria);
    const sum = values.reduce((acc, val) => acc + val, 0);
    return values.length > 0 ? Math.round((sum / values.length) * 10) / 10 : 0;
  };

  const isFormValid = (): boolean => {
    return Object.values(criteria).every((val) => val > 0);
  };

  const handleSubmit = async () => {
    if (!selectedTeacher || !isFormValid()) {
      toast.error("Vui lòng đánh giá tất cả các tiêu chí");
      return;
    }

    setSubmitting(true);
    try {
      await feedbackService.createFeedback({
        teacherId: selectedTeacher.teacher._id,
        classId: selectedTeacher.classId,
        evaluationPeriodId: selectedTeacher.periodId,
        rating: calculateAverageRating(),
        criteria,
        comment: comment.trim() || undefined,
        anonymous: true,
        status: "submitted",
      });

      toast.success("Đánh giá đã được gửi thành công!");
      setIsModalOpen(false);
      loadData(); // Refresh list
    } catch (error: unknown) {
      console.error("Error submitting feedback:", error);
      const errorMessage =
        error instanceof Error && "response" in error
          ? (error as { response?: { data?: { message?: string } } }).response
              ?.data?.message
          : "Không thể gửi đánh giá";
      toast.error(errorMessage || "Không thể gửi đánh giá");
    } finally {
      setSubmitting(false);
    }
  };

  const StarRating = ({
    value,
    onChange,
  }: {
    value: number;
    onChange: (val: number) => void;
  }) => {
    const [hovered, setHovered] = useState(0);

    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className="focus:outline-none transition-transform hover:scale-110"
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => onChange(star)}
          >
            <Star
              className={`w-7 h-7 ${
                star <= (hovered || value)
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-gray-300"
              }`}
            />
          </button>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active Period Banner */}
      {activePeriods.length > 0 && (
        <Card className="bg-linear-to-r from-blue-500 to-blue-600 text-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="w-6 h-6" />
              <div>
                <h3 className="font-semibold">{activePeriods[0].name}</h3>
                <p className="text-sm text-blue-100">
                  Hạn đánh giá:{" "}
                  {new Date(activePeriods[0].endDate).toLocaleDateString(
                    "vi-VN",
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending Evaluations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-500" />
            Đánh giá giáo viên
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pendingEvaluations.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="text-gray-500">
                Bạn đã hoàn thành tất cả đánh giá!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 mb-4">
                Bạn có{" "}
                <span className="font-semibold text-blue-600">
                  {pendingEvaluations.length}
                </span>{" "}
                giáo viên cần đánh giá
              </p>
              {pendingEvaluations.map((item) => (
                <div
                  key={`${item.classId}-${item.teacher._id}`}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-medium">{item.teacher.name}</h4>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <BookOpen className="w-4 h-4" />
                        <span>{item.className}</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={() => openEvaluationModal(item)}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    Đánh giá
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Evaluation Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-125 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Đánh giá giáo viên</DialogTitle>
            <DialogDescription>
              {selectedTeacher && (
                <span>
                  Đánh giá cho <strong>{selectedTeacher.teacher.name}</strong> -{" "}
                  {selectedTeacher.className}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Privacy Notice */}
            <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg text-sm">
              <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-blue-700">
                Đánh giá của bạn hoàn toàn <strong>ẩn danh</strong>. Giáo viên
                sẽ không biết bạn là ai.
              </p>
            </div>

            {/* Criteria Ratings */}
            <div className="space-y-4">
              {(
                Object.keys(CRITERIA_LABELS) as Array<keyof EvaluationCriteria>
              ).map((key) => (
                <div key={key} className="space-y-2">
                  <Label className="text-sm font-medium">
                    {CRITERIA_LABELS[key]}
                  </Label>
                  <StarRating
                    value={criteria[key]}
                    onChange={(val) =>
                      setCriteria((prev) => ({ ...prev, [key]: val }))
                    }
                  />
                </div>
              ))}
            </div>

            {/* Average Rating Display */}
            {isFormValid() && (
              <div className="p-4 bg-linear-to-r from-yellow-50 to-orange-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    Điểm trung bình:
                  </span>
                  <div className="flex items-center gap-2">
                    <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                    <span className="text-xl font-bold text-yellow-600">
                      {calculateAverageRating()}
                    </span>
                    <span className="text-gray-500">/ 5</span>
                  </div>
                </div>
              </div>
            )}

            {/* Comment */}
            <div className="space-y-2">
              <Label htmlFor="comment">Nhận xét (không bắt buộc)</Label>
              <Textarea
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Chia sẻ cảm nhận của bạn về giáo viên..."
                rows={4}
                maxLength={500}
              />
              <p className="text-xs text-gray-400 text-right">
                {comment.length}/500
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              disabled={submitting}
            >
              Hủy
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!isFormValid() || submitting}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {submitting ? "Đang gửi..." : "Gửi đánh giá"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
