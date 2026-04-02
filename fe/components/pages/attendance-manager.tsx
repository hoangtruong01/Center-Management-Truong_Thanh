"use client";

import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAttendanceStore } from "@/lib/stores/attendance-store";
import { useClassesStore, type Class } from "@/lib/stores/classes-store";
import { useBranchesStore } from "@/lib/stores/branches-store";
import api from "@/lib/api";
import { AlertCircle, Phone, CheckCircle2, XCircle, Clock, UserCheck, AlertTriangle } from "lucide-react";

interface AttendanceDetailModalProps {
  classData: Class;
  date: string;
  onClose: () => void;
}

interface StudentAttendance {
  studentId: string;
  studentName: string;
  studentCode: string;
  parentPhone?: string;
  hasApp?: boolean;
  status: "present" | "absent" | "late" | "excused";
  consecutiveAbsences: number;
  totalAbsences: number;
  totalSessions: number;
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
        const response = await api.get("/attendance/by-class-date", {
          params: { classId: classData._id, date },
        });
        const existingRecords = response.data || [];

        const studentsWithStats = await Promise.all(
          (classData.students || []).map(async (student) => {
            const statsRes = await api.get(`/attendance/statistics`, {
              params: { studentId: student._id },
            });
            const stats = statsRes.data;
            const record = existingRecords.find(
              (r: any) => (r.studentId?._id || r.studentId) === student._id
            );

            // Mock app status check - in reality, check if parent has a registered FCM token or account
            const hasApp = !!student.parentPhone; 

            return {
              studentId: student._id,
              studentName: student.name,
              studentCode: (student as any).studentCode || "N/A",
              parentPhone: (student as any).parentPhone,
              hasApp,
              status: record?.status || "present",
              consecutiveAbsences: 0, // Would be calculated from logic
              totalAbsences: stats.absent,
              totalSessions: stats.total,
              checkInTime: record?.createdAt ? new Date(record.createdAt).toLocaleTimeString("vi-VN") : undefined,
            };
          })
        );
        
