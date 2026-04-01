"use client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface UsersTabProps {
  isAdmin: boolean;
  effectiveBranchFilter: string;
  getBranchName: (id?: string) => string;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  setShowImportModal: (show: boolean) => void;
  setShowModal: (modal: any) => void;
  activeAccountTab: "students" | "parents" | "teachers";
  setActiveAccountTab: (tab: "students" | "parents" | "teachers") => void;
  branches: any[];
  selectedBranchFilter: string;
  setSelectedBranchFilter: (id: string) => void;
  scholarshipFilter: "all" | "has" | "none";
  setScholarshipFilter: (filter: "all" | "has" | "none") => void;
  scholarshipTypeFilter: "all" | "teacher_child" | "poor_family" | "orphan";
  setScholarshipTypeFilter: (filter: "all" | "teacher_child" | "poor_family" | "orphan") => void;
  apiStudents: any[];
  apiParents: any[];
  apiTeachers: any[];
  usersLoading: boolean;
  setSelectedUserDetail: (user: any) => void;
}

export default function UsersTab({
  isAdmin,
  effectiveBranchFilter,
  getBranchName,
  searchQuery,
  setSearchQuery,
  setShowImportModal,
  setShowModal,
  activeAccountTab,
  setActiveAccountTab,
  branches,
  selectedBranchFilter,
  setSelectedBranchFilter,
  scholarshipFilter,
  setScholarshipFilter,
  scholarshipTypeFilter,
  setScholarshipTypeFilter,
  apiStudents,
  apiParents,
  apiTeachers,
  usersLoading,
  setSelectedUserDetail,
}: UsersTabProps) {
  return (
    <div className="mt-6">
      <Card className="p-6 space-y-5 bg-white border-0 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">👥</span>
            <div>
              <p className="font-bold text-gray-900 text-lg">Quản lý tài khoản</p>
              <p className="text-xs text-gray-500">
                Học sinh, phụ huynh và giáo viên
                {!isAdmin && effectiveBranchFilter && (
                  <span className="ml-2 text-blue-600 font-medium">
                    • {getBranchName(effectiveBranchFilter)}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Branch Filter - Chỉ hiển thị cho Admin */}
          {isAdmin && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600">🏢 Cơ sở:</span>
                <select
                  value={selectedBranchFilter}
                  onChange={(e) => setSelectedBranchFilter(e.target.value)}
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
            </div>
          )}

          {/* Badge hiển thị chi nhánh cho non-admin */}
          {!isAdmin && effectiveBranchFilter && (
            <div className="flex items-center">
              <span className="text-sm bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full font-medium">
                🏢 {getBranchName(effectiveBranchFilter)}
              </span>
            </div>
          )}

          {/* Thanh tìm kiếm */}
          <div className="w-full sm:w-auto text-sm">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
              <Input
                type="text"
                placeholder="Tìm kiếm theo tên, email, SĐT..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-8 w-full sm:w-70 rounded-xl border-gray-200 focus:ring-2 focus:ring-blue-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="rounded-xl border-green-500 text-green-600 hover:bg-green-50"
              onClick={() => setShowImportModal(true)}
            >
              📤 Import
            </Button>
            <Button
              className="bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-lg shadow-blue-200"
              onClick={() =>
                setShowModal(
                  activeAccountTab === "students"
                    ? {
                        title: "Thêm học sinh",
                        fields: ["Họ và tên", "Email", "Số điện thoại", "Tên phụ huynh", "SĐT phụ huynh"],
                      }
                    : activeAccountTab === "parents"
                      ? {
                          title: "Thêm phụ huynh",
                          fields: ["Họ và tên", "Email", "Số điện thoại", "Email con (học sinh)"],
                        }
                      : {
                          title: "Thêm giáo viên",
                          fields: ["Họ và tên", "Email", "Số điện thoại", "Môn dạy"],
                        },
                )
              }
            >
              ➕ Thêm mới
            </Button>
          </div>
        </div>

        {/* Account Type Tabs */}
        <div className="grid grid-cols-3 gap-2 rounded-xl bg-gray-100 p-1">
          <button
            onClick={() => setActiveAccountTab("students")}
            className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
              activeAccountTab === "students" ? "bg-white text-blue-700 shadow-sm" : "text-gray-600 hover:bg-white/50"
            }`}
          >
            <span>👨‍🎓</span>
            <span>Học sinh ({apiStudents.length})</span>
          </button>
          <button
            onClick={() => setActiveAccountTab("parents")}
            className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
              activeAccountTab === "parents" ? "bg-white text-blue-700 shadow-sm" : "text-gray-600 hover:bg-white/50"
            }`}
          >
            <span>👨‍👩‍👧</span>
            <span>Phụ huynh ({apiParents.length})</span>
          </button>
          <button
            onClick={() => setActiveAccountTab("teachers")}
            className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
              activeAccountTab === "teachers" ? "bg-white text-blue-700 shadow-sm" : "text-gray-600 hover:bg-white/50"
            }`}
          >
            <span>👨‍🏫</span>
            <span>Giáo viên ({apiTeachers.length})</span>
          </button>
        </div>

        {activeAccountTab === "students" && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">🎓 Học bổng:</span>
              <select
                value={scholarshipFilter}
                onChange={(e) => setScholarshipFilter(e.target.value as any)}
                className="nice-select rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm"
              >
                <option value="all">Tất cả</option>
                <option value="has">Có học bổng</option>
                <option value="none">Không học bổng</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Loại:</span>
              <select
                value={scholarshipTypeFilter}
                onChange={(e) => setScholarshipTypeFilter(e.target.value as any)}
                disabled={scholarshipFilter === "none"}
                className="nice-select rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm disabled:opacity-60"
              >
                <option value="all">Tất cả loại</option>
                <option value="teacher_child">Con giáo viên</option>
                <option value="poor_family">Hộ nghèo</option>
                <option value="orphan">Con mồ côi</option>
              </select>
            </div>
            {(scholarshipFilter !== "all" || scholarshipTypeFilter !== "all") && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setScholarshipFilter("all");
                  setScholarshipTypeFilter("all");
                }}
                className="rounded-lg"
              >
                Xóa lọc
              </Button>
            )}
          </div>
        )}

        {/* Account List */}
        <div className="space-y-3">
          {usersLoading ? (
            <div className="text-center py-8 text-gray-500">
              <span className="animate-spin inline-block mr-2">⏳</span> Đang tải...
            </div>
          ) : (
            <>
              {activeAccountTab === "students" &&
                (apiStudents.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">Chưa có dữ liệu</div>
                ) : (
                  apiStudents.map((s) => (
                    <UserRow key={s._id} user={s} isAdmin={isAdmin} getBranchName={getBranchName} onDetail={setSelectedUserDetail} />
                  ))
                ))}
              {activeAccountTab === "parents" &&
                (apiParents.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">Chưa có dữ liệu</div>
                ) : (
                  apiParents.map((p) => (
                    <UserRow key={p._id} user={p} isAdmin={isAdmin} getBranchName={getBranchName} onDetail={setSelectedUserDetail} />
                  ))
                ))}
              {activeAccountTab === "teachers" &&
                (apiTeachers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">Chưa có dữ liệu</div>
                ) : (
                  apiTeachers.map((t) => (
                    <UserRow key={t._id} user={t} isAdmin={isAdmin} getBranchName={getBranchName} onDetail={setSelectedUserDetail} />
                  ))
                ))}
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

function UserRow({ user, isAdmin, getBranchName, onDetail }: { user: any; isAdmin: boolean; getBranchName: any; onDetail: any }) {
  const isTeacher = user.role === "teacher";
  const isStudent = user.role === "student";
  const isParent = user.role === "parent";

  const icon = isStudent ? "👨‍🎓" : isParent ? "👨‍👩‍👧" : "👨‍🏫";
  const gradient = isStudent ? "from-blue-100 to-indigo-100" : isParent ? "from-emerald-100 to-green-100" : "from-purple-100 to-violet-100";

  return (
    <div className="flex items-center justify-between rounded-2xl border-2 border-gray-100 px-5 py-4 hover:border-blue-200 hover:shadow-md transition-all duration-300 bg-linear-to-r from-white to-gray-50">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-full bg-linear-to-br ${gradient} flex items-center justify-center text-2xl`}>{icon}</div>
        <div className="text-sm">
          <p className="font-bold text-gray-900">{user.name}</p>
          <p className="text-xs text-gray-500">{user.email}</p>
          <p className="text-xs text-gray-400">
            {user.phone || "N/A"} • {isStudent ? "MSHS" : isTeacher ? "MSGV" : "MSPH"}: {user.studentCode || user.teacherCode || user.parentCode || user._id?.slice(-6)}
          </p>
          {isStudent && user.hasScholarship && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-medium mt-1">
              🎓 {user.scholarshipPercent}%
            </span>
          )}
          {isAdmin && <p className="text-[10px] text-blue-600 font-medium mt-1">🏢 {getBranchName(user.branchId)}</p>}
        </div>
      </div>
      <div className="text-right">
        <p className="text-[10px] text-gray-500">{user.createdAt ? new Date(user.createdAt).toLocaleDateString("vi-VN") : ""}</p>
        <Button variant="outline" size="sm" className="mt-2 rounded-lg text-xs h-8" onClick={() => onDetail(user)}>
          Chi tiết
        </Button>
      </div>
    </div>
  );
}
