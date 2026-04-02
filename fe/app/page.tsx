"use client";

import { useEffect, useState } from "react";
import LoginPage from "@/components/pages/login-page";
import StudentDashboard from "@/components/dashboards/student-dashboard";
import TeacherDashboard from "@/components/dashboards/teacher-dashboard";
import ParentDashboard from "@/components/dashboards/parent-dashboard";
import AdminDashboard from "@/components/dashboards/admin-dashboard";
import ChangePasswordModal from "@/components/pages/change-password-modal";
import { useAuthStore } from "@/lib/stores/auth-store";

export default function Home() {
  const { user, isAuthenticated, logout, isLoading, mustChangePassword } =
    useAuthStore();
  const [isHydrated, setIsHydrated] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);

  // Wait for client-side mounting
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Show change password modal when mustChangePassword is true
  const shouldShowChangePasswordModal = isHydrated && isAuthenticated && mustChangePassword && user?.role !== "admin";

  useEffect(() => {
    if (shouldShowChangePasswordModal) {
      setShowChangePasswordModal(true);
    }
  }, [shouldShowChangePasswordModal]);

  const handleLogout = async () => {
    await logout();
  };

  const handlePasswordChanged = () => {
    setShowChangePasswordModal(false);
  };

  // Show loading while hydrating
  if (!isHydrated || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-[#89CFF0]/30 to-white">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Đang tải...</p>
        </div>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!isAuthenticated || !user) {
    return <LoginPage />;
  }

  // Map user to the format dashboards expect
  const currentUser = {
    id: user._id || user.id || "",
    name: user.name,
    email: user.email,
    role: user.role || "student",
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    studentCode: user.studentCode || "",
    teacherCode: user.teacherCode || "",
    parentCode: user.parentCode || "",
    gender: user.gender || "other",
    dateOfBirth: user.dateOfBirth,
    parentName: user.parentName,
    parentPhone: user.parentPhone,
    childEmail: user.childEmail,
  };

  return (
    <div>
      {/* Change Password Modal - appears on first login for non-admin users */}
      <ChangePasswordModal
        isOpen={showChangePasswordModal}
        onSuccess={handlePasswordChanged}
      />

      {user.role === "student" && (
        <StudentDashboard user={currentUser} onLogout={handleLogout} />
      )}
      {user.role === "teacher" && (
        <TeacherDashboard user={currentUser} onLogout={handleLogout} />
      )}
      {user.role === "parent" && (
        <ParentDashboard user={currentUser} onLogout={handleLogout} />
      )}
      {user.role === "admin" && (
        <AdminDashboard user={currentUser} onLogout={handleLogout} />
      )}
    </div>
  );
}
