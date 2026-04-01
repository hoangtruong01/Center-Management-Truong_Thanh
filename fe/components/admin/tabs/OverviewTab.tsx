"use client";
import { Card } from "@/components/ui/card";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface OverviewTabProps {
  statsLoading: boolean;
  dashboardData: any;
  classes: any[];
  pieColors: string[];
}

export default function OverviewTab({
  statsLoading,
  dashboardData,
  classes,
  pieColors,
}: OverviewTabProps) {
  if (statsLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Đang tải dữ liệu...</span>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      {/* Overview Cards với gradient */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Học sinh */}
        <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
          <div className="absolute inset-0 bg-linear-to-br from-blue-500 to-blue-600 opacity-90" />
          <div className="relative p-5 text-white">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-white/80 text-sm font-medium">Học sinh</p>
                <p className="text-3xl font-bold mt-2">
                  {dashboardData?.overview?.students?.total || 0}
                </p>
                <p className="text-white/70 text-xs mt-1">
                  {dashboardData?.overview?.students?.trend || "Đang tải..."}
                </p>
              </div>
              <span className="text-4xl opacity-80">👨‍🎓</span>
            </div>
          </div>
        </Card>

        {/* Giáo viên */}
        <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
          <div className="absolute inset-0 bg-linear-to-br from-emerald-500 to-emerald-600 opacity-90" />
          <div className="relative p-5 text-white">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-white/80 text-sm font-medium">Giáo viên</p>
                <p className="text-3xl font-bold mt-2">
                  {dashboardData?.overview?.teachers?.total || 0}
                </p>
                <p className="text-white/70 text-xs mt-1">
                  {dashboardData?.overview?.teachers?.active || 0} đang hoạt động
                </p>
              </div>
              <span className="text-4xl opacity-80">👨‍🏫</span>
            </div>
          </div>
        </Card>

        {/* Doanh thu tháng */}
        <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
          <div className="absolute inset-0 bg-linear-to-br from-amber-500 to-orange-500 opacity-90" />
          <div className="relative p-5 text-white">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-white/80 text-sm font-medium">Doanh thu tháng</p>
                <p className="text-3xl font-bold mt-2">
                  {dashboardData?.overview?.revenue?.thisMonth
                    ? `${Math.round(dashboardData.overview.revenue.thisMonth / 1000000)} Tr`
                    : "0 Tr"}
                </p>
                <p className="text-white/70 text-xs mt-1">
                  {dashboardData?.overview?.revenue?.trend || "Đang tải..."}
                </p>
              </div>
              <span className="text-4xl opacity-80">💰</span>
            </div>
          </div>
        </Card>

        {/* Khóa học */}
        <Card className="relative overflow-hidden border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
          <div className="absolute inset-0 bg-linear-to-br from-purple-500 to-purple-600 opacity-90" />
          <div className="relative p-5 text-white">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-white/80 text-sm font-medium">Khóa học</p>
                <p className="text-3xl font-bold mt-2">
                  {dashboardData?.overview?.classes?.total || classes.length || 0}
                </p>
                <p className="text-white/70 text-xs mt-1">
                  {dashboardData?.overview?.classes?.active || 0} đang mở
                </p>
              </div>
              <span className="text-4xl opacity-80">📚</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 lg:grid-cols-2 mt-6">
        <Card className="p-6 bg-white border-0 shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">📈</span>
            <div>
              <p className="font-bold text-gray-900">Doanh thu theo tháng</p>
              <p className="text-xs text-gray-500">
                Biểu đồ doanh thu 6 tháng gần nhất (triệu đồng)
              </p>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dashboardData?.revenueByMonth || []}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#6b7280" }} />
                <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "none",
                    borderRadius: "12px",
                    boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
                  }}
                  formatter={(value: number) => [`${value} triệu`, "Doanh thu"]}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  fill="url(#colorRevenue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6 bg-white border-0 shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🎯</span>
            <div>
              <p className="font-bold text-gray-900">Phân bổ học sinh</p>
              <p className="text-xs text-gray-500">Theo môn học</p>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dashboardData?.studentsBySubject || []}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  innerRadius={60}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {(dashboardData?.studentsBySubject || []).map((_: any, idx: number) => (
                    <Cell key={idx} fill={pieColors[idx % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3 mt-6">
        <Card className="p-5 bg-linear-to-br from-emerald-50 to-green-50 border-2 border-emerald-200">
          <div className="flex items-center gap-3">
            <span className="text-3xl">✅</span>
            <div>
              <p className="text-sm text-gray-600">Tỷ lệ đi học</p>
              <p className="text-2xl font-bold text-emerald-700">
                {dashboardData?.attendanceRate || 0}%
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-5 bg-linear-to-br from-blue-50 to-indigo-50 border-2 border-blue-200">
          <div className="flex items-center gap-3">
            <span className="text-3xl">📊</span>
            <div>
              <p className="text-sm text-gray-600">Điểm TB toàn trường</p>
              <p className="text-2xl font-bold text-blue-700">
                {dashboardData?.averageScore || 0}
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-5 bg-linear-to-br from-amber-50 to-orange-50 border-2 border-amber-200">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🎓</span>
            <div>
              <p className="text-sm text-gray-600">Học sinh mới tháng này</p>
              <p className="text-2xl font-bold text-amber-700">
                +{dashboardData?.newStudentsThisMonth || 0}
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
