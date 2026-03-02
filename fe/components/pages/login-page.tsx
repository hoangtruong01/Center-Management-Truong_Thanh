"use client";
import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useAuthStore,
  forgotPassword,
  contactAdmin,
  validateLogin,
} from "@/lib/stores/auth-store";
import { useBranchesStore, type Branch } from "@/lib/stores/branches-store";
import { Bounce, ToastContainer, toast } from "react-toastify";
import DarkVeil from "@/components/ui/darkveil-background";

interface LoginPageProps {
  onLogin?: (user: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    role: "student" | "teacher" | "parent" | "admin";
    branchId?: string;
    branchName?: string;
    studentCode: string;
    dateOfBirth: Date;
    gender: string;
  }) => void;
}

// Demo users để test nhanh - Tài khoản demo thật từ database
const DEMO_USERS = {
  student: {
    email: "student.an@truongthanh.edu.vn",
    password: "123456",
    name: "Nguyễn Văn An",
    code: "HS0001",
  },
  teacher: {
    email: "teacher.binh@truongthanh.edu.vn",
    password: "123456",
    name: "Trần Thị Bình",
    code: "GV0001",
  },
  parent: {
    email: "parent.hung@truongthanh.edu.vn",
    password: "123456",
    name: "Nguyễn Văn Hùng",
    code: "PH0001",
  },
  admin: {
    email: "admin@truongthanh.edu.vn",
    password: "123456",
    name: "Admin Trường Thành",
    code: "ADMIN",
  },
};

const BRANCHES = [
  { id: "cs1", name: "Cơ sở 1 - Quận 1" },
  { id: "cs2", name: "Cơ sở 2 - Quận 3" },
  { id: "cs3", name: "Cơ sở 3 - Thủ Đức" },
];

const ROLE_CONFIG = {
  student: {
    label: "Học sinh",
    icon: "🎓",
    color: "from-blue-500 to-blue-600",
    hoverColor: "hover:from-blue-600 hover:to-blue-700",
  },
  teacher: {
    label: "Giáo viên",
    icon: "👨‍🏫",
    color: "from-emerald-500 to-emerald-600",
    hoverColor: "hover:from-emerald-600 hover:to-emerald-700",
  },
  parent: {
    label: "Phụ huynh",
    icon: "👪",
    color: "from-amber-500 to-orange-500",
    hoverColor: "hover:from-amber-600 hover:to-orange-600",
  },
  admin: {
    label: "Quản trị",
    icon: "⚙️",
    color: "from-purple-500 to-purple-600",
    hoverColor: "hover:from-purple-600 hover:to-purple-700",
  },
};

type Role = "student" | "teacher" | "parent" | "admin";

// Modal types
type ModalType = "forgot-password" | "contact-admin" | null;

interface Option {
  value: string;
  label: string;
}

interface GlassSelectProps {
  label: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
}

