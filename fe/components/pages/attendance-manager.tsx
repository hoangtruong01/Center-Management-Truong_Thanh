"use client";

import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAttendanceStore } from "@/lib/stores/attendance-store";
import { useClassesStore, type Class } from "@/lib/stores/classes-store";
import { useBranchesStore } from "@/lib/stores/branches-store";
import api from "@/lib/api";

interface AttendanceDetailModalProps {
  classData: Class;
  date: string;
  onClose: () => void;
}

// Mock data for demonstration - in real app, this would come from API
interface StudentAttendance {
  studentId: string;
  studentName: string;
  status: "present" | "absent" | "late" | "excused";
  consecutiveAbsences: number;
  checkInTime?: string;
  notes?: string;
}

function AttendanceDetailModal({
  classData,
  date,
  onClose,
}: AttendanceDetailModalProps) {
  const [attendanceData, setAttendanceData] = useState<StudentAttendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAttendanceData = async () => {
      try {
        // Fetch actual attendance records from API for this date
        const response = await api.get("/attendance/by-class-date", {
          params: { classId: classData._id, date },
        });
        const existingRecords = response.data || [];

        // Check if class time has passed for this date
        const now = new Date();
        const selDate = new Date(date);
        const isDayPast = selDate.toDateString() < now.toDateString();
        let classTimeEnded = isDayPast;
        if (
          !classTimeEnded &&
          selDate.toDateString() === now.toDateString() &&
          classData.schedule
        ) {
          const todayDow = now.getDay();
          const todaySchedule = (classData.schedule as any[])?.find(
            (s: any) => s.dayOfWeek === todayDow,
          );
          if (todaySchedule?.endTime) {
            const [endH, endM] = todaySchedule.endTime.split(":").map(Number);
            if (
              now.getHours() > endH ||
              (now.getHours() === endH && now.getMinutes() >= endM)
            ) {
              classTimeEnded = true;
            }
          }
        }

        // Map students with actual attendance data
        const realStudents: StudentAttendance[] = (
          classData.students || []
        ).map((student) => {
          const record = existingRecords.find(
            (r: any) =>
              (typeof r.studentId === "string"
                ? r.studentId
                : r.studentId?._id) === student._id,
          );
          return {
            studentId: student._id,
            studentName: student.name,
            status: record
              ? record.status
              : classTimeEnded
                ? ("absent" as const)
                : ("present" as const),
            consecutiveAbsences: 0,
            checkInTime: record?.createdAt
              ? new Date(record.createdAt).toLocaleTimeString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : undefined,
          };
        });
        setAttendanceData(realStudents);
      } catch (error) {
        console.error("Error fetching attendance:", error);
        // On error, check if class time has passed
        const now = new Date();
        const selDate = new Date(date);
        const isDayPast = selDate.toDateString() < now.toDateString();
        let classTimeEnded = isDayPast;
        if (
          !classTimeEnded &&
          selDate.toDateString() === now.toDateString() &&
          classData.schedule
        ) {
          const todayDow = now.getDay();
          const todaySchedule = (classData.schedule as any[])?.find(
            (s: any) => s.dayOfWeek === todayDow,
          );
          if (todaySchedule?.endTime) {
            const [endH, endM] = todaySchedule.endTime.split(":").map(Number);
            if (
              now.getHours() > endH ||
              (now.getHours() === endH && now.getMinutes() >= endM)
            ) {
              classTimeEnded = true;
            }
          }
        }

        const realStudents: StudentAttendance[] = (
          classData.students || []
        ).map((student) => ({
          studentId: student._id,
          studentName: student.name,
          status: classTimeEnded ? ("absent" as const) : ("present" as const),
          consecutiveAbsences: 0,
          checkInTime: undefined,
        }));
        setAttendanceData(realStudents);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAttendanceData();
  }, [classData, date]);

  const presentCount = attendanceData.filter(
    (a) => a.status === "present",
  ).length;
  const absentCount = attendanceData.filter(
    (a) => a.status === "absent",
  ).length;
  const lateCount = attendanceData.filter((a) => a.status === "late").length;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-linear-to-r from-emerald-600 to-teal-600 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white text-lg">
                📋
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  Chi tiết điểm danh
                </h2>
                <p className="text-emerald-100 text-sm">
                  {classData.name} •{" "}
                  {new Date(date).toLocaleDateString("vi-VN")}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="px-6 py-4 bg-gray-50 border-b">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-green-100 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-green-700">
                {presentCount}
              </p>
              <p className="text-xs text-green-600">Có mặt</p>
            </div>
            <div className="bg-red-100 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-red-700">{absentCount}</p>
              <p className="text-xs text-red-600">Vắng</p>
            </div>
            <div className="bg-amber-100 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-amber-700">{lateCount}</p>
              <p className="text-xs text-amber-600">Đi trễ</p>
            </div>
          </div>
        </div>

        {/* Student List */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-250px)]">
          {isLoading ? (
            <div className="text-center py-8">
              <span className="animate-spin inline-block mr-2">⏳</span>
              Đang tải...
            </div>
          ) : (
            <div className="space-y-2">
              {attendanceData.map((student) => (
                <div
                  key={student.studentId}
                  className={`flex items-center justify-between rounded-xl px-4 py-3 border-2 ${
                    student.status === "present"
                      ? "border-green-200 bg-green-50"
                      : student.status === "absent"
                        ? "border-red-200 bg-red-50"
                        : "border-amber-200 bg-amber-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-lg ${
                        student.status === "present"
                          ? "bg-green-500"
                          : student.status === "absent"
                            ? "bg-red-500"
                            : "bg-amber-500"
                      }`}
                    >
                      {student.status === "present"
                        ? "✓"
                        : student.status === "absent"
                          ? "✗"
                          : "⏰"}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900">
                          {student.studentName}
                        </p>
                        {student.consecutiveAbsences >= 3 && (
                          <span className="px-2 py-0.5 bg-red-600 text-white text-xs rounded-full font-medium animate-pulse">
                            ⚠️ Nghỉ {student.consecutiveAbsences} buổi liên tiếp
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {student.status === "present"
                          ? `Check-in: ${student.checkInTime}`
                          : student.status === "late"
                            ? `Đến lúc: ${student.checkInTime}`
                            : "Không tham gia"}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      student.status === "present"
                        ? "bg-green-200 text-green-800"
                        : student.status === "absent"
                          ? "bg-red-200 text-red-800"
                          : "bg-amber-200 text-amber-800"
                    }`}
                  >
                    {student.status === "present"
                      ? "Có mặt"
                      : student.status === "absent"
                        ? "Vắng"
                        : "Đi trễ"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50">
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full rounded-xl"
          >
            Đóng
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AttendanceManager() {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [selectedBranchFilter, setSelectedBranchFilter] = useState("");
  const [selectedClassDetail, setSelectedClassDetail] = useState<Class | null>(
    null,
  );
  const [searchQuery, setSearchQuery] = useState("");

  const { classes, fetchClasses } = useClassesStore();
  const { branches, fetchBranches } = useBranchesStore();
  const { fetchAttendance, fetchStatistics, statistics } = useAttendanceStore();

  useEffect(() => {
    fetchClasses().catch(console.error);
    fetchBranches().catch(console.error);
  }, [fetchClasses, fetchBranches]);

  // Filter classes by branch and search
  const filteredClasses = useMemo(() => {
    let result = classes;

    if (selectedBranchFilter) {
      result = result.filter(
        (c) =>
          c.branchId === selectedBranchFilter ||
          c.branch?._id === selectedBranchFilter,
      );
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.name?.toLowerCase().includes(query) ||
          c.teacher?.name?.toLowerCase().includes(query),
      );
    }

    return result;
  }, [classes, selectedBranchFilter, searchQuery]);

  // Get actual attendance data from classes
  // For now, show student counts from real data - attendance will need backend support
  // Track per-class attendance stats from API
  const [classAttendanceMap, setClassAttendanceMap] = useState<
    Record<
      string,
      { present: number; absent: number; late: number; total: number }
    >
  >({});

  // Fetch attendance data for all classes when date changes
  useEffect(() => {
    const fetchAllClassAttendance = async () => {
      const map: Record<
        string,
        { present: number; absent: number; late: number; total: number }
      > = {};
      for (const cls of filteredClasses) {
        try {
          const response = await api.get("/attendance/by-class-date", {
            params: { classId: cls._id, date: selectedDate },
          });
          const records = response.data || [];
          const totalStudents =
            cls.students?.length || cls.studentIds?.length || 0;
          const present = records.filter(
            (r: any) => r.status === "present",
          ).length;
          const late = records.filter((r: any) => r.status === "late").length;
          const markedAbsent = records.filter(
            (r: any) => r.status === "absent",
          ).length;
          // Students without any record are considered absent if class time has passed
          const unmarked = totalStudents - records.length;
          // Check if any scheduled class time for this day has ended
          const now = new Date();
          const selDate = new Date(selectedDate);
          const isSelectedDayPast =
            selDate.toDateString() < new Date().toDateString();
          let classTimeEnded = isSelectedDayPast;
          if (
            !classTimeEnded &&
            selDate.toDateString() === now.toDateString() &&
            cls.schedule
          ) {
            // For today, check if the class end time has passed
            const todayDow = now.getDay();
            const todaySchedule = cls.schedule.find(
              (s: any) => s.dayOfWeek === todayDow,
            );
            if (todaySchedule?.endTime) {
              const [endH, endM] = todaySchedule.endTime.split(":").map(Number);
              if (
                now.getHours() > endH ||
                (now.getHours() === endH && now.getMinutes() >= endM)
              ) {
                classTimeEnded = true;
              }
            }
          }
          const absent = markedAbsent + (classTimeEnded ? unmarked : 0);
          map[cls._id] = {
            present: present + late,
            absent,
            late,
            total: totalStudents,
          };
        } catch {
          // If fetch fails, assume no data
          const totalStudents =
            cls.students?.length || cls.studentIds?.length || 0;
          const now = new Date();
          const selDate = new Date(selectedDate);
          const isSelectedDayPast = selDate.toDateString() < now.toDateString();
          let classTimeEnded = isSelectedDayPast;
          if (
            !classTimeEnded &&
            selDate.toDateString() === now.toDateString() &&
            cls.schedule
          ) {
            const todayDow = now.getDay();
            const todaySchedule = cls.schedule.find(
              (s: any) => s.dayOfWeek === todayDow,
            );
            if (todaySchedule?.endTime) {
              const [endH, endM] = todaySchedule.endTime.split(":").map(Number);
              if (
                now.getHours() > endH ||
                (now.getHours() === endH && now.getMinutes() >= endM)
              ) {
                classTimeEnded = true;
              }
            }
          }
          map[cls._id] = {
            present: 0,
            absent: classTimeEnded ? totalStudents : 0,
            late: 0,
            total: totalStudents,
          };
        }
      }
      setClassAttendanceMap(map);
    };

    if (filteredClasses.length > 0) {
      fetchAllClassAttendance();
    }
  }, [filteredClasses, selectedDate]);

  const getClassAttendanceStats = (classData: Class) => {
    const totalStudents =
      classData.students?.length || classData.studentIds?.length || 0;
    const stats = classAttendanceMap[classData._id];

    if (stats) {
      const attendanceRate =
        stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;
      return {
        totalStudents,
        present: stats.present,
        absent: stats.absent,
        attendanceRate,
        hasConsecutiveAbsent: false,
      };
    }

    // Default: if class time has passed and no records, show all absent
    const now = new Date();
    const selDate = new Date(selectedDate);
    const isSelectedDayPast = selDate.toDateString() < now.toDateString();
    let classTimeEnded = isSelectedDayPast;
    if (
      !classTimeEnded &&
      selDate.toDateString() === now.toDateString() &&
      classData.schedule
    ) {
      const todayDow = now.getDay();
      const todaySchedule = (classData.schedule as any[]).find(
        (s: any) => s.dayOfWeek === todayDow,
      );
      if (todaySchedule?.endTime) {
        const [endH, endM] = todaySchedule.endTime.split(":").map(Number);
        if (
          now.getHours() > endH ||
          (now.getHours() === endH && now.getMinutes() >= endM)
        ) {
          classTimeEnded = true;
        }
      }
    }
    return {
      totalStudents,
      present: classTimeEnded ? 0 : totalStudents,
      absent: classTimeEnded ? totalStudents : 0,
      attendanceRate: classTimeEnded ? 0 : 100,
      hasConsecutiveAbsent: false,
    };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            📋 Thống kê Điểm danh
          </h2>
          <p className="text-gray-500 text-sm mt-1">
            Theo dõi và quản lý điểm danh các lớp học
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600">📅 Ngày:</span>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-xl w-40"
            />
          </div>

          <select
            value={selectedBranchFilter}
            onChange={(e) => setSelectedBranchFilter(e.target.value)}
            className="px-3 py-2 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Tất cả cơ sở</option>
            {branches.map((b) => (
              <option key={b._id} value={b._id}>
                {b.name}
              </option>
            ))}
          </select>

          <div className="flex-1 min-w-50">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                🔍
              </span>
              <Input
                type="text"
                placeholder="Tìm kiếm lớp học..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 rounded-xl"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 bg-linear-to-br from-blue-50 to-indigo-50 border-blue-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center text-white text-2xl">
              📚
            </div>
            <div>
              <p className="text-sm text-gray-600">Tổng lớp học</p>
              <p className="text-2xl font-bold text-blue-700">
                {filteredClasses.length}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-linear-to-br from-green-50 to-emerald-50 border-green-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-green-500 flex items-center justify-center text-white text-2xl">
              ✓
            </div>
            <div>
              <p className="text-sm text-gray-600">Tỷ lệ có mặt TB</p>
              <p className="text-2xl font-bold text-green-700">
                {filteredClasses.length > 0
                  ? Math.round(
                      filteredClasses.reduce(
                        (acc, c) =>
                          acc + getClassAttendanceStats(c).attendanceRate,
                        0,
                      ) / filteredClasses.length,
                    )
                  : 0}
                %
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-linear-to-br from-red-50 to-rose-50 border-red-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-red-500 flex items-center justify-center text-white text-2xl">
              ⚠️
            </div>
            <div>
              <p className="text-sm text-gray-600">Cần lưu ý</p>
              <p className="text-2xl font-bold text-red-700">
                {
                  filteredClasses.filter(
                    (c) => getClassAttendanceStats(c).hasConsecutiveAbsent,
                  ).length
                }
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-linear-to-br from-amber-50 to-orange-50 border-amber-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center text-white text-2xl">
              👥
            </div>
            <div>
              <p className="text-sm text-gray-600">Tổng học sinh</p>
              <p className="text-2xl font-bold text-amber-700">
                {filteredClasses.reduce(
                  (acc, c) =>
                    acc + (c.students?.length || c.studentIds?.length || 0),
                  0,
                )}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Classes Attendance List */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">📊</span>
          <div>
            <h3 className="font-bold text-gray-900">
              Điểm danh theo lớp -{" "}
              {new Date(selectedDate).toLocaleDateString("vi-VN")}
            </h3>
            <p className="text-xs text-gray-500">
              Nhấn "Xem chi tiết" để xem danh sách học sinh
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {filteredClasses.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <span className="text-5xl mb-4 block">📋</span>
              <p className="font-medium">Chưa có lớp học nào</p>
              <p className="text-sm">Tạo lớp học mới trong tab Khóa học</p>
            </div>
          ) : (
            filteredClasses.map((classData) => {
              const stats = getClassAttendanceStats(classData);

              return (
                <div
                  key={classData._id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between rounded-2xl border-2 px-5 py-4 transition-all duration-300 hover:shadow-md ${
                    stats.hasConsecutiveAbsent
                      ? "border-red-200 bg-red-50"
                      : "border-gray-100 bg-linear-to-r from-white to-gray-50 hover:border-blue-200"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl shadow-md ${
                        stats.attendanceRate >= 90
                          ? "bg-linear-to-br from-green-500 to-emerald-500"
                          : stats.attendanceRate >= 70
                            ? "bg-linear-to-br from-amber-500 to-orange-500"
                            : "bg-linear-to-br from-red-500 to-rose-500"
                      }`}
                    >
                      {stats.attendanceRate >= 90
                        ? "✓"
                        : stats.attendanceRate >= 70
                          ? "⚠"
                          : "!"}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-gray-900">
                          {classData.name}
                        </p>
                        {stats.hasConsecutiveAbsent && (
                          <span className="px-2 py-0.5 bg-red-600 text-white text-xs rounded-full font-medium animate-pulse">
                            🔔 Có HS nghỉ 3+ buổi
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        GV: {classData.teacher?.name || "Chưa phân công"} •{" "}
                        {classData.branch?.name || ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 mt-3 sm:mt-0">
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <p className="text-xs text-gray-500">Học sinh</p>
                        <p className="font-bold text-gray-900">
                          {stats.totalStudents}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500">Có mặt</p>
                        <p className="font-bold text-green-600">
                          {stats.present}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500">Vắng</p>
                        <p className="font-bold text-red-600">{stats.absent}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-500">Tỷ lệ</p>
                        <p
                          className={`font-bold ${
                            stats.attendanceRate >= 90
                              ? "text-green-600"
                              : stats.attendanceRate >= 70
                                ? "text-amber-600"
                                : "text-red-600"
                          }`}
                        >
                          {stats.attendanceRate}%
                        </p>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      className="rounded-xl text-blue-600 border-blue-200 hover:bg-blue-50"
                      onClick={() => setSelectedClassDetail(classData)}
                    >
                      👁️ Xem chi tiết
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {/* Detail Modal */}
      {selectedClassDetail && (
        <AttendanceDetailModal
          classData={selectedClassDetail}
          date={selectedDate}
          onClose={() => setSelectedClassDetail(null)}
        />
      )}
    </div>
  );
}
