"use client";
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { 
  ChevronDown, 
  ChevronUp, 
  DollarSign, 
  Users, 
  Calendar,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { formatTeacherPayout, formatCenterShare, formatCurrency } from "@/lib/utils"; // Assuming these exist or I'll use local helpers

interface PayrollTabProps {
  selectedBranch: string;
  setSelectedBranch: (id: string) => void;
  branches: any[];
  payrollSummaries: any[];
  isLoading: boolean;
  error: string | null;
  fetchPayroll: (branchId: string, month?: number, year?: number) => Promise<void>;
  clearError: () => void;
}

export default function PayrollTab({
  selectedBranch,
  setSelectedBranch,
  branches,
  payrollSummaries,
  isLoading,
  error,
  fetchPayroll,
  clearError,
}: PayrollTabProps) {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [expandedClasses, setExpandedClasses] = useState<string[]>([]);

  useEffect(() => {
    fetchPayroll(selectedBranch, selectedMonth, selectedYear);
  }, [selectedBranch, selectedMonth, selectedYear, fetchPayroll]);

  const toggleClass = (classId: string) => {
    setExpandedClasses(prev => 
      prev.includes(classId) 
        ? prev.filter(id => id !== classId) 
        : [...prev, classId]
    );
  };

  const localFormatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "fully_paid":
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-none">Đã thu đủ</Badge>;
      case "partially_paid":
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-none">Chưa thu đủ</Badge>;
      default:
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-200 border-none">Chưa thu</Badge>;
    }
  };

  // Calculate totals
  const totalRevenue = payrollSummaries.reduce((acc, curr) => acc + curr.totalRevenue, 0);
  const totalTeacherPayout = payrollSummaries.reduce((acc, curr) => acc + curr.totalTeacherShare, 0);
  const totalCenterShare = totalRevenue - totalTeacherPayout;

  return (
    <div className="mt-6 space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Cơ sở</label>
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          >
            <option value="ALL">Tất cả cơ sở</option>
            {branches.map((branch) => (
              <option key={branch._id} value={branch._id}>{branch.name}</option>
            ))}
          </select>
        </div>

        <div className="w-32">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Tháng</label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          >
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={i + 1}>Tháng {i + 1}</option>
            ))}
          </select>
        </div>

        <div className="w-32">
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Năm</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          >
            <option value={2026}>2026</option>
            <option value={2025}>2025</option>
            <option value={2024}>2024</option>
          </select>
        </div>

        <Button 
          onClick={() => fetchPayroll(selectedBranch, selectedMonth, selectedYear)}
          variant="outline"
          className="h-[38px]"
        >
          Làm mới
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 border-none shadow-md bg-linear-to-br from-blue-600 to-indigo-700 text-white relative overflow-hidden">
          <div className="absolute right-[-10px] top-[-10px] opacity-10">
            <DollarSign size={100} />
          </div>
          <div className="relative">
            <p className="text-blue-100 text-sm font-medium mb-1">Tổng doanh thu (100%)</p>
            <h3 className="text-3xl font-bold">{localFormatCurrency(totalRevenue)}</h3>
            <div className="mt-4 flex items-center text-xs text-blue-100 italic">
              <AlertCircle size={12} className="mr-1" />
              Tính trên các khoản học phí đã thu
            </div>
          </div>
        </Card>

        <Card className="p-6 border-none shadow-md bg-linear-to-br from-emerald-600 to-teal-700 text-white relative overflow-hidden">
          <div className="absolute right-[-10px] top-[-10px] opacity-10">
            <Users size={100} />
          </div>
          <div className="relative">
            <p className="text-emerald-100 text-sm font-medium mb-1">Lương giáo viên (70%)</p>
            <h3 className="text-3xl font-bold">{localFormatCurrency(totalTeacherPayout)}</h3>
            <div className="mt-4 flex items-center text-xs text-emerald-100 italic">
              <CheckCircle2 size={12} className="mr-1" />
              Chi trả dựa trên doanh thu thực tế
            </div>
          </div>
        </Card>

        <Card className="p-6 border-none shadow-md bg-linear-to-br from-violet-600 to-purple-700 text-white relative overflow-hidden">
          <div className="absolute right-[-10px] top-[-10px] opacity-10">
            <Calendar size={100} />
          </div>
          <div className="relative">
            <p className="text-violet-100 text-sm font-medium mb-1">Phần trung tâm (30%)</p>
            <h3 className="text-3xl font-bold">{localFormatCurrency(totalCenterShare)}</h3>
            <div className="mt-4 flex items-center text-xs text-violet-100 italic">
              <AlertCircle size={12} className="mr-1" />
              Sau khi đã trừ phần giáo viên
            </div>
          </div>
        </Card>
      </div>

      {/* Main Content */}
      <Card className="border-none shadow-lg overflow-hidden bg-white">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800">Chi tiết tính lương theo lớp</h2>
          <Badge variant="outline" className="text-gray-500">{payrollSummaries.length} lớp học</Badge>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead className="w-[300px]">Lớp học & Giáo viên</TableHead>
                <TableHead className="text-right">Tổng doanh thu</TableHead>
                <TableHead className="text-right">Lương GV (70%)</TableHead>
                <TableHead className="text-right">Số Block</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-40 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-500">Đang tính toán dữ liệu...</p>
                  </TableCell>
                </TableRow>
              ) : payrollSummaries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-40 text-center text-gray-500">
                    Chưa có dữ liệu tính lương cho kỳ này.
                  </TableCell>
                </TableRow>
              ) : (
                payrollSummaries.map((summary) => (
                  <>
                    <TableRow key={summary.classId} className="hover:bg-gray-50 transition-colors">
                      <TableCell>
                        <div>
                          <p className="font-bold text-gray-900">{summary.className}</p>
                          <p className="text-xs text-gray-500">GV: {summary.teacherName}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-blue-600">
                        {localFormatCurrency(summary.totalRevenue)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-emerald-600">
                        {formatCurrency(summary.totalTeacherShare)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="default" className="font-medium">
                          {summary.blocks.length} block (10 buổi/block)
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => toggleClass(summary.classId)}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          {expandedClasses.includes(summary.classId) ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                          {expandedClasses.includes(summary.classId) ? "Thu gọn" : "Chi tiết"}
                        </Button>
                      </TableCell>
                    </TableRow>
                    
                    {expandedClasses.includes(summary.classId) && (
                      <TableRow className="bg-blue-50/30 border-l-4 border-l-blue-500">
                        <TableCell colSpan={5} className="p-6">
                          <div className="space-y-4">
                            <h4 className="text-sm font-bold text-blue-800 flex items-center">
                              <Calendar size={16} className="mr-2" />
                              Chi tiết các Block 10 buổi
                            </h4>
                            <div className="grid grid-cols-1 gap-4">
                              {summary.blocks.map((block: any) => (
                                <div key={block.blockNumber} className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm flex flex-wrap justify-between items-center gap-4">
                                  <div className="space-y-1">
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-tighter">Block {block.blockNumber}</p>
                                    <p className="text-sm font-bold text-gray-800">Buổi {block.sessionRange}</p>
                                  </div>
                                  
                                  <div className="text-center px-4 border-x border-gray-100">
                                    <p className="text-[10px] text-gray-500 mb-1">Học sinh / Đã thu</p>
                                    <p className="text-sm font-bold">{block.paidStudentCount} / {block.studentCount}</p>
                                  </div>

                                  <div className="text-right">
                                    <p className="text-[10px] text-gray-500 mb-1">Doanh thu Block</p>
                                    <p className="text-sm font-bold text-blue-600">{localFormatCurrency(block.totalRevenue)}</p>
                                  </div>

                                  <div className="text-right">
                                    <p className="text-[10px] text-gray-500 mb-1">Lương GV (70%)</p>
                                    <p className="text-sm font-bold text-emerald-600">{localFormatCurrency(block.teacherShare)}</p>
                                  </div>

                                  <div className="min-w-[100px] text-right">
                                    {getStatusBadge(block.paymentStatus)}
                                  </div>

                                  <Button size="sm" variant="outline" className="text-xs h-8">
                                    Chi tiết buổi dạy
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Makeup Section - Dedicated list for Late Joiners */}
      <Card className="border-none shadow-lg overflow-hidden bg-white">
        <div className="p-6 border-b border-gray-100 bg-amber-50/50">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 text-amber-700 rounded-lg">
                <Users size={20} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">Theo dõi học bù (Sinh viên đăng ký muộn)</h2>
                <p className="text-xs text-gray-500 mt-1 italic">Chỉ áp dụng cho các trường hợp đăng ký sau khi lớp đã bắt đầu</p>
              </div>
            </div>
            <Badge variant="outline" className="border-amber-200 text-amber-700">Đang xử lý</Badge>
          </div>
        </div>
        <div className="p-0">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead>Học sinh</TableHead>
                <TableHead>Lớp học</TableHead>
                <TableHead>Ngày đăng ký</TableHead>
                <TableHead className="text-center">Số buổi cần bù</TableHead>
                <TableHead className="text-center">Đã bù</TableHead>
                <TableHead className="text-right">Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="text-center py-8 text-gray-400 italic" colSpan={6}>
                  Đang phát triển tính năng theo dõi chi tiết danh sách học sinh cần bù...
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