function GlassSelect({
  label,
  value,
  onChange,
  options,
  placeholder = "-- Chọn --",
  disabled,
}: GlassSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="space-y-1 sm:space-y-2 relative" ref={containerRef}>
      <label className="text-xs sm:text-sm font-medium text-blue-100 flex items-center gap-1 sm:gap-2">
        {label}
      </label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full text-left rounded-lg sm:rounded-xl border border-white/20 bg-white/10 px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-white 
          focus:outline-none focus:border-blue-400 focus:bg-white/20 transition-all duration-200 flex items-center justify-between
          ${disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-white/20"}
          ${isOpen ? "border-blue-400 bg-white/20" : ""}
        `}
      >
        <span className={!selected ? "text-blue-200/70" : ""}>
          {selected?.label || placeholder}
        </span>
        <span className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""} opacity-70`}>
          ▼
        </span>
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 p-1 rounded-xl border border-white/20 bg-gray-900/90 backdrop-blur-xl shadow-2xl max-h-60 overflow-y-auto overflow-x-hidden animate-in fade-in zoom-in-95 duration-100 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors text-xs sm:text-sm flex items-center gap-2
                ${value === opt.value
                  ? "bg-blue-600/50 text-white font-medium"
                  : "text-gray-300 hover:bg-white/10 hover:text-white"
                }
              `}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [selectedRole, setSelectedRole] = useState<Role | "">("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [branchId, setBranchId] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  // Forgot password form
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);

  // Contact admin form
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactType, setContactType] = useState<
    "register" | "support" | "other"
  >("register");
  const [contactLoading, setContactLoading] = useState(false);
  const [contactSuccess, setContactSuccess] = useState(false);

  // Zustand stores
  const {
    login,
    isAuthenticated,
    user,
    isLoading: authLoading,
  } = useAuthStore();
  const { branches, fetchBranches } = useBranchesStore();

  // Fetch branches on mount
  useEffect(() => {
    fetchBranches().catch(console.error);
  }, [fetchBranches]);

  // Set default branchId when branches are loaded
  useEffect(() => {
    if (branches.length > 0 && !branchId) {
      setBranchId(branches[0]._id);
    }
  }, [branches, branchId]);

  // Get actual branches or fallback to demo branches
  const displayBranches =
    branches.length > 0
      ? branches.map((b) => ({ id: b._id, name: b.name }))
      : BRANCHES;

  // Handle real API login
  const handleLogin = async (
    loginEmail: string,
    loginPassword: string,
    loginRole?: Role
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      // Validate role and branch before login if role is selected
      if (loginRole && branchId) {
        const validation = await validateLogin({
          email: loginEmail,
          role: loginRole,
          branchId: branchId,
        });

        if (
          !validation.valid &&
          validation.errors &&
          validation.errors.length > 0
        ) {
          setError(validation.errors.join("\n"));
          toast.error(validation.errors[0]);
          setIsLoading(false);
          return;
        }
      }

      const userData = await login(loginEmail, loginPassword);

      // Verify role matches if selected
      if (loginRole && userData.role !== loginRole) {
        setError(
          `Vai trò không đúng. Tài khoản này có vai trò "${ROLE_CONFIG[userData.role as Role]?.label || userData.role
          }".`
        );
        toast.error("Vai trò không đúng!", {
          position: "top-right",
          autoClose: 1000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: false,
          draggable: true,
          progress: undefined,
          theme: "light",
          transition: Bounce,
        });
        setIsLoading(false);
        return;
      }

      // Verify branch matches (except for admin)
      if (
        userData.role !== "admin" &&
        branchId &&
        userData.branchId &&
        userData.branchId !== branchId
      ) {
        setError("Cơ sở không đúng. Vui lòng chọn đúng cơ sở của bạn.");
        toast.error("Cơ sở không đúng!", {
          position: "top-right",
          autoClose: 1000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: false,
          draggable: true,
          progress: undefined,
          theme: "light",
          transition: Bounce,
        });
        setIsLoading(false);
        return;
      }

      // Show success toast
      toast.success(`Chào mừng ${userData.name}!`, {
        position: "top-right",
        autoClose: 1000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: false,
        draggable: true,
        progress: undefined,
        theme: "light",
        transition: Bounce,
      });

      // If onLogin callback exists (for backward compatibility)
      if (onLogin && userData) {
        const branch = displayBranches.find((b) => b.id === userData.branchId);
        onLogin({
          id: userData._id || userData.id || "",
          name: userData.name,
          email: userData.email,
          phone: userData.phone,
          role: userData.role as Role,
          branchId: userData.branchId,
          branchName: branch?.name,
          studentCode: userData.studentCode,
          dateOfBirth: userData.dateOfBirth,
          gender: userData.gender,
        });
      }
    } catch (err: any) {
      const errorMsg = err.message || "Đăng nhập thất bại. Vui lòng thử lại.";
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async (role: Role) => {
    const demoUser = DEMO_USERS[role];
    await handleLogin(demoUser.email, demoUser.password, role);
  };

  const handleCustomLogin = async () => {
    if (!selectedRole) {
      setError("Vui lòng chọn vai trò trước khi đăng nhập.");
      toast.error("Vui lòng chọn vai trò!");
      return;
    }
    if (!branchId && selectedRole !== "admin") {
      setError("Vui lòng chọn cơ sở trước khi đăng nhập.");
      toast.error("Vui lòng chọn cơ sở!");
      return;
    }
    if (email && password) {
      await handleLogin(email, password, selectedRole);
    }
  };

  // Handle forgot password
  const handleForgotPassword = async () => {
    if (!forgotEmail) {
      toast.error("Vui lòng nhập email!");
      return;
    }
    setForgotLoading(true);
    try {
      const result = await forgotPassword(forgotEmail);
      setForgotSuccess(true);
      toast.success(result.message);
    } catch (err: any) {
      toast.error(err.message || "Có lỗi xảy ra!");
    } finally {
      setForgotLoading(false);
    }
  };

  // Handle contact admin
  const handleContactAdmin = async () => {
    if (!contactName || !contactEmail || !contactMessage) {
      toast.error("Vui lòng điền đầy đủ thông tin!");
      return;
    }
    setContactLoading(true);
    try {
      const result = await contactAdmin({
        name: contactName,
        email: contactEmail,
        phone: contactPhone,
        message: contactMessage,
        type: contactType,
      });
      setContactSuccess(true);
      toast.success(result.message);
    } catch (err: any) {
      toast.error(err.message || "Có lỗi xảy ra!");
    } finally {
      setContactLoading(false);
    }
  };

  // Reset modal state
  const closeModal = () => {
    setActiveModal(null);
    setForgotEmail("");
    setForgotSuccess(false);
    setContactName("");
    setContactEmail("");
    setContactPhone("");
    setContactMessage("");
    setContactType("register");
    setContactSuccess(false);
  };

  return (
    <div className="min-h-screen w-full relative overflow-hidden flex flex-col lg:flex-row">
      {/* Mobile Header - Gradient Banner */}
      {/* Mobile Header - Aurora Background */}
      {/* Mobile Header - Dark Veil Background */}
      <div className="fixed inset-0 z-0">
        <DarkVeil
          hueShift={339}
          noiseIntensity={0}
          scanlineIntensity={0}
          speed={1}
          scanlineFrequency={0}
          warpAmount={0}
        />
      </div>
      {/* Mobile Header - Aurora Background */}
      <div className="lg:hidden relative px-6 py-8 text-white text-center overflow-hidden z-10">
        <div className="relative z-10">
          <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
            <span className="text-3xl">🎓</span>
          </div>
          <h1 className="text-xl font-bold">Trường Thành Education</h1>
          <p className="text-sm text-blue-100 mt-1">
            Hệ thống quản lý trung tâm dạy thêm
          </p>
        </div>
      </div>

      {/* Left side - Decorative (Desktop only) */}
      {/* Left side - Content (Desktop only) */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-center overflow-hidden z-10">

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-12 text-white">
          <div className="mb-8">
            <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-6 shadow-xl">
              <span className="text-4xl">🎓</span>
            </div>
            <h1 className="text-4xl font-bold mb-4">Trường Thành Education</h1>
            <p className="text-xl text-blue-100 leading-relaxed">
              Hệ thống quản lý trung tâm dạy thêm thông minh, kết nối học sinh -
              giáo viên - phụ huynh.
            </p>
          </div>

          {/* Features */}
          <div className="space-y-4 mt-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <span className="text-2xl">📚</span>
              </div>
              <div>
                <p className="font-semibold">Quản lý lớp học</p>
                <p className="text-sm text-blue-200">
                  Theo dõi tiến độ học tập dễ dàng
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <span className="text-2xl">💬</span>
              </div>
              <div>
                <p className="font-semibold">Liên lạc trực tiếp</p>
                <p className="text-sm text-blue-200">
                  Chat với giáo viên mọi lúc
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <span className="text-2xl">📊</span>
              </div>
              <div>
                <p className="font-semibold">Báo cáo chi tiết</p>
                <p className="text-sm text-blue-200">
                  Điểm số, điểm danh, học phí
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="flex-1 lg:w-1/2 flex items-center justify-center p-4 sm:p-6 z-10 ">
        <div className="w-full max-w-md">
          <Card className="bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl p-5 sm:p-8 rounded-2xl sm:rounded-3xl">
            <div className="text-center mb-5 sm:mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-white">
                Chào mừng trở lại! 👋
              </h2>
              <p className="text-blue-100 mt-1 text-sm sm:text-base">
                Đăng nhập để tiếp tục
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-red-100 text-sm flex items-center gap-2">
                <span>⚠️</span>
                <span>{error}</span>
                <button
                  onClick={() => setError(null)}
                  className="ml-auto text-red-200 hover:text-red-100"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Demo Login Buttons */}
            <div className="mb-5 sm:mb-6">
              <p className="text-xs sm:text-sm font-medium text-blue-100 mb-2 sm:mb-3 flex items-center gap-2">
                <span className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center text-xs">
                  ⚡
                </span>
                Đăng nhập nhanh (Demo) - Mật khẩu: 123456
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-2 gap-2 sm:gap-3">
                {(["student", "teacher", "parent", "admin"] as const).map(
                  (role) => {
                    const config = ROLE_CONFIG[role];
                    const demoInfo = DEMO_USERS[role];
                    return (
                      <button
                        key={role}
                        onClick={() => handleDemoLogin(role)}
                        disabled={isLoading}
                        title={`${demoInfo.name}\n${demoInfo.email}\nMã: ${demoInfo.code}`}
                        className={`
                          relative group p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-linear-to-r ${config.color} ${config.hoverColor}
                          text-white font-medium transition-all duration-300
                          hover:shadow-lg hover:shadow-blue-200/50 hover:-translate-y-0.5
                          disabled:opacity-50 disabled:cursor-not-allowed
                          active:scale-95
                        `}
                      >
                        <div className="flex items-center gap-2 sm:gap-3">
                          <span className="text-xl sm:text-2xl">
                            {config.icon}
                          </span>
                          <div className="text-left flex-1 min-w-0">
                            <span className="text-xs sm:text-sm font-semibold block">
                              {config.label}
                            </span>
                            <span className="text-[9px] sm:text-[10px] opacity-80 block truncate">
                              {demoInfo.code}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            {/* Divider */}
            <div className="relative my-4 sm:my-6 flex items-center gap-3">
              <div className="flex-1 border-t border-white/20" />
              <span className="text-xs sm:text-sm text-blue-200">
                hoặc đăng nhập bằng email
              </span>
              <div className="flex-1 border-t border-white/20" />
            </div>

            {/* Login Form */}
            <div className="space-y-3 sm:space-y-4">
              {/* Branch & Role in one row on mobile */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-1 sm:gap-4">
                {/* Branch Select */}
                <GlassSelect
                  label={
                    <>
                      <span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-house-fill" viewBox="0 0 16 16">
                          <path d="M8.707 1.5a1 1 0 0 0-1.414 0L.646 8.146a.5.5 0 0 0 .708.708L8 2.207l6.646 6.647a.5.5 0 0 0 .708-.708L13 5.793V2.5a.5.5 0 0 0-.5-.5h-1a.5.5 0 0 0-.5.5v1.293z" />
                          <path d="m8 3.293 6 6V13.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 13.5V9.293z" />
                        </svg>
                      </span>{" "}
                      <span className="hidden sm:inline">Cơ sở</span>
                      <span className="sm:hidden">Cơ sở</span>
                    </>
                  }
                  value={branchId}
                  onChange={setBranchId}
                  options={displayBranches.map((b) => ({
                    value: b.id,
                    label: b.name,
                  }))}
                />

                {/* Role Select */}
                <GlassSelect
                  label={
                    <>
                      <span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-person-fill" viewBox="0 0 16 16">
                          <path d="M3 14s-1 0-1-1 1-4 6-4 6 3 6 4-1 1-1 1zm5-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6" />
                        </svg>
                      </span>
                      <span>Vai trò</span>
                    </>
                  }
                  value={selectedRole}
                  onChange={(val) => setSelectedRole(val as Role)}
                  options={[
                    { value: "student", label: "🎓 Học sinh" },
                    { value: "teacher", label: "👨‍🏫 Giáo viên" },
                    { value: "parent", label: "👪 Phụ huynh" },
                    { value: "admin", label: "⚙️ Quản trị" },
                  ]}
                  placeholder=" Chọn vai trò "
                />
              </div>

              {/* Email Input */}
              <div className="space-y-1 sm:space-y-2">
                <label className="text-xs sm:text-sm font-medium text-blue-100 flex items-center gap-1 sm:gap-2">
                  <span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-envelope-fill" viewBox="0 0 16 16">
                      <path d="M.05 3.555A2 2 0 0 1 2 2h12a2 2 0 0 1 1.95 1.555L8 8.414zM0 4.697v7.104l5.803-3.558zM6.761 8.83l-6.57 4.027A2 2 0 0 0 2 14h12a2 2 0 0 0 1.808-1.144l-6.57-4.027L8 9.586zm3.436-.586L16 11.801V4.697z" />
                    </svg>
                  </span>
                  Email
                </label>
                <Input
                  type="email"
                  placeholder="example@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg sm:rounded-xl border border-white/20 bg-white/10 px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-white placeholder:text-white/40
                    focus:outline-none focus:border-blue-400 focus:bg-white/20 transition-all duration-200"
                />
              </div>

              {/* Password Input */}
              <div className="space-y-1 sm:space-y-2">
                <label className="text-xs sm:text-sm font-medium text-blue-100 flex items-center gap-1 sm:gap-2">
                  <span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-lock-fill" viewBox="0 0 16 16">
                      <path fillRule="evenodd" d="M8 0a4 4 0 0 1 4 4v2.05a2.5 2.5 0 0 1 2 2.45v5a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 2 13.5v-5a2.5 2.5 0 0 1 2-2.45V4a4 4 0 0 1 4-4m0 1a3 3 0 0 0-3 3v2h6V4a3 3 0 0 0-3-3" />
                    </svg>
                  </span>
                  Mật khẩu
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg sm:rounded-xl border border-white/20 bg-white/10 px-3 sm:px-4 py-2 sm:py-3 pr-10 sm:pr-12 text-xs sm:text-sm text-white placeholder:text-white/40
                      focus:outline-none focus:border-blue-400 focus:bg-white/20 transition-all duration-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white text-sm sm:text-base"
                  >
                    {showPassword ?
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-eye-slash" viewBox="0 0 16 16">
                        <path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7 7 0 0 0-2.79.588l.77.771A6 6 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13 13 0 0 1 14.828 8q-.086.13-.195.288c-.335.48-.83 1.12-1.465 1.755q-.247.248-.517.486z" />
                        <path d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829zm-2.943 1.299.822.822a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829" />
                        <path d="M3.35 5.47q-.27.24-.518.487A13 13 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7 7 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 8.884-12-12 .708-.708 12 12z" />
                      </svg>
                      :
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-eye" viewBox="0 0 16 16">
                        <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8M1.173 8a13 13 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5s3.879 1.168 5.168 2.457A13 13 0 0 1 14.828 8q-.086.13-.195.288c-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5s-3.879-1.168-5.168-2.457A13 13 0 0 1 1.172 8z" />
                        <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5M4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0" />
                      </svg>}
                  </button>
                </div>
              </div>

              {/* Remember & Forgot */}
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-blue-100">Ghi nhớ</span>
                </label>
                <button
                  type="button"
                  onClick={() => setActiveModal("forgot-password")}
                  className="text-blue-300 hover:text-white font-medium"
                >
                  Quên mật khẩu?
                </button>
              </div>

              {/* Login Button */}
              <Button
                onClick={handleCustomLogin}
                disabled={
                  isLoading ||
                  !email ||
                  !password ||
                  !selectedRole ||
                  (!branchId && selectedRole !== "admin")
                }
                className="w-full bg-linear-to-r from-blue-600/80 to-indigo-600/80 backdrop-blur-md border border-white/20 
                  hover:bg-linear-to-r hover:from-blue-600/90 hover:to-indigo-600/90 
                  text-white font-semibold py-2.5 sm:py-3 rounded-xl shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] 
                  transition-all duration-300 hover:-translate-y-0.5 hover:shadow-blue-500/40 text-sm sm:text-base
                  disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0
                  active:scale-[0.98]"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg
                      className="animate-spin h-4 w-4 sm:h-5 sm:w-5"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Đang đăng nhập...
                  </span>
                ) : (
                  "Đăng nhập"
                )}
              </Button>
            </div>

            {/* Footer */}
            <div className="mt-4 sm:mt-6 text-center">
              <p className="text-xs sm:text-sm text-blue-200">
                Chưa có tài khoản?{" "}
                <button
                  type="button"
                  onClick={() => setActiveModal("contact-admin")}
                  className="text-blue-300 hover:text-white font-semibold"
                >
                  Liên hệ Admin
                </button>
              </p>
            </div>
          </Card>

          {/* Copyright */}
          <p className="text-center text-[10px] sm:text-xs text-blue-200/60 mt-4 sm:mt-6">
            © 2025 Trường Thành Education. All rights reserved.
          </p>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {activeModal === "forgot-password" && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className="bg-linear-to-r from-blue-600 to-indigo-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white text-lg">
                    🔐
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      Quên mật khẩu
                    </h2>
                    <p className="text-blue-100 text-sm">
                      Yêu cầu đặt lại mật khẩu
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeModal}
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

            {/* Content */}
            <div className="p-6">
              {forgotSuccess ? (
                <div className="text-center py-4">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl">✅</span>
                  </div>
                  <h3 className="font-semibold text-lg text-gray-900 mb-2">
                    Yêu cầu đã được gửi!
                  </h3>
                  <p className="text-gray-600 text-sm">
                    Admin sẽ liên hệ với bạn qua email hoặc số điện thoại đăng
                    ký để hỗ trợ đặt lại mật khẩu.
                  </p>
                  <Button
                    onClick={closeModal}
                    className="mt-4 w-full bg-linear-to-r from-blue-600 to-indigo-600 rounded-xl"
                  >
                    Đóng
                  </Button>
                </div>
              ) : (
                <>
                  <p className="text-gray-600 text-sm mb-4">
                    Nhập email đăng ký tài khoản. Admin sẽ liên hệ để hỗ trợ bạn
                    đặt lại mật khẩu.
                  </p>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-1">
                        <span>✉️</span> Email
                      </label>
                      <Input
                        type="email"
                        placeholder="email@example.com"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        className="rounded-xl"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={closeModal}
                        className="flex-1 rounded-xl"
                      >
                        Hủy
                      </Button>
                      <Button
                        onClick={handleForgotPassword}
                        disabled={forgotLoading || !forgotEmail}
                        className="flex-1 bg-linear-to-r from-blue-600 to-indigo-600 rounded-xl"
                      >
                        {forgotLoading ? "Đang gửi..." : "Gửi yêu cầu"}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Contact Admin Modal */}
      {activeModal === "contact-admin" && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="bg-linear-to-r from-purple-600 to-indigo-600 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white text-lg">
                    📞
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      Liên hệ Admin
                    </h2>
                    <p className="text-purple-100 text-sm">
                      Gửi yêu cầu hỗ trợ
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeModal}
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

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-100px)]">
              {contactSuccess ? (
                <div className="text-center py-4">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-3xl">✅</span>
                  </div>
                  <h3 className="font-semibold text-lg text-gray-900 mb-2">
                    Yêu cầu đã được gửi!
                  </h3>
                  <p className="text-gray-600 text-sm">
                    Admin sẽ liên hệ lại với bạn sớm nhất có thể. Cảm ơn bạn đã
                    quan tâm!
                  </p>
                  <Button
                    onClick={closeModal}
                    className="mt-4 w-full bg-linear-to-r from-purple-600 to-indigo-600 rounded-xl"
                  >
                    Đóng
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Contact Type */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-1">
                      <span>📋</span> Loại yêu cầu
                    </label>
                    <select
                      value={contactType}
                      onChange={(e) => setContactType(e.target.value as any)}
                      className="w-full rounded-xl border-2 border-gray-100 bg-gray-50 px-4 py-2 text-sm focus:outline-none focus:border-purple-500"
                    >
                      <option value="register">🎓 Đăng ký tài khoản mới</option>
                      <option value="support">🛠️ Hỗ trợ kỹ thuật</option>
                      <option value="other">💬 Khác</option>
                    </select>
                  </div>

                  {/* Name */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-1">
                      <span>👤</span> Họ tên{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="text"
                      placeholder="Nguyễn Văn A"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      className="rounded-xl"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-1">
                      <span>✉️</span> Email{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="email"
                      placeholder="email@example.com"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      className="rounded-xl"
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-1">
                      <span>📱</span> Số điện thoại
                    </label>
                    <Input
                      type="tel"
                      placeholder="0901234567"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      className="rounded-xl"
                    />
                  </div>

                  {/* Message */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2 mb-1">
                      <span>💬</span> Nội dung{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      placeholder={
                        contactType === "register"
                          ? "Tôi muốn đăng ký tài khoản cho con/em tôi học tại cơ sở..."
                          : "Mô tả chi tiết vấn đề của bạn..."
                      }
                      value={contactMessage}
                      onChange={(e) => setContactMessage(e.target.value)}
                      rows={4}
                      className="w-full rounded-xl border-2 border-gray-100 bg-gray-50 px-4 py-2 text-sm focus:outline-none focus:border-purple-500 resize-none"
                    />
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      onClick={closeModal}
                      className="flex-1 rounded-xl"
                    >
                      Hủy
                    </Button>
                    <Button
                      onClick={handleContactAdmin}
                      disabled={
                        contactLoading ||
                        !contactName ||
                        !contactEmail ||
                        !contactMessage
                      }
                      className="flex-1 bg-linear-to-r from-purple-600 to-indigo-600 rounded-xl"
                    >
                      {contactLoading ? "Đang gửi..." : "Gửi yêu cầu"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
