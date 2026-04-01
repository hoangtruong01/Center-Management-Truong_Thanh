"use client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface BranchesTabProps {
  branches: any[];
  branchesLoading: boolean;
  handleAddBranch: () => void;
  handleEditBranch: (branch: any) => void;
  handleDeleteBranch: (id: string) => void;
}

export default function BranchesTab({
  branches,
  branchesLoading,
  handleAddBranch,
  handleEditBranch,
  handleDeleteBranch,
}: BranchesTabProps) {
  return (
    <div className="mt-6">
      <Card className="p-6 space-y-5 bg-white border-0 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏢</span>
            <div>
              <p className="font-bold text-gray-900 text-lg">Quản lý cơ sở</p>
              <p className="text-xs text-gray-500">Thêm, sửa, xóa các cơ sở của trung tâm</p>
            </div>
          </div>
          <Button
            className="bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-lg shadow-blue-200"
            onClick={handleAddBranch}
          >
            ➕ Thêm cơ sở mới
          </Button>
        </div>

        {/* Danh sách cơ sở */}
        <div className="space-y-4">
          {branchesLoading ? (
            <div className="text-center py-8 text-gray-500">
              <span className="animate-spin inline-block mr-2">⏳</span> Đang tải...
            </div>
          ) : branches.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <span className="text-5xl mb-4 block">🏢</span>
              <p className="font-medium">Chưa có cơ sở nào</p>
            </div>
          ) : (
            branches.map((branch) => (
              <div
                key={branch._id}
                className="flex items-center justify-between rounded-2xl border-2 border-gray-100 px-5 py-4 hover:border-blue-200 hover:shadow-md transition-all duration-300 bg-linear-to-r from-white to-gray-50"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-linear-to-br from-blue-100 to-indigo-100 flex items-center justify-center text-2xl">🏢</div>
                  <div className="text-sm">
                    <p className="font-bold text-gray-900">{branch.name}</p>
                    <p className="text-xs text-gray-500 flex items-center gap-1">📍 {branch.address}</p>
                    {branch.phone && <p className="text-[10px] text-gray-400 flex items-center gap-1">📞 {branch.phone}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      branch.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {branch.status === "active" ? "Hoạt động" : "Tạm ngưng"}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl text-blue-600 border-blue-200 h-8 text-xs"
                    onClick={() => handleEditBranch(branch)}
                  >
                    Sửa
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl text-red-600 border-red-200 h-8 text-xs"
                    onClick={() => handleDeleteBranch(branch._id)}
                  >
                    Xóa
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
