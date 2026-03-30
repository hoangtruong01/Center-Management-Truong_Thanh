import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Alert,
  Linking,
  AppState,
  AppStateStatus,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import {
  usePaymentsStore,
  PaymentMethod,
  CreatePaymentResult,
} from "@/lib/stores/payments-store";
import { StudentPaymentRequest } from "@/lib/stores/payment-requests-store";
import api from "@/lib/api";

// ==========================================================================
// Types
// ==========================================================================
interface PaymentModalProps {
  visible: boolean;
  onClose: () => void;
  request: StudentPaymentRequest | null;
  onSuccess: () => void;
}

// ==========================================================================
// Payment method configs
// ==========================================================================
const ENABLE_FAKE_PAYMENT =
  process.env.EXPO_PUBLIC_ENABLE_FAKE_PAYMENT === "true";

const PAYMENT_METHODS: Array<{
  id: PaymentMethod;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  colors: [string, string];
  iconBg: string;
}> = [
  {
    id: "PAYOS",
    label: "PayOS",
    description: "Thanh toán online – QR Code / Banking App",
    icon: "qr-code-outline",
    colors: ["#2563EB", "#1D4ED8"],
    iconBg: "#DBEAFE",
  },
  ...(ENABLE_FAKE_PAYMENT
    ? [
        {
          id: "FAKE" as PaymentMethod,
          label: "Thanh toán Demo",
          description: "Giả lập thanh toán (dùng để kiểm tra)",
          icon: "laptop-outline" as keyof typeof Ionicons.glyphMap,
          colors: ["#7C3AED", "#6D28D9"] as [string, string],
          iconBg: "#EDE9FE",
        },
      ]
    : []),
  {
    id: "CASH",
    label: "Tiền mặt",
    description: "Thanh toán tại quầy thu ngân trung tâm",
    icon: "cash-outline",
    colors: ["#059669", "#047857"],
    iconBg: "#D1FAE5",
  },
];

// ==========================================================================
// Format helpers
// ==========================================================================
const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);