        setAttendanceData(studentsWithStats);
      } catch (error) {
        console.error("Error fetching attendance details:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAttendanceData();
  }, [classData, date]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <Card className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="bg-linear-to-r from-emerald-600 to-teal-600 px-8 py-6 text-white">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">Chi tiết điểm danh</h2>
              <p className="opacity-90">{classData.name} • {new Date(date).toLocaleDateString("vi-VN")}</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
              <XCircle size={28} />
            </button>
          </div>
        </div>

        <div className="p-8 overflow-y-auto max-h-[70vh]">
          {isLoading ? (
            <div className="flex flex-col items-center py-20 gap-4">
              <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-500 font-medium">Đang tải dữ liệu học sinh...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {attendanceData.map((student) => {
                const absenceRate = student.totalSessions > 0 ? (student.totalAbsences / student.totalSessions) * 100 : 0;
                const isHighRisk = absenceRate >= 20;

                return (
                  <div key={student.studentId} className={`group relative flex flex-col md:flex-row md:items-center justify-between p-5 rounded-2xl border-2 transition-all ${
                    student.status === "absent" ? "bg-red-50 border-red-100" : "bg-white border-gray-100 hover:border-emerald-200 shadow-xs"
                  }`}>
                    <div className="flex items-center gap-4 flex-1">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-sm ${
                        student.status === "present" ? "bg-emerald-100 text-emerald-600" : 
                        student.status === "absent" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"
                      }`}>
                        {student.status === "present" ? <CheckCircle2 /> : student.status === "absent" ? <XCircle /> : <Clock />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-gray-900">{student.studentName}</h4>
                          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{student.studentCode}</span>
                          {!student.hasApp && (
                             <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] uppercase font-bold rounded-full">
                               <AlertTriangle size={10} /> PH chưa có App
                             </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-4 mt-1">
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                             <Phone size={12} className="text-gray-400" /> {student.parentPhone || "Không có SĐT"}
                          </p>
                          <p className={`text-xs font-medium ${isHighRisk ? "text-red-600" : "text-gray-500"}`}>
                            Tỷ lệ nghỉ: {absenceRate.toFixed(0)}% ({student.totalAbsences}/{student.totalSessions})
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 mt-4 md:mt-0">
                      {isHighRisk && (
                        <Button size="sm" variant="destructive" className="rounded-xl flex items-center gap-2 h-9">
                          <Phone size={14} /> Gọi ngay
                        </Button>
                      )}
                      <div className={`px-4 py-1.5 rounded-xl text-sm font-bold shadow-xs ${
                         student.status === "present" ? "bg-emerald-500 text-white" : 
                         student.status === "absent" ? "bg-red-500 text-white" : "bg-amber-500 text-white"
                      }`}>
                        {student.status === "present" ? "Có mặt" : student.status === "absent" ? "Vắng học" : "Đi muộn"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-6 bg-gray-50 border-t flex justify-end">
          <Button onClick={onClose} className="rounded-xl px-8 h-11 bg-gray-900 hover:bg-black text-white">Đóng</Button>
        </div>
      </Card>
    </div>
  );
}

export default function AttendanceManager() {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedBranchFilter, setSelectedBranchFilter] = useState("");
  const [selectedClassDetail, setSelectedClassDetail] = useState<Class | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { classes, fetchClasses } = useClassesStore();
  const { branches, fetchBranches } = useBranchesStore();
  const { highRiskStudents, fetchHighRiskStudents, isLoading: isStoreLoading } = useAttendanceStore();

  useEffect(() => {
    fetchClasses();
    fetchBranches();
    fetchHighRiskStudents();
  }, []);

  const filteredClasses = useMemo(() => {
    let result = classes;
    if (selectedBranchFilter) {
      result = result.filter(c => c.branchId === selectedBranchFilter || (c as any).branch?._id === selectedBranchFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c => c.name?.toLowerCase().includes(q) || (c as any).teacher?.name?.toLowerCase().includes(q));
    }
    return result;
  }, [classes, selectedBranchFilter, searchQuery]);

  return (
    <div className="space-y-8 pb-20">
      {/* Smart Alert Section */}
      {highRiskStudents.length > 0 && (
        <Card className="border-red-200 bg-red-50/50 shadow-sm overflow-hidden rounded-3xl">
          <div className="bg-red-600 px-6 py-3 flex items-center gap-2 text-white">
            <AlertCircle size={20} />
            <h3 className="font-bold uppercase tracking-wider text-sm">Danh sách ưu tiên cần gọi điện ngay ({highRiskStudents.length})</h3>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {highRiskStudents.slice(0, 6).map((student: any) => (
              <div key={student._id} className="bg-white p-4 rounded-2xl border border-red-100 flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold">
                    {student.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm leading-tight">{student.name}</p>
                    <p className="text-red-600 text-[11px] font-bold">Nghỉ {student.stats?.absent}/{student.stats?.total} buổi</p>
                  </div>
                </div>
                <Button size="icon" variant="ghost" className="text-emerald-600 hover:bg-emerald-50 rounded-full h-10 w-10">
                  <Phone size={18} fill="currentColor" />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Main Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: "Tổng lớp học", value: classes.length, icon: "🏫", color: "blue" },
          { label: "HS Nguy cơ", value: highRiskStudents.length, icon: "🚨", color: "red" },
          { label: "Số lượng HS", value: classes.reduce((acc, c) => acc + (c.studentIds?.length || 0), 0), icon: "👥", color: "emerald" },
          { label: "Buổi học/Tuần", value: classes.reduce((acc, c) => acc + (c.schedule?.length || 0), 0), icon: "📅", color: "purple" },
        ].map((stat, i) => (
          <Card key={i} className="p-6 shadow-xs border-gray-100 hover:shadow-md transition-shadow rounded-3xl">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-2xl bg-${stat.color}-100 flex items-center justify-center text-2xl`}>{stat.icon}</div>
              <div>
                <p className="text-sm font-medium text-gray-500">{stat.label}</p>
                <p className={`text-2xl font-black text-${stat.color}-600`}>{stat.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4 items-center bg-white p-6 rounded-3xl border border-gray-100 shadow-xs">
          <div className="flex items-center gap-3 bg-gray-50 px-4 py-2 rounded-2xl border border-gray-100 w-full md:w-auto">
            <span className="text-gray-400"><Clock size={18} /></span>
            <input 
              type="date" 
              className="bg-transparent border-none text-sm font-bold focus:ring-0" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
          
          <select 
            className="w-full md:w-48 bg-gray-50 border-gray-100 rounded-2xl text-sm font-bold px-4 h-[42px] focus:ring-emerald-500"
            value={selectedBranchFilter}
            onChange={(e) => setSelectedBranchFilter(e.target.value)}
          >
            <option value="">Tất cả cơ sở</option>
            {branches.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
          </select>

          <div className="flex-1 w-full relative">
            <input 
              type="text" 
              placeholder="Tìm lớp hoặc giáo viên..." 
              className="w-full bg-gray-50 border-gray-100 rounded-2xl pl-10 text-sm font-medium h-[42px] focus:ring-emerald-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          </div>
      </div>

      {/* Class List */}
      <div className="grid grid-cols-1 gap-4">
        {filteredClasses.length === 0 ? (
          <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
            <p className="text-gray-400 font-medium italic">Không tìm thấy lớp học nào phù hợp</p>
          </div>
        ) : (
          filteredClasses.map((cls) => {
            // Stats logic would be more complex in real app (aggregate from store)
            const stats = { rate: 85, total: cls.studentIds?.length || 0, present: 0 };
            const statusColor = stats.rate >= 90 ? "emerald" : stats.rate >= 70 ? "amber" : "red";

            return (
              <Card key={cls._id} className="group overflow-hidden rounded-3xl border-gray-100 hover:border-emerald-200 transition-all hover:shadow-lg shadow-xs">
                <div className="flex flex-col lg:flex-row items-center p-6 gap-6">
                  <div className={`w-16 h-16 rounded-2xl bg-${statusColor}-100 flex items-center justify-center text-2xl shadow-xs group-hover:scale-110 transition-transform`}>
                    🏫
                  </div>
                  
                  <div className="flex-1 text-center lg:text-left">
                    <h3 className="text-xl font-black text-gray-900 group-hover:text-emerald-600 transition-colors">{cls.name}</h3>
                    <p className="text-sm text-gray-500 font-medium">GV: {(cls as any).teacher?.name || "Chưa phân công"} • Cơ sở: {(cls as any).branch?.name || "N/A"}</p>
                    
                    <div className="mt-3 w-full max-w-sm mx-auto lg:mx-0">
                      <div className="flex justify-between items-end mb-1.5">
                        <span className="text-[10px] uppercase font-black text-gray-400 tracking-widest">Tỷ lệ chuyên cần</span>
                        <span className={`text-xs font-black text-${statusColor}-600`}>{stats.rate}%</span>
                      </div>
                      <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden border border-gray-50">
                        <div 
                          className={`h-full bg-${statusColor}-500 rounded-full transition-all duration-1000 ease-out shadow-sm`} 
                          style={{ width: `${stats.rate}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-8 px-6 border-x border-gray-50 hidden xl:flex">
                    <div className="text-center">
                      <p className="text-[10px] text-gray-400 font-bold uppercase">Sĩ số</p>
                      <p className="text-lg font-black text-gray-900">{stats.total}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-gray-400 font-bold uppercase">Vắng hôm nay</p>
                      <p className="text-lg font-black text-red-600">--</p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
                    <Button 
                      onClick={() => setSelectedClassDetail(cls)}
                      className="rounded-2xl px-6 h-12 bg-white border-2 border-gray-100 hover:border-emerald-500 hover:bg-emerald-50 text-emerald-700 font-bold shadow-xs transition-all"
                    >
                      <UserCheck className="mr-2" size={18} /> Điểm danh
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

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
