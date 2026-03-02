"use client";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Star,
  MessageSquare,
  TrendingUp,
  Award,
  BookOpen,
  Users,
  Clock,
  FileText,
  Smile,
} from "lucide-react";
import { toast } from "react-toastify";
import {
  feedbackService,
  TeacherRating,
  EvaluationCriteria,
  CRITERIA_LABELS,
} from "@/lib/services/feedback.service";

// Icons for each criteria
const CRITERIA_ICONS: Record<keyof EvaluationCriteria, React.ReactNode> = {
  teachingQuality: <BookOpen className="w-4 h-4" />,
  communication: <MessageSquare className="w-4 h-4" />,
  punctuality: <Clock className="w-4 h-4" />,
  materialPreparation: <FileText className="w-4 h-4" />,
  studentInteraction: <Users className="w-4 h-4" />,
};

export default function TeacherRatingsTab() {
  const [data, setData] = useState<TeacherRating | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const ratings = await feedbackService.getMyRatings();
      setData(ratings);
    } catch (error) {
      console.error("Error loading ratings:", error);
      toast.error("Không thể tải đánh giá");
    } finally {
      setLoading(false);
    }
  };

  const getRatingColor = (rating: number): string => {
    if (rating >= 4.5) return "text-green-600";
    if (rating >= 4) return "text-blue-600";
    if (rating >= 3) return "text-yellow-600";
    return "text-red-600";
  };

  const getRatingBadge = (rating: number): { label: string; color: string } => {
    if (rating >= 4.5)
      return { label: "Xuất sắc", color: "bg-green-100 text-green-700" };
    if (rating >= 4)
      return { label: "Tốt", color: "bg-blue-100 text-blue-700" };
    if (rating >= 3)
      return { label: "Khá", color: "bg-yellow-100 text-yellow-700" };
    if (rating >= 2)
      return { label: "Trung bình", color: "bg-orange-100 text-orange-700" };
    return { label: "Cần cải thiện", color: "bg-red-100 text-red-700" };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!data || data.totalFeedbacks === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <Star className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">
            Chưa có đánh giá
          </h3>
          <p className="text-gray-400">
            Bạn sẽ nhận được đánh giá từ học sinh sau khi kết thúc đợt đánh giá.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { stats, feedbacks, totalFeedbacks } = data;
  const ratingBadge = getRatingBadge(stats.averageRating);

  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <Card className="bg-linear-to-br from-blue-50 to-indigo-50">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            {/* Average Rating */}
            <div className="text-center">
              <div className="relative">
                <div
                  className={`text-6xl font-bold ${getRatingColor(
                    stats.averageRating,
                  )}`}
                >
                  {stats.averageRating.toFixed(1)}
                </div>
                <div className="flex justify-center mt-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-5 h-5 ${
                        star <= Math.round(stats.averageRating)
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-gray-300"
                      }`}
                    />
                  ))}
                </div>
              </div>
              <Badge className={`mt-3 ${ratingBadge.color}`}>
                {ratingBadge.label}
              </Badge>
              <p className="text-sm text-gray-500 mt-2">
                Dựa trên {totalFeedbacks} đánh giá
              </p>
            </div>

            {/* Criteria Breakdown */}
            {stats.averageCriteria && (
              <div className="flex-1 w-full md:w-auto">
                <h4 className="font-medium text-gray-700 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Chi tiết đánh giá
                </h4>
                <div className="space-y-3">
                  {(
                    Object.keys(CRITERIA_LABELS) as Array<
                      keyof EvaluationCriteria
                    >
                  ).map((key) => {
                    const value = stats.averageCriteria![key] || 0;
                    return (
                      <div key={key} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-2 text-gray-600">
                            {CRITERIA_ICONS[key]}
                            {CRITERIA_LABELS[key]}
                          </span>
                          <span className="font-medium">
                            {value.toFixed(1)}
                          </span>
                        </div>
                        <Progress value={(value / 5) * 100} className="h-2" />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Feedback Comments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            Nhận xét từ học sinh
          </CardTitle>
        </CardHeader>
        <CardContent>
          {feedbacks.filter((f) => f.comment).length === 0 ? (
            <div className="text-center py-8">
              <Smile className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">Chưa có nhận xét nào</p>
            </div>
          ) : (
            <div className="space-y-4">
              {feedbacks
                .filter((f) => f.comment)
                .map((feedback) => (
                  <div
                    key={feedback._id}
                    className="p-4 bg-gray-50 rounded-lg border-l-4 border-blue-400"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-4 h-4 ${
                                star <= feedback.rating
                                  ? "fill-yellow-400 text-yellow-400"
                                  : "text-gray-300"
                              }`}
                            />
                          ))}
                        </div>
                        {feedback.className && (
                          <Badge variant="outline" className="text-xs">
                            {feedback.className}
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-gray-400">
                        {new Date(feedback.createdAt).toLocaleDateString(
                          "vi-VN",
                        )}
                      </span>
                    </div>
                    <p className="text-gray-700 italic">
                      &ldquo;{feedback.comment}&rdquo;
                    </p>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Award className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-800">
              {totalFeedbacks}
            </div>
            <p className="text-sm text-gray-500">Tổng đánh giá</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Star className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-800">
              {feedbacks.filter((f) => f.rating >= 4).length}
            </div>
            <p className="text-sm text-gray-500">Đánh giá tốt</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <MessageSquare className="w-8 h-8 text-blue-500 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-800">
              {feedbacks.filter((f) => f.comment).length}
            </div>
            <p className="text-sm text-gray-500">Có nhận xét</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingUp className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <div className="text-2xl font-bold text-gray-800">
              {stats.averageCriteria
                ? Math.max(
                    ...Object.values(stats.averageCriteria).filter(Boolean),
                  ).toFixed(1)
                : "-"}
            </div>
            <p className="text-sm text-gray-500">Điểm cao nhất</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