// ==========================================================================
// Main component
// ==========================================================================
export default function PaymentModal({
  visible,
  onClose,
  request,
  onSuccess,
}: PaymentModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(
    null,
  );
  const [step, setStep] = useState<
    "select" | "processing" | "fake_confirm" | "payos_waiting"
  >("select");
  const [pendingFake, setPendingFake] = useState<{ paymentId: string } | null>(
    null,
  );
  const [pendingPayOS, setPendingPayOS] = useState<{
    paymentId: string;
  } | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Use ref to avoid stale closure in setInterval
  const pendingPayOSRef = useRef<{ paymentId: string } | null>(null);
  const isPollingRef = useRef(false);

  const { createPayment, confirmFakePayment, isLoading } = usePaymentsStore();

  // -------------------------------------------------------------------------
  // Cleanup polling on unmount
  // -------------------------------------------------------------------------
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // Listen for app returning from background (after PayOS browser)
  useEffect(() => {
    if (step !== "payos_waiting") return;

    const subscription = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        if (
          appStateRef.current.match(/inactive|background/) &&
          nextState === "active"
        ) {
          // User came back from browser → start polling
          startPolling();
        }
        appStateRef.current = nextState;
      },
    );

    return () => subscription.remove();
  }, [step, pendingPayOS]);

  // -------------------------------------------------------------------------
  // Poll payment status (for PayOS return)
  // -------------------------------------------------------------------------
  const checkPaymentStatus = async (paymentId: string): Promise<boolean> => {
    try {
      const res = await api.get(`/payments/${paymentId}`);
      const payment = res.data;

      if (payment.status === "success") {
        stopPolling();
        Alert.alert(
          "✅ Thanh toán thành công!",
          "Giao dịch của bạn đã được xác nhận.",
          [
            {
              text: "Đóng",
              onPress: () => {
                handleClose();
                onSuccess();
              },
            },
          ],
        );
        return true;
      }
      if (payment.status === "cancelled") {
        stopPolling();
        Alert.alert("❌ Giao dịch đã bị huỷ", "Thanh toán không thành công.", [
          { text: "Đóng", onPress: handleClose },
        ]);
        return true;
      }
      return false;
    } catch (e: any) {
      return false;
    }
  };

  const startPolling = async () => {
    // Guard: don't start if already polling or no paymentId
    if (isPollingRef.current) return;
    const paymentId = pendingPayOSRef.current?.paymentId;
    if (!paymentId) {
      return;
    }

    isPollingRef.current = true;
    setIsPolling(true);

    // Check immediately first (don't wait 3s)
    const done = await checkPaymentStatus(paymentId);
    if (done) return;

    // Then poll every 3s up to 10 times
    let count = 0;
    pollIntervalRef.current = setInterval(async () => {
      count++;
      const finished = await checkPaymentStatus(paymentId);
      if (finished || count >= 10) stopPolling();
    }, 3000);
  };

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    isPollingRef.current = false;
    setIsPolling(false);
  };

  // Reset when closed
  const handleClose = () => {
    stopPolling();
    setSelectedMethod(null);
    setStep("select");
    setPendingFake(null);
    setPendingPayOS(null);
    pendingPayOSRef.current = null;
    onClose();
  };

  // -------------------------------------------------------------------------
  // Main handler
  // -------------------------------------------------------------------------
  const handlePay = async () => {
    if (!selectedMethod || !request) return;
    if (selectedMethod === "FAKE" && !ENABLE_FAKE_PAYMENT) {
      Alert.alert(
        "Không khả dụng",
        "Phương thức demo đã bị tắt trên môi trường này.",
      );
      return;
    }

    try {
      setStep("processing");
      const result: CreatePaymentResult = await createPayment({
        requestIds: [request._id],
        method: selectedMethod,
      });

      if (selectedMethod === "PAYOS") {
        const url = result.paymentUrl;
        if (!url) throw new Error("Không nhận được link PayOS");
        // Store paymentId in BOTH state and ref (ref avoids stale closure)
        const payInfo = { paymentId: result.paymentId };
        setPendingPayOS(payInfo);
        pendingPayOSRef.current = payInfo;
        // Open in browser
        await Linking.openURL(url);
        // Switch to waiting screen
        setStep("payos_waiting");
      } else if (selectedMethod === "FAKE") {
        // FAKE: Don't open URL (localhost won't work on phone)
        // Just show confirm buttons directly
        setPendingFake({ paymentId: result.paymentId });
        setStep("fake_confirm");
      } else {
        // CASH
        Alert.alert(
          "✅ Đã tạo yêu cầu tiền mặt",
          "Vui lòng đến quầy thu ngân của trung tâm để hoàn tất thanh toán.\n\nMã giao dịch: " +
            result.paymentId,
          [
            {
              text: "Đóng",
              onPress: () => {
                handleClose();
                onSuccess();
              },
            },
          ],
        );
      }
    } catch (err: any) {
      Alert.alert("Lỗi", err.message || "Có lỗi xảy ra khi tạo giao dịch");
      setStep("select");
    }
  };

  // -------------------------------------------------------------------------
  // Fake payment confirm
  // -------------------------------------------------------------------------
  const handleFakeConfirm = async (status: "SUCCESS" | "CANCELLED") => {
    if (!pendingFake) return;
    try {
      setStep("processing");
      const result = await confirmFakePayment(pendingFake.paymentId, status);
      if (status === "SUCCESS") {
        Alert.alert("✅ Thanh toán thành công!", result.message, [
          {
            text: "Đóng",
            onPress: () => {
              handleClose();
              onSuccess();
            },
          },
        ]);
      } else {
        Alert.alert("❌ Đã huỷ giao dịch", result.message, [
          { text: "Đóng", onPress: handleClose },
        ]);
      }
    } catch (err: any) {
      Alert.alert("Lỗi", err.message);
      setStep("select");
    }
  };

  if (!request) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <View style={styles.sheet}>
        {/* Handle bar */}
        <View style={styles.handleBar} />

        {/* ---- STEP: SELECT METHOD ---- */}
        {step === "select" && (
          <>
            {/* Header */}
            <View style={styles.header}>
              <View>
                <Text style={styles.headerTitle}>💳 Thanh toán học phí</Text>
                <Text style={styles.headerSub} numberOfLines={1}>
                  {request.title}
                </Text>
              </View>
              <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {/* Amount card */}
            <LinearGradient
              colors={["#1E40AF", "#2563EB"]}
              style={styles.amountCard}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.amountLabel}>Số tiền cần thanh toán</Text>
              <Text style={styles.amountValue}>
                {formatCurrency(request.finalAmount)}
              </Text>
              {request.scholarshipPercent > 0 && (
                <View style={styles.discountChip}>
                  <Ionicons name="pricetag" size={12} color="#10B981" />
                  <Text style={styles.discountChipText}>
                    Đã giảm {request.scholarshipPercent}% học bổng
                  </Text>
                </View>
              )}
            </LinearGradient>

            {/* Method list */}
            <Text style={styles.sectionTitle}>Chọn phương thức thanh toán</Text>
            {PAYMENT_METHODS.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={[
                  styles.methodCard,
                  selectedMethod === m.id && styles.methodCardSelected,
                ]}
                onPress={() => setSelectedMethod(m.id)}
                activeOpacity={0.75}
              >
                <View
                  style={[styles.methodIcon, { backgroundColor: m.iconBg }]}
                >
                  <Ionicons name={m.icon} size={22} color={m.colors[0]} />
                </View>
                <View style={styles.methodInfo}>
                  <Text style={styles.methodLabel}>{m.label}</Text>
                  <Text style={styles.methodDesc}>{m.description}</Text>
                </View>
                <View
                  style={[
                    styles.radioOuter,
                    selectedMethod === m.id && {
                      borderColor: m.colors[0],
                    },
                  ]}
                >
                  {selectedMethod === m.id && (
                    <View
                      style={[
                        styles.radioInner,
                        { backgroundColor: m.colors[0] },
                      ]}
                    />
                  )}
                </View>
              </TouchableOpacity>
            ))}

            {/* Pay button */}
            <TouchableOpacity
              style={[styles.payBtn, !selectedMethod && styles.payBtnDisabled]}
              disabled={!selectedMethod}
              onPress={handlePay}
              activeOpacity={0.85}
            >
              {selectedMethod ? (
                <LinearGradient
                  colors={
                    PAYMENT_METHODS.find((m) => m.id === selectedMethod)
                      ?.colors ?? ["#2563EB", "#1D4ED8"]
                  }
                  style={styles.payBtnGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Ionicons name="wallet" size={20} color="#fff" />
                  <Text style={styles.payBtnText}>
                    Thanh toán{" "}
                    {selectedMethod === "PAYOS"
                      ? "qua PayOS"
                      : selectedMethod === "FAKE"
                        ? "Demo"
                        : "Tiền mặt"}
                  </Text>
                </LinearGradient>
              ) : (
                <View style={styles.payBtnInner}>
                  <Text style={[styles.payBtnText, { color: "#9CA3AF" }]}>
                    Chọn phương thức để tiếp tục
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </>
        )}

        {/* ---- STEP: PROCESSING ---- */}
        {step === "processing" && (
          <View style={styles.processingContainer}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.processingTitle}>Đang xử lý...</Text>
            <Text style={styles.processingDesc}>
              Vui lòng không tắt ứng dụng
            </Text>
          </View>
        )}

        {/* ---- STEP: FAKE CONFIRM ---- */}
        {step === "fake_confirm" && pendingFake && (
          <>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>🧪 Xác nhận Demo Payment</Text>
            </View>

            <View style={styles.fakeInfoBox}>
              <Ionicons name="laptop-outline" size={40} color="#7C3AED" />
              <Text style={styles.fakeInfoTitle}>
                Giả lập kết quả thanh toán
              </Text>
              <Text style={styles.fakeInfoDesc}>
                Chọn kết quả để mô phỏng giao dịch demo:
              </Text>
              <Text style={styles.fakeTxnId}>
                Mã GD: {pendingFake.paymentId.slice(-8).toUpperCase()}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.fakeSuccessBtn}
              onPress={() => handleFakeConfirm("SUCCESS")}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={["#059669", "#047857"]}
                style={styles.fakeBtnGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.fakeBtnText}>✅ Xác nhận thành công</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.fakeCancelBtn}
              onPress={() => handleFakeConfirm("CANCELLED")}
              activeOpacity={0.85}
            >
              <Ionicons name="close-circle-outline" size={20} color="#EF4444" />
              <Text style={styles.fakeCancelText}>❌ Huỷ giao dịch</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ---- STEP: PAYOS WAITING ---- */}
        {step === "payos_waiting" && pendingPayOS && (
          <>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>📱 Đang chờ thanh toán</Text>
            </View>

            <View style={styles.fakeInfoBox}>
              {isPolling ? (
                <ActivityIndicator size="large" color="#2563EB" />
              ) : (
                <Ionicons name="qr-code-outline" size={48} color="#2563EB" />
              )}
              <Text style={styles.fakeInfoTitle}>
                {isPolling ? "Đang kiểm tra..." : "Đã mở trang PayOS"}
              </Text>
              <Text style={styles.fakeInfoDesc}>
                {isPolling
                  ? "Hệ thống đang xác nhận giao dịch của bạn"
                  : "Hoàn tất thanh toán trên trình duyệt rồi nhấn nút bên dưới"}
              </Text>
              <Text style={styles.fakeTxnId}>
                Mã GD: {pendingPayOS.paymentId.slice(-8).toUpperCase()}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.fakeSuccessBtn, isPolling && { opacity: 0.6 }]}
              onPress={startPolling}
              disabled={isPolling}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={["#2563EB", "#1D4ED8"]}
                style={styles.fakeBtnGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                {isPolling ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons
                    name="checkmark-done-outline"
                    size={20}
                    color="#fff"
                  />
                )}
                <Text style={styles.fakeBtnText}>
                  {isPolling
                    ? "Đang kiểm tra..."
                    : "Đã thanh toán - Kiểm tra ngay"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.fakeCancelBtn}
              onPress={handleClose}
              activeOpacity={0.85}
            >
              <Ionicons name="time-outline" size={20} color="#6B7280" />
              <Text style={[styles.fakeCancelText, { color: "#6B7280" }]}>
                Đóng, tải lại sau
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </Modal>
  );
}

