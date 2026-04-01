"use client";
import { Card } from "@/components/ui/card";

interface LeaderboardTabProps {
  leaderboardBranch: string;
  setLeaderboardBranch: (id: string) => void;
  branches: any[];
  leaderboardOptions: any;
  rankingView: "score" | "attendance";
  setRankingView: (view: "score" | "attendance") => void;
  tabIcons: any;
  leaderboardLoading: boolean;
  leaderboard: any;
}

export default function LeaderboardTab({
  leaderboardBranch,
  setLeaderboardBranch,
  branches,
  leaderboardOptions,
  rankingView,
  setRankingView,
  tabIcons,
  leaderboardLoading,
  leaderboard,
}: LeaderboardTabProps) {
  return (
    <div className="mt-6">
      <Card className="p-6 space-y-5 bg-white border-0 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏆</span>
            <div>
              <p className="font-bold text-gray-900 text-lg">Bảng Xếp Hạng</p>
              <p className="text-xs text-gray-500">Vinh dân những nỗ lực xuất sắc</p>
            </div>
          </div>
          {/* Branch Filter */}
          <select
            value={leaderboardBranch}
            onChange={(e) => setLeaderboardBranch(e.target.value)}
            className="nice-select rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tất cả cơ sở</option>
            {branches.map((branch) => (
              <option key={branch._id} value={branch._id}>
                {branch.name}
              </option>
            ))}
          </select>
        </div>

        {/* Ranking Category Tabs */}
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1">
          {Object.entries(leaderboardOptions).map(([key, opt]: [any, any]) => (
            <button
              key={key}
              onClick={() => setRankingView(key)}
              className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                rankingView === key ? "bg-white text-blue-700 shadow-sm" : "text-gray-600 hover:bg-white/50"
              }`}
            >
              <span className="text-base leading-none">{tabIcons[key]}</span>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>

        {/* Loading State */}
        {leaderboardLoading && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-500 mt-4">Đang tải...</p>
          </div>
        )}

        {/* Leaderboard List */}
        {!leaderboardLoading && (
          <div className="space-y-3">
            {rankingView === "score" &&
              leaderboard?.score?.map((row: any) => (
                <div
                  key={`score-${row.rank}-${row.studentId}`}
                  className={`flex items-center justify-between rounded-2xl border-2 px-5 py-4 transition-all duration-300 ${
                    row.rank === 1 ? "border-amber-200 bg-linear-to-r from-amber-50 to-yellow-50 shadow-md" : row.rank === 2 ? "border-gray-200 bg-linear-to-r from-gray-50 to-slate-50" : row.rank === 3 ? "border-orange-200 bg-linear-to-r from-orange-50 to-amber-50" : "border-gray-100 bg-white hover:border-blue-200"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                        row.rank === 1 ? "bg-linear-to-br from-amber-400 to-yellow-500 text-white shadow-lg" : row.rank === 2 ? "bg-linear-to-br from-gray-300 to-gray-400 text-white shadow-md" : row.rank === 3 ? "bg-linear-to-br from-orange-400 to-amber-500 text-white shadow-md" : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {row.rank === 1 && "🏆"}
                      {row.rank === 2 && "🥈"}
                      {row.rank === 3 && "🥉"}
                      {row.rank > 3 && <span className="text-xs font-bold">{row.rank}</span>}
                    </div>
                    <div className="text-sm">
                      <p className="font-bold text-gray-900">{row.studentName}</p>
                      <p className="text-[10px] text-gray-500">{row.className || `${row.totalGrades} bài kiểm tra`}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-blue-600">{row.averageScore.toFixed(1)}</p>
                    <p className="text-[10px] text-gray-500">Điểm TB</p>
                  </div>
                </div>
              ))}

            {rankingView === "attendance" &&
              leaderboard?.attendance?.map((row: any) => (
                <div
                  key={`attendance-${row.rank}-${row.studentId}`}
                  className={`flex items-center justify-between rounded-2xl border-2 px-5 py-4 transition-all duration-300 ${
                    row.rank === 1 ? "border-amber-200 bg-linear-to-r from-amber-50 to-yellow-50 shadow-md" : row.rank === 2 ? "border-gray-200 bg-linear-to-r from-gray-50 to-slate-50" : row.rank === 3 ? "border-orange-200 bg-linear-to-r from-orange-50 to-amber-50" : "border-gray-100 bg-white hover:border-blue-200"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                        row.rank === 1 ? "bg-linear-to-br from-amber-400 to-yellow-500 text-white shadow-lg" : row.rank === 2 ? "bg-linear-to-br from-gray-300 to-gray-400 text-white shadow-md" : row.rank === 3 ? "bg-linear-to-br from-orange-400 to-amber-500 text-white shadow-md" : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {row.rank === 1 && "🏆"}
                      {row.rank === 2 && "🥈"}
                      {row.rank === 3 && "🥉"}
                      {row.rank > 3 && <span className="text-xs font-bold">{row.rank}</span>}
                    </div>
                    <div className="text-sm">
                      <p className="font-bold text-gray-900">{row.studentName}</p>
                      <p className="text-[10px] text-gray-500">Đã theo học {row.daysEnrolled} ngày</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-emerald-600">{row.attendanceRate}%</p>
                    <p className="text-[10px] text-gray-500">{row.presentCount}/{row.totalSessions} buổi</p>
                  </div>
                </div>
              ))}

            {/* Empty State */}
            {!leaderboardLoading &&
              ((rankingView === "score" && (!leaderboard?.score || leaderboard.score.length === 0)) ||
                (rankingView === "attendance" && (!leaderboard?.attendance || leaderboard.attendance.length === 0))) && (
                <div className="text-center py-8 text-gray-500">
                  <p className="text-4xl mb-2">📊</p>
                  <p>Chưa có dữ liệu xếp hạng</p>
                </div>
              )}
          </div>
        )}

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-100">
          <div className="text-center p-3 rounded-xl bg-linear-to-br from-blue-50 to-indigo-50">
            <p className="text-lg font-bold text-blue-600">{leaderboard?.summary?.totalStudents || 0}</p>
            <p className="text-[10px] text-gray-500">Tổng học sinh</p>
          </div>
          <div className="text-center p-3 rounded-xl bg-linear-to-br from-emerald-50 to-green-50">
            <p className="text-lg font-bold text-emerald-600">{leaderboard?.summary?.averageScore?.toFixed(1) || "0.0"}</p>
            <p className="text-[10px] text-gray-500">Điểm TB</p>
          </div>
          <div className="text-center p-3 rounded-xl bg-linear-to-br from-amber-50 to-orange-50">
            <p className="text-lg font-bold text-amber-600">{leaderboard?.summary?.averageAttendanceRate || 0}%</p>
            <p className="text-[10px] text-gray-500">Tỷ lệ chuyên cần</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
