import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFinanceStore } from "@/lib/stores";
import { router } from "expo-router";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
};

export default function PayrollScreen() {
  const { myPayouts, fetchMyPayouts, confirmPayout, isLoading } = useFinanceStore();
  const [isConfirming, setIsConfirming] = useState<string | null>(null);

  useEffect(() => {
    fetchMyPayouts();
  }, []);

  const handleConfirm = (payoutId: string, amount: number) => {
    Alert.alert(
      "Xác nhận nhận tiền",
      `Bạn chắc chắn đã nhận đủ ${formatCurrency(amount)} tiền mặt?`,
      [
        { text: "Hủy", style: "cancel" },
        {
          text: "Xác nhận",
          onPress: async () => {
            setIsConfirming(payoutId);
            try {
              await confirmPayout(payoutId);
              Alert.alert("Thành công", "Đã xác nhận nhận lương thành công.");
            } catch (error: any) {
              Alert.alert("Lỗi", error.message || "Không thể xác nhận lúc này.");
            } finally {
              setIsConfirming(null);
            }
          },
        },
      ]
    );
  };

  const renderPayoutItem = (payout: any) => {
    const isPending = payout.status === "notified";

    return (
      <View key={payout._id} style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={styles.className}>{payout.classId?.name}</Text>
            <Text style={styles.blockInfo}>Đợt thanh toán #{payout.blockNumber}</Text>
          </View>
          <View style={[styles.statusBadge, isPending ? styles.statusPending : styles.statusConfirmed]}>
            <Text style={[styles.statusText, isPending ? styles.statusTextPending : styles.statusTextConfirmed]}>
              {isPending ? "Chờ xác nhận" : "Đã nhận tiền"}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.cardBody}>
          <View style={styles.row}>
            <Text style={styles.label}>Số tiền:</Text>
            <Text style={styles.amount}>{formatCurrency(payout.amount)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Ngày thông báo:</Text>
            <Text style={styles.value}>
              {format(new Date(payout.notifiedAt), "dd/MM/yyyy HH:mm", { locale: vi })}
            </Text>
          </View>
          {payout.confirmedAt && (
            <View style={styles.row}>
              <Text style={styles.label}>Ngày xác nhận:</Text>
              <Text style={styles.value}>
                {format(new Date(payout.confirmedAt), "dd/MM/yyyy HH:mm", { locale: vi })}
              </Text>
            </View>
          )}
        </View>

        {isPending && (
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={() => handleConfirm(payout._id, payout.amount)}
            disabled={isConfirming === payout._id}
          >
            {isConfirming === payout._id ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                <Text style={styles.confirmButtonText}>Xác nhận đã nhận tiền mặt</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Lịch sử tiền lương</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isLoading && !isConfirming} onRefresh={fetchMyPayouts} />
        }
      >
        {myPayouts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="cash-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyText}>Chưa có thông tin phiếu lương nào</Text>
          </View>
        ) : (
          myPayouts.map(renderPayoutItem)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  className: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  blockInfo: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  statusPending: {
    backgroundColor: "#FFF7ED",
  },
  statusConfirmed: {
    backgroundColor: "#F0FDF4",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  statusTextPending: {
    color: "#C2410C",
  },
  statusTextConfirmed: {
    color: "#15803D",
  },
  divider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginBottom: 12,
  },
  cardBody: {
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  label: {
    fontSize: 14,
    color: "#6B7280",
  },
  value: {
    fontSize: 14,
    color: "#374151",
    fontWeight: "500",
  },
  amount: {
    fontSize: 16,
    fontWeight: "700",
    color: "#10B981",
  },
  confirmButton: {
    backgroundColor: "#10B981",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  confirmButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: "#9CA3AF",
    marginTop: 12,
  },
});