// ==========================================================================
// Styles
// ==========================================================================
const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 8,
    minHeight: 360,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  headerSub: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
    maxWidth: 260,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
  },
  // Amount card
  amountCard: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
  },
  amountLabel: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 30,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  discountChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: "flex-start",
  },
  discountChipText: {
    fontSize: 12,
    color: "#6EE7B7",
    fontWeight: "500",
  },
  // Section
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 10,
  },
  // Method card
  methodCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    marginBottom: 10,
    backgroundColor: "#FAFAFA",
  },
  methodCardSelected: {
    borderColor: "#2563EB",
    backgroundColor: "#EFF6FF",
  },
  methodIcon: {
    width: 46,
    height: 46,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  methodInfo: {
    flex: 1,
  },
  methodLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  methodDesc: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    justifyContent: "center",
    alignItems: "center",
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  // Pay button
  payBtn: {
    borderRadius: 14,
    overflow: "hidden",
    marginTop: 8,
  },
  payBtnDisabled: {
    opacity: 0.6,
  },
  payBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
  },
  payBtnInner: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    backgroundColor: "#F3F4F6",
    borderRadius: 14,
  },
  payBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  // Processing
  processingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 16,
  },
  processingTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  processingDesc: {
    fontSize: 14,
    color: "#6B7280",
  },
  // Fake confirm
  fakeInfoBox: {
    alignItems: "center",
    paddingVertical: 24,
    gap: 8,
  },
  fakeInfoTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#7C3AED",
  },
  fakeInfoDesc: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    paddingHorizontal: 20,
  },
  fakeTxnId: {
    fontSize: 13,
    color: "#9CA3AF",
    fontFamily: "monospace",
    marginTop: 4,
  },
  fakeSuccessBtn: {
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 12,
  },
  fakeBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
  },
  fakeBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  fakeCancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#FCA5A5",
    backgroundColor: "#FEF2F2",
  },
  fakeCancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#EF4444",
  },
});
