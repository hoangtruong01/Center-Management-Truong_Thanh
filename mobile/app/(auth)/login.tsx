import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { useAuthStore, useBranchesStore } from "@/lib/stores";
import { Ionicons } from "@expo/vector-icons";
import api from "@/lib/api";

const { width } = Dimensions.get("window");

// Role configuration matching web
const ROLE_CONFIG = {
  student: {
    label: "Học sinh",
    icon: "school" as const,
    colors: ["#3B82F6", "#2563EB"] as const,
  },
  teacher: {
    label: "Giáo viên",
    icon: "person" as const,
    colors: ["#10B981", "#059669"] as const,
  },
  parent: {
    label: "Phụ huynh",
    icon: "people" as const,
    colors: ["#F59E0B", "#D97706"] as const,
  },
  admin: {
    label: "Quản trị",
    icon: "settings" as const,
    colors: ["#8B5CF6", "#7C3AED"] as const,
  },
};

type Role = keyof typeof ROLE_CONFIG;

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const { login, logout, isLoading, error, clearError } = useAuthStore();
  const {
    branches,
    selectedBranch,
    fetchBranches,
    selectBranch,
    isLoading: branchesLoading,
  } = useBranchesStore();
  const [formError, setFormError] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<"email" | "password" | null>(
    null,
  );

  useEffect(() => {
    fetchBranches().catch(() => {
      // lỗi đã được hiển thị thông qua store
    });
  }, [fetchBranches]);

  useEffect(() => {
    if (error) {
      setFormError(error);
    }
  }, [error]);

  useEffect(() => {
    return () => {
      clearError();
    };
  }, [clearError]);

  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail) {
      const message = "Vui lòng nhập email";
      setFormError(message);
      Alert.alert("Thiếu thông tin", message);
      return;
    }

    if (!trimmedPassword) {
      const message = "Vui lòng nhập mật khẩu";
      setFormError(message);
      Alert.alert("Thiếu thông tin", message);
      return;
    }

    if (!selectedRole) {
      const message = "Vui lòng chọn vai trò đăng nhập";
      setFormError(message);
      Alert.alert("Thiếu thông tin", message);
      return;
    }

    if (!selectedBranch && selectedRole !== "admin") {
      const message = "Vui lòng chọn cơ sở của bạn";
      setFormError(message);
      Alert.alert("Thiếu thông tin", message);
      return;
    }

    try {
      setFormError(null);
      clearError();

      // Optional server-side validation similar to web
      if (selectedBranch) {
        try {
          const validation = await api.post("/auth/validate-login", {
            email: trimmedEmail,
            role: selectedRole,
            branchId: selectedBranch._id,
          });

          if (validation.data && validation.data.valid === false) {
            const validationMessage =
              validation.data.errors?.join("\n") ||
              "Thông tin đăng nhập chưa khớp với cơ sở đã chọn";
            setFormError(validationMessage);
            Alert.alert("Không thể đăng nhập", validationMessage);
            return;
          }
        } catch {
          // Bỏ qua lỗi validation để tiếp tục đăng nhập, sẽ được xử lý phía dưới
        }
      }

      const userData = await login(trimmedEmail, trimmedPassword);

      if (selectedRole && userData.role !== selectedRole) {
        const mismatchMessage = `Tài khoản này thuộc vai trò "${
          ROLE_CONFIG[userData.role as Role]?.label || userData.role
        }". Vui lòng chọn lại.`;
        setFormError(mismatchMessage);
        Alert.alert("Sai vai trò", mismatchMessage);
        await logout();
        return;
      }

      if (userData.branchId) {
        const matchedBranch =
          branches.find((branch) => branch._id === userData.branchId) || null;
        if (matchedBranch) {
          selectBranch(matchedBranch);
        }

        if (
          selectedBranch &&
          userData.branchId !== selectedBranch._id &&
          userData.role !== "admin"
        ) {
          Alert.alert(
            "Đã điều chỉnh cơ sở",
            "Cơ sở đã được cập nhật theo thông tin tài khoản của bạn.",
          );
        }
      }

      setFormError(null);
      // Admin goes directly to admin dashboard, others to home
      if (userData.role === "admin") {
        router.replace("/(tabs)/admin");
      } else {
        router.replace("/(tabs)");
      }
    } catch (err: any) {
      const message =
        err?.message || "Đăng nhập thất bại. Vui lòng thử lại sau.";
      setFormError(message);
      Alert.alert("Đăng nhập thất bại", message);
    }
  };

  // Branch selection modal
  const BranchModal = () => (
    <Modal
      visible={showBranchModal}
      transparent
      animationType="slide"
      onRequestClose={() => setShowBranchModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Chọn cơ sở</Text>
            <TouchableOpacity onPress={() => setShowBranchModal(false)}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.branchList}
            contentContainerStyle={styles.branchListContent}
            showsVerticalScrollIndicator={false}
          >
            {branchesLoading ? (
              <View style={styles.branchPlaceholder}>
                <ActivityIndicator size="small" color="#3B82F6" />
                <Text style={styles.branchPlaceholderText}>
                  Đang tải danh sách cơ sở...
                </Text>
              </View>
            ) : branches.length === 0 ? (
              <View style={styles.branchPlaceholder}>
                <Ionicons
                  name="alert-circle-outline"
                  size={22}
                  color="#6B7280"
                />
                <Text style={styles.branchPlaceholderText}>
                  Hiện chưa có cơ sở nào khả dụng
                </Text>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  style={[
                    styles.branchItem,
                    !selectedBranch && styles.branchItemSelected,
                  ]}
                  onPress={() => {
                    selectBranch(null);
                    setShowBranchModal(false);
                  }}
                >
                  <View style={styles.branchItemContent}>
                    <Ionicons
                      name="globe-outline"
                      size={20}
                      color={!selectedBranch ? "#3B82F6" : "#6B7280"}
                    />
                    <Text
                      style={[
                        styles.branchItemText,
                        !selectedBranch && styles.branchItemTextSelected,
                      ]}
                    >
                      Tất cả cơ sở
                    </Text>
                  </View>
                  {!selectedBranch && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color="#3B82F6"
                    />
                  )}
                </TouchableOpacity>

                {branches.map((branch) => (
                  <TouchableOpacity
                    key={branch._id}
                    style={[
                      styles.branchItem,
                      selectedBranch?._id === branch._id &&
                        styles.branchItemSelected,
                    ]}
                    onPress={() => {
                      selectBranch(branch);
                      setShowBranchModal(false);
                    }}
                  >
                    <View style={styles.branchItemContent}>
                      <Ionicons
                        name="business-outline"
                        size={20}
                        color={
                          selectedBranch?._id === branch._id
                            ? "#3B82F6"
                            : "#6B7280"
                        }
                      />
                      <View>
                        <Text
                          style={[
                            styles.branchItemText,
                            selectedBranch?._id === branch._id &&
                              styles.branchItemTextSelected,
                          ]}
                        >
                          {branch.name}
                        </Text>
                        {branch.address && (
                          <Text style={styles.branchItemAddress}>
                            {branch.address}
                          </Text>
                        )}
                      </View>
                    </View>
                    {selectedBranch?._id === branch._id && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color="#3B82F6"
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.backgroundDecor} pointerEvents="none">
        <LinearGradient
          colors={["rgba(96, 165, 250, 0.45)", "rgba(37, 99, 235, 0.25)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.backgroundCircleOne}
        />
        <LinearGradient
          colors={["rgba(16, 185, 129, 0.25)", "rgba(59, 130, 246, 0.2)"]}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.backgroundCircleTwo}
        />
      </View>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Overscroll Filler - Fixes white gap when pulling down */}
          <LinearGradient
            colors={["#3B82F6", "#3B82F6"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              position: "absolute",
              top: -1000,
              left: 0,
              right: 0,
              height: 1000,
            }}
          />

          {/* Header with Gradient */}
          <LinearGradient
            colors={["#3B82F6", "#3B82F6"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.headerGradient, { paddingTop: insets.top + 48 }]}
          >
            <View style={styles.logoContainer}>
              <View style={styles.logoCircle}>
                <Ionicons name="school" size={40} color="#3B82F6" />
              </View>
            </View>
            <Text style={styles.title}>Giáo dục Trường Thành</Text>
            <Text style={styles.subtitle}>Hệ thống quản lý trung tâm</Text>
          </LinearGradient>

          {/* Form Card */}
          <View style={styles.formCard}>
            {formError ? (
              <View style={styles.errorBanner}>
                <Ionicons
                  name="alert-circle"
                  size={22}
                  color="#DC2626"
                  style={styles.errorBannerIcon}
                />
                <Text style={styles.errorBannerText}>{formError}</Text>
                {!isLoading && (
                  <TouchableOpacity
                    onPress={() => setFormError(null)}
                    style={styles.errorBannerClose}
                    accessibilityLabel="Đóng thông báo lỗi"
                  >
                    <Ionicons name="close" size={20} color="#DC2626" />
                  </TouchableOpacity>
                )}
              </View>
            ) : null}

            <Text style={styles.formTitle}>Đăng nhập</Text>
            <Text style={styles.formSubtitle}>
              Chọn cơ sở và nhập thông tin đăng nhập
            </Text>

            {/* Branch Selector */}
            <Text style={styles.sectionLabel}>Cơ sở</Text>
            <TouchableOpacity
              style={styles.branchSelector}
              onPress={() => setShowBranchModal(true)}
              activeOpacity={0.7}
            >
              <View style={styles.branchSelectorContent}>
                <Ionicons name="business-outline" size={20} color="#6B7280" />
                <Text style={styles.branchSelectorText}>
                  {selectedBranch?.name || "Tất cả cơ sở"}
                </Text>
              </View>
              {branchesLoading ? (
                <ActivityIndicator size="small" color="#3B82F6" />
              ) : (
                <Ionicons name="chevron-down" size={20} color="#6B7280" />
              )}
            </TouchableOpacity>

            {/* Role Selection */}
            <Text style={styles.sectionLabel}>Chọn vai trò</Text>
            <View style={styles.roleGrid}>
              {(Object.keys(ROLE_CONFIG) as Role[]).map((role) => {
                const config = ROLE_CONFIG[role];
                const isSelected = selectedRole === role;
                return (
                  <TouchableOpacity
                    key={role}
                    style={[
                      styles.roleCard,
                      isSelected && styles.roleCardSelected,
                    ]}
                    onPress={() => setSelectedRole(role)}
                    activeOpacity={0.7}
                  >
                    <LinearGradient
                      colors={
                        isSelected ? config.colors : ["#F3F4F6", "#E5E7EB"]
                      }
                      style={styles.roleIconBg}
                    >
                      <Ionicons
                        name={config.icon}
                        size={22}
                        color={isSelected ? "#FFFFFF" : "#6B7280"}
                      />
                    </LinearGradient>
                    <Text
                      style={[
                        styles.roleLabel,
                        isSelected && styles.roleLabelSelected,
                      ]}
                    >
                      {config.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Email Input */}
            <Text style={styles.inputLabel}>Email</Text>
            <View
              style={[
                styles.inputContainer,
                focusedField === "email" && styles.inputContainerFocused,
              ]}
            >
              <Ionicons
                name="mail-outline"
                size={20}
                color="#6B7280"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Nhập email của bạn"
                placeholderTextColor="#9CA3AF"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                onFocus={() => setFocusedField("email")}
                onBlur={() => setFocusedField(null)}
              />
            </View>

            {/* Password Input */}
            <Text style={styles.inputLabel}>Mật khẩu</Text>
            <View
              style={[
                styles.inputContainer,
                focusedField === "password" && styles.inputContainerFocused,
              ]}
            >
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color="#6B7280"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Nhập mật khẩu"
                placeholderTextColor="#9CA3AF"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                onFocus={() => setFocusedField("password")}
                onBlur={() => setFocusedField(null)}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
              >
                <Ionicons
                  name={showPassword ? "eye-outline" : "eye-off-outline"}
                  size={20}
                  color="#6B7280"
                />
              </TouchableOpacity>
            </View>

            {/* Forgot Password */}
            <TouchableOpacity style={styles.forgotPassword}>
              <Text style={styles.forgotPasswordText}>Quên mật khẩu?</Text>
            </TouchableOpacity>

            {/* Login Button */}
            <TouchableOpacity
              style={[
                styles.loginButton,
                isLoading && styles.loginButtonDisabled,
              ]}
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={["#3B82F6", "#2563EB"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.loginGradient}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.loginButtonText}>Đăng nhập</Text>
                    <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Help Links */}
            <View style={styles.helpLinks}>
              <TouchableOpacity style={styles.helpLink}>
                <Ionicons
                  name="help-circle-outline"
                  size={18}
                  color="#6B7280"
                />
                <Text style={styles.helpLinkText}>Trợ giúp</Text>
              </TouchableOpacity>
              <View style={styles.helpDivider} />
              <TouchableOpacity style={styles.helpLink}>
                <Ionicons name="chatbubble-outline" size={18} color="#6B7280" />
                <Text style={styles.helpLinkText}>Liên hệ admin</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>© 2026 Giáo dục Trường Thành</Text>
            <Text style={styles.footerVersion}>Phiên bản 1.0.0</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Branch Modal */}
      <BranchModal />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  backgroundDecor: {
    ...StyleSheet.absoluteFillObject,
  },
  backgroundCircleOne: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    top: -80,
    right: -60,
  },
  backgroundCircleTwo: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    bottom: -120,
    left: -80,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 48,
  },
  headerGradient: {
    paddingBottom: 64,
    paddingHorizontal: 24,
    alignItems: "center",
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
  },
  logoContainer: {
    marginBottom: 16,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.9)",
    textAlign: "center",
  },
  formCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 20,
    marginTop: -36,
    borderRadius: 28,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 10,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FEE2E2",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    padding: 12,
    marginBottom: 18,
    gap: 10,
  },
  errorBannerIcon: {
    marginTop: 2,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: "#991B1B",
    fontWeight: "500",
  },
  errorBannerClose: {
    padding: 4,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1F2937",
    textAlign: "center",
    marginBottom: 6,
  },
  formSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 10,
  },
  branchSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 20,
  },
  branchSelectorContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  branchSelectorText: {
    fontSize: 15,
    color: "#1F2937",
    fontWeight: "500",
  },
  roleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 20,
    gap: 12,
  },
  roleCard: {
    width: "48%",
    backgroundColor: "#F9FAFB",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#E5E7EB",
  },
  roleCardSelected: {
    borderColor: "#3B82F6",
    backgroundColor: "#EFF6FF",
  },
  roleIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  roleLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  roleLabelSelected: {
    color: "#3B82F6",
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 10,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 16,
    paddingHorizontal: 16,
    height: 56,
  },
  inputContainerFocused: {
    borderColor: "#3B82F6",
    backgroundColor: "#EEF2FF",
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: Platform.OS === "ios" ? 0.1 : 0,
    shadowRadius: 10,
    elevation: Platform.OS === "android" ? 3 : 0,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#1F2937",
  },
  eyeIcon: {
    padding: 4,
  },
  forgotPassword: {
    alignSelf: "flex-end",
    marginBottom: 24,
    marginTop: -8,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: "#3B82F6",
    fontWeight: "600",
  },
  loginButton: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 24,
  },
  loginGradient: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 18,
    gap: 10,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  helpLinks: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  helpLink: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 6,
  },
  helpLinkText: {
    fontSize: 14,
    color: "#6B7280",
  },
  helpDivider: {
    width: 1,
    height: 20,
    backgroundColor: "#E5E7EB",
  },
  footer: {
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 16,
  },
  footerText: {
    fontSize: 13,
    color: "#9CA3AF",
    marginBottom: 4,
  },
  footerVersion: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "70%",
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1F2937",
  },
  branchList: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  branchListContent: {
    paddingBottom: 24,
  },
  branchItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginVertical: 4,
    borderRadius: 14,
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  branchItemSelected: {
    backgroundColor: "#EFF6FF",
    borderColor: "#3B82F6",
  },
  branchItemContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flex: 1,
  },
  branchItemText: {
    fontSize: 16,
    color: "#1F2937",
    fontWeight: "500",
  },
  branchItemTextSelected: {
    color: "#3B82F6",
    fontWeight: "600",
  },
  branchItemAddress: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  branchPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    gap: 10,
  },
  branchPlaceholderText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
  },
});
