import { useEffect, useCallback, useRef, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  Animated,
  ActivityIndicator,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import {
  useAuthStore,
  useNotificationsStore,
  useClassesStore,
  usePaymentRequestsStore,
  useIncidentsStore,
  useScheduleStore,
  useFeedbackStore,
  getUserDisplayName,
  useChildrenStore,
} from "@/lib/stores";
import { router } from "expo-router";
import api from "@/lib/api";
import {
  gradingService,
  StudentGradeRecord,
  StudentRankInfo,
} from "@/lib/services/grading.service";
import ChildSelector from "@/components/ChildSelector";

const { width } = Dimensions.get("window");

const getRoleConfig = (role: string) => {
  switch (role) {
    case "student":
      return {
        label: "Học sinh",
        colors: ["#3B82F6", "#2563EB"],
        icon: "school",
      };
    case "teacher":
      return {
        label: "Giáo viên",
        colors: ["#10B981", "#059669"],
        icon: "person",
      };
    case "parent":
      return {
        label: "Phụ huynh",
        colors: ["#F59E0B", "#D97706"],
        icon: "people",
      };
    case "admin":
      return {
        label: "Quản trị viên",
        colors: ["#8B5CF6", "#7C3AED"],
        icon: "settings",
      };
    default:
      return { label: role, colors: ["#6B7280", "#4B5563"], icon: "person" };
  }
};

// Animated Quick Action Component
interface AnimatedQuickActionProps {
  index: number;
  colors: [string, string];
  icon: string;
  label: string;
  subtitle: string;
  onPress: () => void;
  badge?: number;
  isCompact?: boolean;
}

const AnimatedQuickAction = ({
  index,
  colors,
  icon,
  label,
  subtitle,
  onPress,
  badge,
  isCompact = false,
}: AnimatedQuickActionProps) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        delay: index * 80,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        delay: index * 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      tension: 300,
      friction: 10,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 300,
      friction: 10,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View
      style={[
        isCompact ? styles.quickActionCardCompact : styles.quickActionCard,
        {
          opacity: opacityAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        style={styles.quickActionTouchable}
      >
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.quickActionGradient,
            isCompact && styles.quickActionGradientCompact,
          ]}
        >
          <Ionicons
            name={icon as any}
            size={isCompact ? 24 : 28}
            color="#FFFFFF"
          />
          {badge && badge > 0 ? (
            <View style={styles.actionBadge}>
              <Text style={styles.actionBadgeText}>
                {badge > 9 ? "9+" : badge}
              </Text>
            </View>
          ) : null}
        </LinearGradient>
        <Text
          style={[
            styles.quickActionLabel,
            isCompact && styles.quickActionLabelCompact,
          ]}
        >
          {label}
        </Text>
        <Text
          style={[
            styles.quickActionSubtitle,
            isCompact && styles.quickActionSubtitleCompact,
          ]}
        >
          {subtitle}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

// Role-specific overview cards
const getOverviewCards = (
  role: string,
  data: {
    classCount: number;
    pendingPayments: number;
    pendingPaymentAmount: number;
    incidentsCount: number;
  },
) => {
  const baseCards = {
    student: [
      {
        label: "Khóa học",
        value: data.classCount.toString(),
        note: "Đang theo học",
        icon: "book" as const,
        colors: ["#3B82F6", "#2563EB"],
      },
      {
        label: "Thanh toán",
        value: data.pendingPayments > 0 ? data.pendingPayments.toString() : "0",
        note: data.pendingPayments > 0 ? "Chưa thanh toán" : "Đã hoàn thành",
        icon: "wallet" as const,
        colors:
          data.pendingPayments > 0
            ? ["#EF4444", "#DC2626"]
            : ["#10B981", "#059669"],
      },
      {
        label: "Điểm TB",
        value: "8.2",
        note: "Kết quả tốt",
        icon: "star" as const,
        colors: ["#F59E0B", "#D97706"],
      },
      {
        label: "Sự cố",
        value: data.incidentsCount.toString(),
        note: "Đang xử lý",
        icon: "warning" as const,
        colors: ["#8B5CF6", "#7C3AED"],
      },
    ],
    parent: [
      {
        label: "Khóa học con",
        value: data.classCount.toString(),
        note: "Đang theo học",
        icon: "book" as const,
        colors: ["#3B82F6", "#2563EB"],
      },
      {
        label: "Cần thanh toán",
        value: data.pendingPayments > 0 ? data.pendingPayments.toString() : "0",
        note: data.pendingPayments > 0 ? "Khoản chờ" : "Đã hoàn thành",
        icon: "wallet" as const,
        colors:
          data.pendingPayments > 0
            ? ["#EF4444", "#DC2626"]
            : ["#10B981", "#059669"],
      },
      {
        label: "Điểm TB",
        value: "8.2",
        note: "Kết quả tốt",
        icon: "star" as const,
        colors: ["#F59E0B", "#D97706"],
      },
      {
        label: "Xếp loại",
        value: "Tốt",
        note: "Đánh giá chung",
        icon: "trophy" as const,
        colors: ["#8B5CF6", "#7C3AED"],
      },
    ],
    teacher: [
      {
        label: "Lớp giảng dạy",
        value: data.classCount.toString(),
        note: "Đang dạy",
        icon: "book" as const,
        colors: ["#10B981", "#059669"],
      },
      {
        label: "Học sinh",
        value: "45",
        note: "Tổng số",
        icon: "people" as const,
        colors: ["#3B82F6", "#2563EB"],
      },
      {
        label: "Buổi dạy",
        value: "12",
        note: "Tháng này",
        icon: "calendar" as const,
        colors: ["#F59E0B", "#D97706"],
      },
      {
        label: "Đánh giá",
        value: "4.8",
        note: "Từ học sinh",
        icon: "star" as const,
        colors: ["#8B5CF6", "#7C3AED"],
      },
    ],
    admin: [
      {
        label: "Lớp học",
        value: data.classCount.toString(),
        note: "Đang hoạt động",
        icon: "school" as const,
        colors: ["#8B5CF6", "#7C3AED"],
      },
      {
        label: "Học sinh",
        value: "120",
        note: "Tổng số",
        icon: "people" as const,
        colors: ["#3B82F6", "#2563EB"],
      },
      {
        label: "Giáo viên",
        value: "15",
        note: "Đang dạy",
        icon: "person" as const,
        colors: ["#10B981", "#059669"],
      },
      {
        label: "Sự cố",
        value: data.incidentsCount.toString(),
        note: "Chờ xử lý",
        icon: "warning" as const,
        colors: ["#F59E0B", "#D97706"],
      },
    ],
  };

  return baseCards[role as keyof typeof baseCards] || baseCards.student;
};

// Role-specific quick actions
const getQuickActions = (
  role: string,
  unreadCount: number,
  pendingPayments: number,
) => {
  const baseActions = {
    student: [
      {
        icon: "calendar" as const,
        label: "Lịch học",
        subtitle: "Xem lịch tuần",
        colors: ["#3B82F6", "#2563EB"],
        badge: 0,
        onPress: () => router.push("/(tabs)/schedule"),
      },
      {
        icon: "school" as const,
        label: "Lớp học",
        subtitle: "Quản lý lớp",
        colors: ["#10B981", "#059669"],
        badge: 0,
        onPress: () => router.push("/(tabs)/classes"),
      },
      {
        icon: "wallet" as const,
        label: "Thanh toán",
        subtitle:
          pendingPayments > 0
            ? `${pendingPayments} chờ thanh toán`
            : "Đã hoàn thành",
        colors:
          pendingPayments > 0 ? ["#EF4444", "#DC2626"] : ["#F59E0B", "#D97706"],
        badge: pendingPayments,
        onPress: () => router.push("/(tabs)/payments"),
      },
    ],
    parent: [
      {
        icon: "calendar" as const,
        label: "Lịch học con",
        subtitle: "Xem lịch học",
        colors: ["#F59E0B", "#D97706"],
        badge: 0,
        onPress: () => router.push("/(tabs)/schedule"),
      },
      {
        icon: "school" as const,
        label: "Lớp học",
        subtitle: "Theo dõi lớp",
        colors: ["#10B981", "#059669"],
        badge: 0,
        onPress: () => router.push("/(tabs)/classes"),
      },
      {
        icon: "chatbubbles" as const,
        label: "Chat",
        subtitle: "Nhắn tin",
        colors: ["#6366F1", "#4F46E5"],
        badge: 0,
        onPress: () => router.push("/(tabs)/incidents"),
      },
      {
        icon: "warning" as const,
        label: "Sự cố",
        subtitle: "Báo cáo sự cố",
        colors: ["#EF4444", "#DC2626"],
        badge: 0,
        onPress: () => router.push("/incidents-report"),
      },
    ],
    teacher: [
      {
        icon: "calendar" as const,
        label: "Lịch dạy",
        subtitle: "Xem lịch tuần",
        colors: ["#10B981", "#059669"],
        badge: 0,
        onPress: () => router.push("/(tabs)/schedule"),
      },
      {
        icon: "school" as const,
        label: "Lớp học",
        subtitle: "Quản lý lớp",
        colors: ["#3B82F6", "#2563EB"],
        badge: 0,
        onPress: () => router.push("/(tabs)/classes"),
      },
      {
        icon: "document-text" as const,
        label: "Tài liệu",
        subtitle: "Tài liệu giảng dạy",
        colors: ["#F59E0B", "#D97706"],
        badge: 0,
        onPress: () => router.push("/(tabs)/materials"),
      },
      {
        icon: "warning" as const,
        label: "Sự cố",
        subtitle: "Báo cáo sự cố",
        colors: ["#EF4444", "#DC2626"],
        badge: 0,
        onPress: () => router.push("/incidents-report"),
      },
      {
        icon: "trophy" as const,
        label: "Xếp hạng",
        subtitle: "Bảng xếp hạng",
        colors: ["#F59E0B", "#D97706"],
        badge: 0,
        onPress: () => router.push("/leaderboard"),
      },
      {
        icon: "star" as const,
        label: "Đánh giá",
        subtitle: "Xem đánh giá",
        colors: ["#8B5CF6", "#7C3AED"],
        badge: 0,
        onPress: () => router.push("/(tabs)/evaluations"),
      },
    ],
    admin: [
      {
        icon: "school" as const,
        label: "Lớp học",
        subtitle: "Quản lý lớp",
        colors: ["#8B5CF6", "#7C3AED"],
        badge: 0,
        onPress: () => router.push("/(tabs)/classes"),
      },
      {
        icon: "notifications" as const,
        label: "Thông báo",
        subtitle: unreadCount > 0 ? `${unreadCount} chưa đọc` : "Cập nhật",
        colors: ["#3B82F6", "#2563EB"],
        badge: unreadCount,
        onPress: () => router.push("/(tabs)/notifications"),
      },
      {
        icon: "person" as const,
        label: "Tài khoản",
        subtitle: "Quản lý",
        colors: ["#10B981", "#059669"],
        badge: 0,
        onPress: () => router.push("/(tabs)/admin/accounts"),
      },
      {
        icon: "shield-checkmark" as const,
        label: "Quản lý",
        subtitle: "Dashboard",
        colors: ["#F59E0B", "#D97706"],
        badge: 0,
        onPress: () => router.push("/(tabs)/admin"),
      },
    ],
  };

  return baseActions[role as keyof typeof baseActions] || baseActions.student;
};

export default function HomeScreen() {
  const { user } = useAuthStore();
  const { unreadCount, fetchNotifications } = useNotificationsStore();
  const { classes, fetchClasses, isLoading } = useClassesStore();
  const {
    myRequests,
    childrenRequests,
    fetchMyRequests,
    fetchChildrenRequests,
  } = usePaymentRequestsStore();
  const { myIncidents, fetchMyIncidents } = useIncidentsStore();
  const { sessions, fetchMySessions } = useScheduleStore();
  const { myRatings, fetchMyRatings } = useFeedbackStore();
  const { children, selectedChild, fetchChildren } = useChildrenStore();

  const role = user?.role || "student";

  // State for grades data
  const [gradesData, setGradesData] = useState<StudentGradeRecord[]>([]);
  const [gradesLoading, setGradesLoading] = useState(false);
  const [classRankings, setClassRankings] = useState<
    Record<string, StudentRankInfo>
  >({});

  // Fetch children for parent (multi-child support)
  const fetchChildrenData = useCallback(async () => {
    if (role === "parent" && user?._id) {
      await fetchChildren(user._id);
      return useChildrenStore.getState().selectedChild?._id || null;
    }
    return null;
  }, [role, user?._id]);

  // Fetch grades for student or parent's child
  const fetchGrades = useCallback(
    async (studentId?: string) => {
      const targetId =
        studentId || (role === "student" ? user?._id : selectedChild?._id);
      if (!targetId) return;

      setGradesLoading(true);
      try {
        const data = await gradingService.getMyGrades(targetId);
        setGradesData(data);

        // Lấy xếp hạng cho từng lớp
        const classIds = [
          ...new Set(data.map((g) => g.classId?._id).filter(Boolean)),
        ];
        const rankings: Record<string, StudentRankInfo> = {};

        for (const classId of classIds) {
          try {
            const rankInfo = await gradingService.getStudentRankInClass(
              targetId,
              classId as string,
            );
            rankings[classId as string] = rankInfo;
          } catch (err) {
            console.error(`Failed to fetch rank for class ${classId}`, err);
          }
        }
        setClassRankings(rankings);
      } catch (error) {
        console.error("Error fetching grades:", error);
      } finally {
        setGradesLoading(false);
      }
    },
    [role, user?._id, selectedChild?._id],
  );

  // Calculate average score from grades
  const averageScore = useMemo(() => {
    if (!gradesData.length) return 0;
    let totalScore = 0;
    let totalMax = 0;
    gradesData.forEach((g) => {
      totalScore += g.score;
      totalMax += g.maxScore;
    });
    if (totalMax === 0) return 0;
    return parseFloat(((totalScore / totalMax) * 10).toFixed(1));
  }, [gradesData]);

  // Process grades by subject
  const gradesBySubject = useMemo(() => {
    if (!gradesData.length) return [];

    const groups: Record<
      string,
      { name: string; classId: string; grades: StudentGradeRecord[] }
    > = {};
    gradesData.forEach((g) => {
      const key = g.classId?._id || "unknown";
      const name = g.classId?.name || "Lớp học";
      if (!groups[key]) {
        groups[key] = { name, classId: key, grades: [] };
      }
      groups[key].grades.push(g);
    });

    return Object.values(groups).map((group) => {
      let totalScore = 0;
      let totalMax = 0;
      group.grades.forEach((g) => {
        totalScore += g.score;
        totalMax += g.maxScore;
      });
      const avg =
        totalMax > 0
          ? parseFloat(((totalScore / totalMax) * 10).toFixed(1))
          : 0;

      // Lấy thông tin xếp hạng của lớp này
      const rankInfo = classRankings[group.classId];

      return {
        name: group.name,
        classId: group.classId,
        average: avg,
        count: group.grades.length,
        rank: rankInfo?.rank || null,
        totalStudents: rankInfo?.totalStudents || 0,
      };
    });
  }, [gradesData, classRankings]);

  // Tính tổng xếp hạng (lớp có rank tốt nhất)
  const overallRanking = useMemo(() => {
    const ranks = Object.values(classRankings).filter((r) => r.rank !== null);
    if (ranks.length === 0) return null;

    const bestRank = Math.min(...ranks.map((r) => r.rank!));
    const totalStudentsOfBestRank =
      ranks.find((r) => r.rank === bestRank)?.totalStudents || 0;

    return {
      bestRank,
      totalStudents: totalStudentsOfBestRank,
      classCount: ranks.length,
    };
  }, [classRankings]);

  useEffect(() => {
    loadData();
  }, [role]);

  const loadData = useCallback(async () => {
    await fetchNotifications();

    // For parent, get children info first then fetch classes with selected childId
    if (role === "parent") {
      const childId = await fetchChildrenData();
      if (childId) {
        await fetchClasses(undefined, childId);
        await fetchGrades(childId); // Fetch grades for child
      } else {
        await fetchClasses();
      }
      await fetchChildrenRequests();
      await fetchMyIncidents();
    } else if (role === "student") {
      await fetchClasses();
      await fetchGrades(user?._id); // Fetch grades for student
      await fetchMyRequests();
      await fetchMyIncidents();
    } else if (role === "teacher") {
      await fetchClasses();
      await fetchMySessions();
      await fetchMyRatings();
      await fetchMyIncidents();
    } else {
      await fetchClasses();
    }
  }, [role, fetchChildrenData, fetchGrades, user?._id]);

  // Re-fetch data when selected child changes
  useEffect(() => {
    if (role === "parent" && selectedChild?._id) {
      fetchClasses(undefined, selectedChild._id);
      fetchGrades(selectedChild._id);
    }
  }, [selectedChild?._id]);

  const onRefresh = async () => {
    await loadData();
  };

  // Calculate pending payments
  const pendingPayments =
    role === "student"
      ? myRequests.filter(
        (r) => r.status === "pending" || r.status === "overdue",
      ).length
      : role === "parent"
        ? childrenRequests
          .flatMap((c) => c.requests)
          .filter((r) => r.status === "pending" || r.status === "overdue")
          .length
        : 0;

  const pendingPaymentAmount =
    role === "student"
      ? myRequests
        .filter((r) => r.status === "pending" || r.status === "overdue")
        .reduce((sum, r) => sum + r.finalAmount, 0)
      : role === "parent"
        ? childrenRequests
          .flatMap((c) => c.requests)
          .filter((r) => r.status === "pending" || r.status === "overdue")
          .reduce((sum, r) => sum + r.finalAmount, 0)
        : 0;

  const pendingIncidents = myIncidents.filter(
    (i) => i.status === "pending" || i.status === "in_progress",
  ).length;

  const roleConfig = getRoleConfig(role);
  const overviewCards = getOverviewCards(role, {
    classCount: classes.length,
    pendingPayments,
    pendingPaymentAmount,
    incidentsCount: pendingIncidents,
  });

  const quickActions = getQuickActions(role, unreadCount, pendingPayments);

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={onRefresh}
            tintColor="#FFFFFF"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Background extension for iOS pull-to-refresh overscroll */}
        <View
          style={{
            position: "absolute",
            top: -1000,
            left: 0,
            right: 0,
            height: 1000,
            backgroundColor: roleConfig.colors[0],
          }}
        />

        {/* Welcome Section with Solid Color to match Header */}
        <LinearGradient
          colors={[roleConfig.colors[0], roleConfig.colors[0]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.welcomeGradient}
        >
          <View style={styles.welcomeContent}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatarCircle}>
                {user?.avatarUrl ? (
                  <Image
                    source={{ uri: user.avatarUrl }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <Ionicons
                    name="person"
                    size={32}
                    color={roleConfig.colors[0]}
                  />
                )}
              </View>
              {unreadCount > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.welcomeText}>
              <Text style={styles.greeting}>Xin chào! 👋</Text>
              <Text style={styles.userName}>{getUserDisplayName(user)}</Text>
              <View style={styles.roleBadge}>
                <Ionicons
                  name={roleConfig.icon as any}
                  size={12}
                  color="#FFFFFF"
                />
                <Text style={styles.roleText}>{roleConfig.label}</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* Overview Stats Cards */}
        <View style={styles.overviewSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.overviewScroll}
          >
            {overviewCards.map((card, index) => (
              <View key={index} style={styles.overviewCard}>
                <LinearGradient
                  colors={card.colors as [string, string]}
                  style={styles.overviewIconBg}
                >
                  <Ionicons name={card.icon} size={20} color="#FFFFFF" />
                </LinearGradient>
                <Text style={styles.overviewValue}>{card.value}</Text>
                <Text style={styles.overviewLabel}>{card.label}</Text>
                <Text style={styles.overviewNote}>{card.note}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Streak Card - Gamification Element (Student only) */}
        {role === "student" && (
          <>
            <View style={styles.section}>
              <View style={styles.streakCard}>
                <LinearGradient
                  colors={["#FEF3C7", "#FDE68A"]}
                  style={styles.streakGradient}
                >
                  <View style={styles.streakContent}>
                    <Text style={styles.streakIcon}>🔥</Text>
                    <View style={styles.streakInfo}>
                      <Text style={styles.streakTitle}>Chuỗi điểm danh</Text>
                      <Text style={styles.streakValue}>12 ngày liên tục</Text>
                    </View>
                    <View style={styles.streakBadge}>
                      <Ionicons name="flame" size={16} color="#D97706" />
                    </View>
                  </View>
                </LinearGradient>
              </View>
            </View>
          </>
        )}

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Truy cập nhanh</Text>
          <View
            style={[
              styles.quickActionsGrid,
              role === "student" && styles.quickActionsGridFour,
              role !== "student" &&
              quickActions.length === 5 &&
              styles.quickActionsGridFive,
            ]}
          >
            {/* Student: 2 rows x 4 items */}
            {role === "student" ? (
              <>
                <AnimatedQuickAction
                  index={0}
                  colors={["#3B82F6", "#2563EB"]}
                  icon="calendar"
                  label="Lịch học"
                  subtitle="Xem lịch tuần"
                  onPress={() => router.push("/(tabs)/schedule")}
                  isCompact={true}
                />
                <AnimatedQuickAction
                  index={1}
                  colors={["#10B981", "#059669"]}
                  icon="school"
                  label="Lớp học"
                  subtitle="Quản lý lớp"
                  onPress={() => router.push("/(tabs)/classes")}
                  isCompact={true}
                />
                <AnimatedQuickAction
                  index={2}
                  colors={["#F59E0B", "#D97706"]}
                  icon="ribbon"
                  label="Điểm số"
                  subtitle="Kết quả học tập"
                  onPress={() => router.push("/grades")}
                  isCompact={true}
                />
                <AnimatedQuickAction
                  index={3}
                  colors={["#8B5CF6", "#7C3AED"]}
                  icon="trophy"
                  label="Xếp hạng"
                  subtitle="Thành tích"
                  onPress={() => router.push("/leaderboard")}
                  isCompact={true}
                />
                <AnimatedQuickAction
                  index={4}
                  colors={["#EC4899", "#DB2777"]}
                  icon="document-text"
                  label="Tài liệu"
                  subtitle="Ôn luyện"
                  onPress={() => router.push("/(tabs)/materials")}
                  isCompact={true}
                />
                <AnimatedQuickAction
                  index={5}
                  colors={["#EF4444", "#DC2626"]}
                  icon="warning"
                  label="Sự cố"
                  subtitle="Báo cáo"
                  onPress={() => router.push("/incidents-report")}
                  isCompact={true}
                />
                <AnimatedQuickAction
                  index={6}
                  colors={["#6366F1", "#4F46E5"]}
                  icon="star"
                  label="Đánh giá GV"
                  subtitle="Đánh giá"
                  onPress={() => router.push("/(tabs)/evaluations")}
                  isCompact={true}
                />
                <AnimatedQuickAction
                  index={7}
                  colors={
                    pendingPayments > 0
                      ? ["#EF4444", "#DC2626"]
                      : ["#F59E0B", "#D97706"]
                  }
                  icon="wallet"
                  label="Thanh toán"
                  subtitle={
                    pendingPayments > 0
                      ? `${pendingPayments} chờ`
                      : "Hoàn thành"
                  }
                  onPress={() => router.push("/(tabs)/payments")}
                  badge={pendingPayments}
                  isCompact={true}
                />
              </>
            ) : (
              quickActions.map((action, index) => (
                <AnimatedQuickAction
                  key={index}
                  index={index}
                  colors={action.colors as [string, string]}
                  icon={action.icon}
                  label={action.label}
                  subtitle={action.subtitle}
                  onPress={action.onPress}
                  badge={(action as any).badge}
                  isCompact={quickActions.length === 5}
                />
              ))
            )}
          </View>
        </View>

        {/* Child Info Section - for parent only */}
        {role === "parent" && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Thông tin con</Text>
              <TouchableOpacity
                onPress={() => router.push("/(tabs)/classes")}
                style={styles.seeAllButton}
              >
                <Text style={styles.seeAll}>Xem chi tiết</Text>
                <Ionicons name="chevron-forward" size={16} color="#F59E0B" />
              </TouchableOpacity>
            </View>

            {/* Child selector for multi-child support */}
            <ChildSelector />

            {!selectedChild && children.length === 0 && classes.length === 0 ? (
              <View style={styles.emptyCard}>
                <LinearGradient
                  colors={["#FEF3C7", "#FDE68A"]}
                  style={styles.emptyIconBg}
                >
                  <Ionicons name="person-outline" size={40} color="#D97706" />
                </LinearGradient>
                <Text style={styles.emptyTitle}>Chưa có thông tin</Text>
                <Text style={styles.emptyText}>
                  {user?.childEmail
                    ? "Đang tải thông tin con..."
                    : "Chưa liên kết tài khoản con"}
                </Text>
              </View>
            ) : (
              <View style={styles.childInfoCard}>
                <View style={styles.childHeader}>
                  <LinearGradient
                    colors={["#F59E0B", "#D97706"]}
                    style={styles.childAvatarBg}
                  >
                    <Ionicons name="person" size={28} color="#FFFFFF" />
                  </LinearGradient>
                  <View style={styles.childHeaderInfo}>
                    <Text style={styles.childName}>
                      {selectedChild?.name ||
                        selectedChild?.fullName ||
                        "Con của bạn"}
                    </Text>
                    <Text style={styles.childGrade}>
                      Đang theo học {classes.length} lớp
                    </Text>
                  </View>
                </View>
                <View style={styles.childStats}>
                  <View style={styles.childStatItem}>
                    <Text style={styles.childStatValue}>{classes.length}</Text>
                    <Text style={styles.childStatLabel}>Lớp học</Text>
                  </View>
                  <View style={styles.childStatItem}>
                    <Text style={styles.childStatValue}>
                      {averageScore || "-"}
                    </Text>
                    <Text style={styles.childStatLabel}>Điểm TB</Text>
                  </View>
                  <View style={styles.childStatItem}>
                    <Text style={styles.childStatValue}>{children.length}</Text>
                    <Text style={styles.childStatLabel}>Số con</Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}

        {/* My Classes - for student and teacher only */}
        {(role === "student" || role === "teacher") && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Lớp học của tôi</Text>
              <TouchableOpacity
                onPress={() => router.push("/(tabs)/classes")}
                style={styles.seeAllButton}
              >
                <Text style={styles.seeAll}>Xem tất cả</Text>
                <Ionicons name="chevron-forward" size={16} color="#3B82F6" />
              </TouchableOpacity>
            </View>

            {classes.length === 0 ? (
              <View style={styles.emptyCard}>
                <LinearGradient
                  colors={["#F3F4F6", "#E5E7EB"]}
                  style={styles.emptyIconBg}
                >
                  <Ionicons name="school-outline" size={40} color="#9CA3AF" />
                </LinearGradient>
                <Text style={styles.emptyTitle}>Chưa có lớp học nào</Text>
                <Text style={styles.emptyText}>
                  Bạn sẽ thấy danh sách lớp học tại đây
                </Text>
              </View>
            ) : (
              classes.slice(0, 3).map((classItem, index) => (
                <TouchableOpacity
                  key={classItem._id}
                  style={styles.classCard}
                  activeOpacity={0.7}
                >
                  <LinearGradient
                    colors={
                      index % 2 === 0
                        ? ["#3B82F6", "#2563EB"]
                        : ["#10B981", "#059669"]
                    }
                    style={styles.classIconBg}
                  >
                    <Ionicons name="book" size={20} color="#FFFFFF" />
                  </LinearGradient>
                  <View style={styles.classInfo}>
                    <Text style={styles.className}>{classItem.name}</Text>
                    <Text style={styles.classSubject}>{classItem.subject}</Text>
                  </View>
                  <View style={styles.classArrow}>
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color="#9CA3AF"
                    />
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* Payment Alert - for Student and Parent only */}
        {(role === "student" || role === "parent") && pendingPayments > 0 && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.alertCard}
              onPress={() => router.push("/(tabs)/payments")}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={["#FEE2E2", "#FECACA"]}
                style={styles.alertGradient}
              >
                <View style={styles.alertContent}>
                  <View style={styles.alertIconBg}>
                    <Ionicons name="wallet" size={24} color="#DC2626" />
                  </View>
                  <View style={styles.alertInfo}>
                    <Text style={styles.alertTitle}>
                      Có khoản cần thanh toán
                    </Text>
                    <Text style={styles.alertSubtitle}>
                      {pendingPayments} khoản •{" "}
                      {new Intl.NumberFormat("vi-VN", {
                        style: "currency",
                        currency: "VND",
                        maximumFractionDigits: 0,
                      }).format(pendingPaymentAmount)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#DC2626" />
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* Student Progress Section */}
        {role === "student" && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Tiến độ học tập</Text>
            </View>
            {gradesLoading ? (
              <View style={styles.progressCard}>
                <ActivityIndicator size="small" color="#6366F1" />
              </View>
            ) : gradesData.length === 0 ? (
              <View style={styles.progressCard}>
                <Text style={styles.emptyText}>Chưa có dữ liệu điểm</Text>
              </View>
            ) : (
              <View style={styles.progressCard}>
                <View style={styles.progressItem}>
                  <Text style={styles.progressLabel}>Điểm trung bình</Text>
                  <View style={styles.progressBar}>
                    <LinearGradient
                      colors={["#10B981", "#059669"]}
                      style={[
                        styles.progressFill,
                        { width: `${averageScore * 10}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.progressValue}>{averageScore}/10</Text>
                </View>

                {/* Xếp hạng tổng */}
                {overallRanking && (
                  <View style={styles.progressItem}>
                    <Text style={[styles.progressLabel, { color: "#F59E0B" }]}>
                      🏆 Xếp hạng: #{overallRanking.bestRank}/
                      {overallRanking.totalStudents}
                    </Text>
                  </View>
                )}

                {/* Subject breakdown */}
                {gradesBySubject.map((subject, index) => (
                  <View key={index} style={styles.progressItem}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <Text style={styles.progressLabel}>
                        {subject.name} ({subject.count} bài)
                      </Text>
                      {subject.rank && (
                        <Text
                          style={[
                            styles.progressLabel,
                            { color: "#F59E0B", fontSize: 11 },
                          ]}
                        >
                          #{subject.rank}/{subject.totalStudents}
                        </Text>
                      )}
                    </View>
                    <View style={styles.progressBar}>
                      <LinearGradient
                        colors={
                          index % 2 === 0
                            ? ["#3B82F6", "#2563EB"]
                            : ["#F59E0B", "#D97706"]
                        }
                        style={[
                          styles.progressFill,
                          { width: `${subject.average * 10}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.progressValue}>
                      {subject.average}/10
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Teacher Stats Card */}
        {role === "teacher" && (
          <View style={styles.section}>
            <View style={styles.teacherStatsCard}>
              <Text style={styles.teacherStatsTitle}>Thống kê</Text>
              <View style={styles.teacherStatsGrid}>
                <View style={styles.teacherStatItem}>
                  <LinearGradient
                    colors={["#10B981", "#059669"]}
                    style={styles.teacherStatIcon}
                  >
                    <Ionicons name="calendar" size={18} color="#FFFFFF" />
                  </LinearGradient>
                  <Text style={styles.teacherStatValue}>
                    {
                      sessions.filter((s) => new Date(s.endTime) < new Date())
                        .length
                    }
                  </Text>
                  <Text style={styles.teacherStatLabel}>Buổi đã dạy</Text>
                </View>
                <View style={styles.teacherStatItem}>
                  <LinearGradient
                    colors={["#3B82F6", "#2563EB"]}
                    style={styles.teacherStatIcon}
                  >
                    <Ionicons name="school" size={18} color="#FFFFFF" />
                  </LinearGradient>
                  <Text style={styles.teacherStatValue}>{classes.length}</Text>
                  <Text style={styles.teacherStatLabel}>Lớp đang dạy</Text>
                </View>
                <View style={styles.teacherStatItem}>
                  <LinearGradient
                    colors={["#F59E0B", "#D97706"]}
                    style={styles.teacherStatIcon}
                  >
                    <Ionicons name="star" size={18} color="#FFFFFF" />
                  </LinearGradient>
                  <Text style={styles.teacherStatValue}>
                    {myRatings?.stats?.averageRating
                      ? myRatings.stats.averageRating.toFixed(1)
                      : "—"}
                  </Text>
                  <Text style={styles.teacherStatLabel}>Đánh giá</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Parent Child Progress */}
        {role === "parent" && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Tiến độ học tập</Text>
            </View>
            {gradesLoading ? (
              <View style={styles.progressCard}>
                <ActivityIndicator size="small" color="#6366F1" />
              </View>
            ) : gradesData.length === 0 ? (
              <View style={styles.progressCard}>
                <Text style={styles.emptyText}>Chưa có dữ liệu điểm</Text>
              </View>
            ) : (
              <View style={styles.progressCard}>
                <View style={styles.progressItem}>
                  <Text style={styles.progressLabel}>Điểm trung bình</Text>
                  <View style={styles.progressBar}>
                    <LinearGradient
                      colors={["#10B981", "#059669"]}
                      style={[
                        styles.progressFill,
                        { width: `${averageScore * 10}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.progressValue}>{averageScore}/10</Text>
                </View>

                {/* Xếp hạng tổng */}
                {overallRanking && (
                  <View style={styles.progressItem}>
                    <Text style={[styles.progressLabel, { color: "#F59E0B" }]}>
                      🏆 Xếp hạng: #{overallRanking.bestRank}/
                      {overallRanking.totalStudents}
                    </Text>
                  </View>
                )}

                {/* Subject breakdown */}
                {gradesBySubject.map((subject, index) => (
                  <View key={index} style={styles.progressItem}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <Text style={styles.progressLabel}>
                        {subject.name} ({subject.count} bài)
                      </Text>
                      {subject.rank && (
                        <Text
                          style={[
                            styles.progressLabel,
                            { color: "#F59E0B", fontSize: 11 },
                          ]}
                        >
                          #{subject.rank}/{subject.totalStudents}
                        </Text>
                      )}
                    </View>
                    <View style={styles.progressBar}>
                      <LinearGradient
                        colors={
                          index % 2 === 0
                            ? ["#3B82F6", "#2563EB"]
                            : ["#F59E0B", "#D97706"]
                        }
                        style={[
                          styles.progressFill,
                          { width: `${subject.average * 10}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.progressValue}>
                      {subject.average}/10
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  welcomeGradient: {
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  welcomeContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarContainer: {
    position: "relative",
    marginRight: 16,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    overflow: "hidden",
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 20,
  },
  notificationBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: "#EF4444",
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  notificationBadgeText: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  welcomeText: {
    flex: 1,
  },
  greeting: {
    fontSize: 15,
    color: "rgba(255, 255, 255, 0.9)",
    marginBottom: 2,
  },
  userName: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  roleText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  overviewSection: {
    marginTop: 16,
    marginBottom: 8,
  },
  overviewScroll: {
    paddingHorizontal: 16,
    marginVertical: 4,
  },
  documentCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  documentIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  documentIconText: {
    fontSize: 12,
    fontWeight: "bold",
  },
  documentInfo: {
    flex: 1,
    marginRight: 12,
  },
  documentName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 4,
  },
  documentMeta: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 2,
  },
  documentClass: {
    fontSize: 12,
    color: "#3B82F6",
    fontWeight: "500",
  },
  downloadButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
  },
  overviewCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
    width: (width - 56) / 2.5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    alignItems: "center",
  },
  overviewIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  overviewValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1F2937",
    marginBottom: 2,
  },
  overviewLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 2,
  },
  overviewNote: {
    fontSize: 11,
    color: "#9CA3AF",
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 16,
  },
  seeAllButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  seeAll: {
    fontSize: 14,
    color: "#3B82F6",
    fontWeight: "600",
  },
  quickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
  },
  quickActionsGridFive: {
    justifyContent: "flex-start",
  },
  quickActionsGridFour: {
    justifyContent: "center",
  },
  quickActionCard: {
    width: "50%",
    paddingHorizontal: 4,
    marginBottom: 12,
    alignItems: "center",
  },
  quickActionCardCompact: {
    width: "25%",
    paddingHorizontal: 4,
    marginBottom: 14,
    alignItems: "center",
  },
  quickActionTouchable: {
    width: "100%",
    alignItems: "center",
  },
  quickActionGradient: {
    width: "100%",
    aspectRatio: 1.6,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  quickActionGradientCompact: {
    aspectRatio: 1,
    borderRadius: 14,
    marginBottom: 8,
  },
  actionBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#EF4444",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 5,
  },
  actionBadgeText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  quickActionLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1F2937",
    textAlign: "center",
  },
  quickActionLabelCompact: {
    fontSize: 11,
  },
  quickActionSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 2,
  },
  quickActionSubtitleCompact: {
    fontSize: 10,
    marginTop: 1,
  },
  classCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  classIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  classInfo: {
    flex: 1,
  },
  className: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 3,
  },
  classSubject: {
    fontSize: 14,
    color: "#6B7280",
  },
  classArrow: {
    padding: 4,
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyIconBg: {
    width: 72,
    height: 72,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
  },
  streakCard: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  streakGradient: {
    padding: 16,
  },
  streakContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  streakIcon: {
    fontSize: 32,
    marginRight: 14,
  },
  streakInfo: {
    flex: 1,
  },
  streakTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#92400E",
    marginBottom: 2,
  },
  streakValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#78350F",
  },
  streakBadge: {
    backgroundColor: "rgba(217, 119, 6, 0.2)",
    padding: 10,
    borderRadius: 12,
  },
  // Alert Card
  alertCard: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#EF4444",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  alertGradient: {
    padding: 16,
  },
  alertContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  alertIconBg: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(220, 38, 38, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  alertInfo: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#B91C1C",
    marginBottom: 2,
  },
  alertSubtitle: {
    fontSize: 13,
    color: "#DC2626",
  },
  // Teacher Stats
  teacherStatsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  teacherStatsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 16,
  },
  teacherStatsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  teacherStatItem: {
    alignItems: "center",
    flex: 1,
  },
  teacherStatIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  teacherStatValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 2,
  },
  teacherStatLabel: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
  },
  // Parent Progress
  progressCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  progressItem: {
    marginBottom: 16,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#374151",
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 4,
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  progressValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
    textAlign: "right",
  },
  // Student Learning Materials
  categoryScroll: {
    marginBottom: 12,
  },
  categoryContainer: {
    paddingRight: 16,
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: "#3B82F6",
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
  },
  categoryChipTextActive: {
    color: "#FFFFFF",
  },
  materialCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  materialIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  materialIconText: {
    fontSize: 12,
    fontWeight: "bold",
  },
  materialInfo: {
    flex: 1,
  },
  materialName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 2,
  },
  materialDescription: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 6,
  },
  materialMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  materialTag: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  materialTagText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#3B82F6",
  },
  materialSize: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  // Child Info Card for Parent
  childInfoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  childHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  childAvatarBg: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  childHeaderInfo: {
    flex: 1,
  },
  childName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 4,
  },
  childGrade: {
    fontSize: 14,
    color: "#6B7280",
  },
  childStats: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  childStatItem: {
    alignItems: "center",
    flex: 1,
  },
  childStatValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#F59E0B",
    marginBottom: 4,
  },
  childStatLabel: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },
});
