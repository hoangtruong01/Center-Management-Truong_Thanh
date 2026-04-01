"use client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ClassesTabProps {
  classes: any[];
  setShowImportStudentsModal: (show: boolean) => void;
  setEditingClass: (cls: any) => void;
  setShowClassModal: (show: boolean) => void;
  classBranchFilter: string;
  setClassBranchFilter: (id: string) => void;
  classSearchQuery: string;
  setClassSearchQuery: (query: string) => void;
  branches: any[];
  setClassStudentsModal: (cls: any) => void;
  setClassDetailModal: (cls: any) => void;
}

export default function ClassesTab({
  classes,
  setShowImportStudentsModal,
  setEditingClass,
  setShowClassModal,
  classBranchFilter,
  setClassBranchFilter,
  classSearchQuery,
  setClassSearchQuery,
  branches,
  setClassStudentsModal,
  setClassDetailModal,
}: ClassesTabProps) {
  const filteredClasses = classes.filter((course) => {
    // Filter by branch
    if (classBranchFilter) {
      const courseBranchId =
        course.branch?._id ||
        (typeof course.branchId === "string"
          ? course.branchId
          : (course.branchId as any)?._id);
      if (courseBranchId !== classBranchFilter) return false;
    }
    // Filter by search query
    if (!classSearchQuery.trim()) return true;
    const query = classSearchQuery.toLowerCase();
    return (
      course.name?.toLowerCase().includes(query) ||
      course.teacher?.name?.toLowerCase().includes(query) ||
      course.branch?.name?.toLowerCase().includes(query) ||
      course.subject?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="mt-6">
      <Card className="p-6 space-y-5 bg-white border-0 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📚</span>
            <div>
              <p className="font-bold text-gray-900 text-lg">Danh sách khóa học</p>
              <p className="text-xs text-gray-500">Quản lý các khóa học đang hoạt động</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setShowImportStudentsModal(true)}
              className="bg-linear-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-xl shadow-lg shadow-green-200"
            >
              📥 Import học sinh
            </Button>
            <Button
              onClick={() => {
                setEditingClass(null);
                setShowClassModal(true);
              }}
              className="bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-lg shadow-blue-200"
            >
              ➕ Thêm khóa học
            </Button>
          </div>
        </div>

        {/* Branch Filter & Search Bar */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600">🏢 Cơ sở:</span>
            <select
              value={classBranchFilter}
              onChange={(e) => setClassBranchFilter(e.target.value)}
              className="nice-select rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-45"
            >
              <option value="">Tất cả cơ sở</option>
              {branches.map((branch) => (
                <option key={branch._id} value={branch._id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>
          <div className="relative flex-1 min-w-50">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            <Input
              type="text"
              placeholder="Tìm kiếm khóa học..."
              value={classSearchQuery}
              onChange={(e) => setClassSearchQuery(e.target.value)}
              className="pl-9 pr-8 w-full rounded-xl border-gray-200"
            />
          </div>
        </div>

        <div className="space-y-3">
          {filteredClasses.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-lg mb-2">📚</p>
              <p>Không tìm thấy khóa học nào</p>
            </div>
          ) : (
            filteredClasses.map((course) => (
              <ClassRow
                key={course._id}
                course={course}
                onDetail={() => setClassDetailModal(course)}
                onStudents={() => setClassStudentsModal(course)}
                onEdit={() => {
                  setEditingClass(course);
                  setShowClassModal(true);
                }}
              />
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

function ClassRow({ course, onDetail, onStudents, onEdit }: { course: any; onDetail: any; onStudents: any; onEdit: any }) {
  const courseEndDate = course.endDate ? new Date(course.endDate) : null;
  if (courseEndDate) courseEndDate.setHours(23, 59, 59, 999);
  const isExpired = course.status === "completed" || (!!courseEndDate && courseEndDate < new Date());
  const displayStatus = isExpired ? "completed" : course.status;

  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center justify-between rounded-2xl border-2 border-gray-100 px-5 py-4 bg-linear-to-r from-white to-gray-50 hover:border-blue-200 hover:shadow-md transition-all duration-300 cursor-pointer"
      onClick={onDetail}
    >
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-linear-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white text-xl shadow-md">📖</div>
        <div className="text-sm">
          <p className="font-bold text-gray-900">{course.name}</p>
          <p className="text-xs text-gray-500 font-medium">GV: {course.teacher?.name || "N/A"}</p>
          {course.branch && <p className="text-[10px] text-blue-500">Chi nhánh: {course.branch.name}</p>}
        </div>
      </div>
      <div className="flex items-center gap-4 mt-3 sm:mt-0 text-sm">
        <div className="text-center">
          <p className="text-[10px] text-gray-500">Học sinh</p>
          <p className="font-bold text-gray-900">
            {course.studentIds?.length || 0}/{course.maxStudents || 30}
          </p>
        </div>
        <span
          className={`px-3 py-1 rounded-full text-[10px] font-semibold ${
            displayStatus === "active" ? "bg-emerald-100 text-emerald-700" : displayStatus === "completed" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
          }`}
        >
          {displayStatus === "active" ? "Đang mở" : displayStatus === "completed" ? "Đã kết thúc" : "Tạm dừng"}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl text-blue-600 border-blue-200 h-8 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            onStudents();
          }}
        >
          Học sinh
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl h-8 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
        >
          Sửa
        </Button>
      </div>
    </div>
  );
}
