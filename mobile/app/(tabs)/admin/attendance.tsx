import { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  FlatList,
  ActivityIndicator,
  Modal,
  TextInput,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import {
  useClassesStore,
  useAttendanceStore,
  useBranchesStore,
} from "@/lib/stores";
import {
  useSessionsStore,
  Session as StoreSession,
} from "@/lib/stores/sessions-store";
import { AttendanceRecord as StoreAttendanceRecord } from "@/lib/stores/attendance-store";
import { Class as StoreClass } from "@/lib/stores/classes-store";

const attendanceStatusConfig = {
  present: {
    label: "Có mặt",
    color: "#10B981",
    bg: "#D1FAE5",
    icon: "checkmark-circle",
  },
  absent: {
    label: "Vắng",
    color: "#EF4444",
    bg: "#FEE2E2",
    icon: "close-circle",
  },
  late: { label: "Đi muộn", color: "#F59E0B", bg: "#FEF3C7", icon: "time" },
  excused: {
    label: "Có phép",
    color: "#3B82F6",
    bg: "#DBEAFE",
    icon: "document-text",
  },
};

// View mode: 'classes' for class list view like web, 'sessions' for session-based view
type ViewMode = "classes" | "sessions";

export default function AdminAttendanceScreen() {
  const { classes, fetchClasses } = useClassesStore();
  const { branches, fetchBranches } = useBranchesStore();
  const {
    sessions,
    fetchSessions,
    isLoading: sessionsLoading,
  } = useSessionsStore();
  const { fetchSessionAttendance } = useAttendanceStore();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("classes");

  // Session-based states
  const [selectedSessionFilter, setSelectedSessionFilter] = useState<
    string | null
  >(null);
  const [selectedSession, setSelectedSession] = useState<StoreSession | null>(
    null,
  );
  const [sessionAttendance, setSessionAttendance] = useState<
    StoreAttendanceRecord[]
  >([]);

  // Class detail modal
  const [selectedClassDetail, setSelectedClassDetail] =
    useState<StoreClass | null>(null);
  const [isDetailVisible, setIsDetailVisible] = useState(false);
  const [isLoadingAttendance, setIsLoadingAttendance] = useState(false);
  const [classAttendanceData, setClassAttendanceData] = useState<
    StoreAttendanceRecord[]
  >([]);

  // Stats
  const [stats, setStats] = useState({
    totalClasses: 0,
    totalStudents: 0,
    presentRate: 0,
    alertCount: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    await Promise.all([fetchClasses(), fetchSessions(), fetchBranches()]);
    calculateStats();
  };

  const calculateStats = () => {
    const totalStudents = classes.reduce(
      (acc, c) => acc + (c.students?.length || c.studentIds?.length || 0),
      0,
    );
    setStats({
      totalClasses: classes.length,
      totalStudents,
      presentRate: 100, // Will be updated from actual attendance data
      alertCount: 0, // Students with 3+ consecutive absences
    });
  };

  useEffect(() => {
    calculateStats();
  }, [classes]);

  const onRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };

  // Filter classes by branch and search
  const filteredClasses = useMemo(() => {
    let result = classes;

    if (selectedBranch) {
      result = result.filter(
        (c) =>
          c.branchId === selectedBranch || c.branch?._id === selectedBranch,
      );
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.name?.toLowerCase().includes(query) ||
          c.teacher?.fullName?.toLowerCase().includes(query),
      );
    }

    return result;
  }, [classes, selectedBranch, searchQuery]);

  const filteredSessions = selectedSessionFilter
    ? sessions.filter((s) => s.classId?._id === selectedSessionFilter)
    : sessions;

  // Get attendance stats for a class
  const getClassAttendanceStats = (classData: StoreClass) => {
    const totalStudents =
      classData.students?.length || classData.studentIds?.length || 0;
    return {
      totalStudents,
      hasConsecutiveAbsent: false,
    };
  };

  // Handle view class detail
  const handleViewClassDetail = async (classData: StoreClass) => {
    setSelectedClassDetail(classData);
    setIsDetailVisible(true);
    setIsLoadingAttendance(true);

    try {
      // Try to fetch real attendance data for the selected date
      await fetchSessions({ classId: classData._id, date: selectedDate });
      // Read fresh sessions directly from store state (avoids stale closure)
      const freshSessions = useSessionsStore.getState().sessions;
      const classSessions = freshSessions.filter(
        (s) =>
          (typeof s.classId === "object" ? s.classId?._id : s.classId) ===
          classData._id,
      );

      let hasAttendanceData = false;
      let attendanceRecords: StoreAttendanceRecord[] = [];

      // Check if any session has attendance for this date
      for (const session of classSessions) {
        try {
          const records = await fetchSessionAttendance(session._id);
          if (records && records.length > 0) {
            hasAttendanceData = true;
            attendanceRecords = records;
            break;
          }
        } catch {
          // No attendance for this session
        }
      }

      if (hasAttendanceData) {
        // Merge real records + auto-absent only for students not yet recorded
        const recordedIds = new Set(
          attendanceRecords.map((r) =>
            String(
              typeof r.studentId === "object" ? r.studentId._id : r.studentId,
            ),
          ),
        );
        const autoAbsentRecords = (classData.students || [])
          .filter((student) => !recordedIds.has(String(student._id)))
          .map((student) => ({
            _id: `auto-absent-${student._id}`,
            studentId: {
              _id: student._id,
              fullName: student.fullName || student.name || "Học sinh",
            },
            status: "absent" as const,
            sessionId: "",
            notes: "Chưa điểm danh - Tự động ghi vắng",
          }));
        setClassAttendanceData([
          ...attendanceRecords,
          ...autoAbsentRecords,
        ] as unknown as StoreAttendanceRecord[]);
      } else {
        // Auto-absent: if teacher hasn't taken attendance, default all students to absent
        const studentAttendance = (classData.students || []).map((student) => ({
          _id: student._id,
          studentId: {
            _id: student._id,
            fullName: student.fullName || student.name || "Học sinh",
          },
          status: "absent" as const,
          sessionId: "",
          notes: "Chưa điểm danh - Tự động ghi vắng",
        }));
        setClassAttendanceData(
          studentAttendance as unknown as StoreAttendanceRecord[],
        );
      }
    } catch (error) {
      console.error("Error fetching attendance:", error);
      // Fallback: auto-absent
      const studentAttendance = (classData.students || []).map((student) => ({
        _id: student._id,
        studentId: {
          _id: student._id,
          fullName: student.fullName || student.name || "Học sinh",
        },
        status: "absent" as const,
        sessionId: "",
        notes: "Chưa điểm danh - Tự động ghi vắng",
      }));
      setClassAttendanceData(
        studentAttendance as unknown as StoreAttendanceRecord[],
      );
    } finally {
      setIsLoadingAttendance(false);
    }
  };

  const handleViewSessionAttendance = async (session: StoreSession) => {
    setSelectedSession(session);
    setIsDetailVisible(true);
    setIsLoadingAttendance(true);

    try {
      const attendance = await fetchSessionAttendance(session._id);

      // Auto-absent: fill absent for students not recorded after session ends
      const classId =
        typeof session.classId === "object"
          ? session.classId?._id
          : session.classId;
      const sessionClass = classes.find((c) => c._id === classId);

      if (sessionClass?.students && sessionClass.students.length > 0) {
        // Check if session has already ended
        const now = new Date();
        const sessionEnd = session.endTime ? new Date(session.endTime) : null;
        const isPastSession = sessionEnd ? now > sessionEnd : true;

        if (isPastSession) {
          // Build set of student IDs already recorded (normalize to string for reliable comparison)
          const recordedIds = new Set(
            (attendance || []).map((r) =>
              String(
                typeof r.studentId === "object" ? r.studentId._id : r.studentId,
              ),
            ),
          );

          // Add absent only for students NOT already recorded by the teacher
          const autoAbsentRecords = sessionClass.students
            .filter((student) => !recordedIds.has(String(student._id)))
            .map((student) => ({
              _id: `auto-absent-${student._id}`,
              studentId: {
                _id: student._id,
                fullName: student.fullName || student.name || "Học sinh",
              },
              status: "absent" as const,
              sessionId: session._id,
              notes: "Chưa điểm danh - Tự động ghi vắng",
            }));

          setSessionAttendance([
            ...(attendance || []),
            ...autoAbsentRecords,
          ] as unknown as StoreAttendanceRecord[]);
        } else {
          setSessionAttendance(attendance || []);
        }
      } else {
        setSessionAttendance(attendance || []);
      }
    } catch (error) {
      console.error("Error fetching attendance:", error);
      setSessionAttendance([]);
    } finally {
      setIsLoadingAttendance(false);
    }
  };

  // Helper to get student name
  const getStudentName = (record: StoreAttendanceRecord): string => {
    if (
      typeof record.studentId === "object" &&
      (record.studentId?.fullName || record.studentId?.name)
    ) {
      return record.studentId.fullName || record.studentId.name || "Học sinh";
    }
    return "Học sinh";
  };

  // Helper to get class name from session
  const getClassName = (session: StoreSession): string => {
    if (typeof session.classId === "object" && session.classId?.name) {
      return session.classId.name;
    }
    return "Không có lớp";
  };

  // Helper to get teacher name from session
  const getTeacherName = (session: StoreSession): string | null => {
    if (
      typeof session.teacherId === "object" &&
      (session.teacherId?.fullName || session.teacherId?.name)
    ) {
      return session.teacherId.fullName || session.teacherId.name || null;
    }
    return null;
  };

  // Helper to get branch name
  const getBranchName = (classData: StoreClass): string => {
    if (typeof classData.branch === "object" && classData.branch?.name) {
      return classData.branch.name;
    }
    const branch = branches.find((b) => b._id === classData.branchId);
    return branch?.name || "Chưa xác định";
  };

  // Helper to get teacher name from class
  const getClassTeacherName = (classData: StoreClass): string => {
    if (
      typeof classData.teacher === "object" &&
      (classData.teacher?.fullName || classData.teacher?.name)
    ) {
      return (
        classData.teacher.fullName || classData.teacher.name || "Chưa phân công"
      );
    }
    return "Chưa phân công";
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("vi-VN", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  // Render class card (new web-like view)
  const renderClassCard = ({ item: classData }: { item: StoreClass }) => {
    const stats = getClassAttendanceStats(classData);

    return (
      <TouchableOpacity
        style={[
          styles.classCard,
          stats.hasConsecutiveAbsent && styles.classCardAlert,
        ]}
        onPress={() => handleViewClassDetail(classData)}
        activeOpacity={0.7}
      >
        <View style={styles.classCardContent}>
          <View style={styles.classCardLeft}>
            <LinearGradient
              colors={["#14B8A6", "#0D9488"]}
              style={styles.classCardIcon}
            >
              <Ionicons name="people" size={20} color="#FFFFFF" />
            </LinearGradient>

            <View style={styles.classCardInfo}>
              <Text style={styles.classCardName}>{classData.name}</Text>
              <Text style={styles.classCardTeacher}>
                GV: {getClassTeacherName(classData)} •{" "}
                {getBranchName(classData)}
              </Text>
            </View>
          </View>

          <View style={styles.classCardStats}>
            <View style={styles.statItem}>
              <Text style={styles.statItemLabel}>HS</Text>
              <Text style={styles.statItemValue}>{stats.totalStudents}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statItemLabel}>Điểm danh</Text>
              <Text
                style={[
                  styles.statItemValue,
                  { color: "#9CA3AF", fontSize: 11 },
                ]}
              >
                Chọn để xem
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.viewDetailButton}
          onPress={() => handleViewClassDetail(classData)}
        >
          <Ionicons name="eye-outline" size={16} color="#3B82F6" />
          <Text style={styles.viewDetailText}>Xem chi tiết</Text>
          <Ionicons name="chevron-forward" size={16} color="#D1D5DB" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderSessionCard = ({ item: session }: { item: StoreSession }) => (
    <TouchableOpacity
      style={styles.sessionCard}
      onPress={() => handleViewSessionAttendance(session)}
      activeOpacity={0.7}
    >
      <View style={styles.sessionHeader}>
        <LinearGradient
          colors={
            session.status === "completed"
              ? ["#10B981", "#059669"]
              : session.status === "cancelled"
                ? ["#EF4444", "#DC2626"]
                : ["#3B82F6", "#2563EB"]
          }
          style={styles.sessionIcon}
        >
          <Ionicons name="calendar" size={20} color="#FFFFFF" />
        </LinearGradient>

        <View style={styles.sessionInfo}>
          <Text style={styles.sessionClass}>{getClassName(session)}</Text>
          <Text style={styles.sessionDate}>{formatDate(session.date)}</Text>
          <Text style={styles.sessionTime}>
            {session.startTime} - {session.endTime}
          </Text>
        </View>

        <View style={styles.sessionRight}>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor:
                  session.status === "completed"
                    ? "#D1FAE5"
                    : session.status === "cancelled"
                      ? "#FEE2E2"
                      : "#DBEAFE",
              },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                {
                  color:
                    session.status === "completed"
                      ? "#059669"
                      : session.status === "cancelled"
                        ? "#DC2626"
                        : "#2563EB",
                },
              ]}
            >
              {session.status === "completed"
                ? "Đã học"
                : session.status === "cancelled"
                  ? "Đã hủy"
                  : "Chờ học"}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#D1D5DB" />
        </View>
      </View>

      {getTeacherName(session) && (
        <View style={styles.sessionFooter}>
          <Ionicons name="person-outline" size={14} color="#6B7280" />
          <Text style={styles.teacherText}>GV: {getTeacherName(session)}</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderAttendanceItem = ({
    item: record,
  }: {
    item: StoreAttendanceRecord;
  }) => {
    const status =
      attendanceStatusConfig[
        record.status as keyof typeof attendanceStatusConfig
      ] || attendanceStatusConfig.absent;

    return (
      <View style={styles.attendanceItem}>
        <View style={styles.attendanceLeft}>
          <View
            style={[styles.attendanceAvatar, { backgroundColor: status.bg }]}
          >
            <Text
              style={[styles.attendanceAvatarText, { color: status.color }]}
            >
              {getStudentName(record).charAt(0) || "?"}
            </Text>
          </View>
          <View>
            <Text style={styles.attendanceName}>{getStudentName(record)}</Text>
            <Text style={styles.attendanceSubtext}>{status.label}</Text>
          </View>
        </View>
        <View style={[styles.attendanceBadge, { backgroundColor: status.bg }]}>
          <Ionicons name={status.icon as any} size={16} color={status.color} />
          <Text style={[styles.attendanceBadgeText, { color: status.color }]}>
            {status.label}
          </Text>
        </View>
      </View>
    );
  };

  // List header component - scrolls with the list to fix scroll issues
  const renderListHeader = () => (
    <>
      {/* Summary Header */}
      <LinearGradient colors={["#14B8A6", "#0D9488"]} style={styles.header}>
        <View style={styles.headerContent}>
          <Ionicons name="checkbox" size={28} color="rgba(255,255,255,0.9)" />
          <View style={styles.headerInfo}>
            <Text style={styles.headerValue}>{stats.presentRate}%</Text>
            <Text style={styles.headerSubtitle}>Tỷ lệ có mặt hôm nay</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <LinearGradient
            colors={["#6366F1", "#4F46E5"]}
            style={styles.statCardIcon}
          >
            <Ionicons name="book" size={14} color="#FFFFFF" />
          </LinearGradient>
          <Text style={[styles.statValue, { color: "#6366F1" }]}>
            {stats.totalClasses}
          </Text>
          <Text style={styles.statLabel}>Lớp học</Text>
        </View>
        <View style={styles.statCard}>
          <LinearGradient
            colors={["#10B981", "#059669"]}
            style={styles.statCardIcon}
          >
            <Ionicons name="checkmark" size={14} color="#FFFFFF" />
          </LinearGradient>
          <Text style={[styles.statValue, { color: "#10B981" }]}>
            {stats.presentRate}%
          </Text>
          <Text style={styles.statLabel}>Có mặt</Text>
        </View>
        <View style={styles.statCard}>
          <LinearGradient
            colors={["#F59E0B", "#D97706"]}
            style={styles.statCardIcon}
          >
            <Ionicons name="people" size={14} color="#FFFFFF" />
          </LinearGradient>
          <Text style={[styles.statValue, { color: "#F59E0B" }]}>
            {stats.totalStudents}
          </Text>
          <Text style={styles.statLabel}>Học sinh</Text>
        </View>
      </View>

      {/* View Mode Toggle */}
      <View style={styles.viewModeContainer}>
        <TouchableOpacity
          style={[
            styles.viewModeTab,
            viewMode === "classes" && styles.viewModeTabActive,
          ]}
          onPress={() => setViewMode("classes")}
        >
          <Ionicons
            name="list"
            size={18}
            color={viewMode === "classes" ? "#FFFFFF" : "#6B7280"}
          />
          <Text
            style={[
              styles.viewModeText,
              viewMode === "classes" && styles.viewModeTextActive,
            ]}
          >
            Theo lớp
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.viewModeTab,
            viewMode === "sessions" && styles.viewModeTabActive,
          ]}
          onPress={() => setViewMode("sessions")}
        >
          <Ionicons
            name="calendar"
            size={18}
            color={viewMode === "sessions" ? "#FFFFFF" : "#6B7280"}
          />
          <Text
            style={[
              styles.viewModeText,
              viewMode === "sessions" && styles.viewModeTextActive,
            ]}
          >
            Theo buổi học
          </Text>
        </TouchableOpacity>
      </View>

      {/* Date Picker */}
      <View style={styles.datePickerRow}>
        <TouchableOpacity
          style={styles.datePickerButton}
          onPress={() => setShowDatePicker(true)}
        >
          <Ionicons name="calendar-outline" size={18} color="#14B8A6" />
          <Text style={styles.datePickerText}>
            {new Date(selectedDate).toLocaleDateString("vi-VN", {
              weekday: "long",
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })}
          </Text>
          <Ionicons name="chevron-down" size={16} color="#6B7280" />
        </TouchableOpacity>
      </View>
      <Modal
        transparent
        animationType="fade"
        visible={showDatePicker}
        onRequestClose={() => setShowDatePicker(false)}
      >
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.45)",
            justifyContent: "center",
            alignItems: "center",
          }}
          activeOpacity={1}
          onPress={() => setShowDatePicker(false)}
        >
          <View
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 20,
              overflow: "hidden",
              marginHorizontal: 16,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 12,
              elevation: 8,
            }}
            onStartShouldSetResponder={() => true}
          >
            <View
              style={{
                paddingHorizontal: 16,
                paddingTop: 14,
                paddingBottom: 4,
                borderBottomWidth: 1,
                borderBottomColor: "#F3F4F6",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text
                style={{ fontSize: 16, fontWeight: "700", color: "#111827" }}
              >
                Chọn ngày
              </Text>
              <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                <Ionicons name="close" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>
            <DateTimePicker
              value={new Date(selectedDate)}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "calendar"}
              textColor="#111827"
              onChange={(event: DateTimePickerEvent, date?: Date) => {
                if (date) {
                  setSelectedDate(date.toISOString().split("T")[0]);
                }
                if (event.type === "set" && Platform.OS !== "ios") {
                  setShowDatePicker(false);
                }
              }}
              style={{ backgroundColor: "#FFFFFF" }}
            />
            {Platform.OS === "ios" && (
              <TouchableOpacity
                onPress={() => setShowDatePicker(false)}
                style={{
                  margin: 12,
                  paddingVertical: 12,
                  borderRadius: 10,
                  backgroundColor: "#14B8A6",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: "#FFFFFF",
                    fontWeight: "700",
                    fontSize: 16,
                  }}
                >
                  Xác nhận
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Search and Filter */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <Ionicons
            name="search"
            size={18}
            color="#9CA3AF"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder={
              viewMode === "classes"
                ? "Tìm kiếm lớp học..."
                : "Tìm kiếm buổi học..."
            }
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* Branch Filter - for classes view */}
      {viewMode === "classes" && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScrollView}
          contentContainerStyle={styles.filterContainer}
        >
          <TouchableOpacity
            style={[
              styles.filterChip,
              !selectedBranch && styles.filterChipActive,
            ]}
            onPress={() => setSelectedBranch(null)}
          >
            <Text
              style={[
                styles.filterChipText,
                !selectedBranch && styles.filterChipTextActive,
              ]}
            >
              Tất cả
            </Text>
          </TouchableOpacity>
          {branches.map((branch) => (
            <TouchableOpacity
              key={branch._id}
              style={[
                styles.filterChip,
                selectedBranch === branch._id && styles.filterChipActive,
              ]}
              onPress={() => setSelectedBranch(branch._id)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedBranch === branch._id && styles.filterChipTextActive,
                ]}
              >
                {branch.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Class Filter - for sessions view */}
      {viewMode === "sessions" && (
        <>
          <Text style={styles.filterTitle}>Lọc theo lớp</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScrollView}
            contentContainerStyle={styles.filterContainer}
          >
            <TouchableOpacity
              style={[
                styles.filterChip,
                !selectedSessionFilter && styles.filterChipActive,
              ]}
              onPress={() => setSelectedSessionFilter(null)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  !selectedSessionFilter && styles.filterChipTextActive,
                ]}
              >
                Tất cả
              </Text>
            </TouchableOpacity>
            {classes.map((cls) => (
              <TouchableOpacity
                key={cls._id}
                style={[
                  styles.filterChip,
                  selectedSessionFilter === cls._id && styles.filterChipActive,
                ]}
                onPress={() => setSelectedSessionFilter(cls._id)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedSessionFilter === cls._id &&
                      styles.filterChipTextActive,
                  ]}
                >
                  {cls.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      )}

      {/* List Section Title */}
      <View style={styles.sectionHeader}>
        <Ionicons name="stats-chart" size={18} color="#374151" />
        <Text style={styles.sectionTitle}>
          {viewMode === "classes" ? `Điểm danh theo lớp` : "Danh sách buổi học"}
        </Text>
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      {/* Content */}
      {sessionsLoading && !isRefreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#14B8A6" />
          <Text style={styles.loadingText}>Đang tải...</Text>
        </View>
      ) : viewMode === "classes" ? (
        <FlatList
          style={{ flex: 1 }}
          data={filteredClasses}
          renderItem={renderClassCard}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={renderListHeader}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Ionicons name="school-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>Chưa có lớp học</Text>
              <Text style={styles.emptyText}>
                Tạo lớp học mới trong tab Khóa học
              </Text>
            </View>
          )}
        />
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={filteredSessions}
          renderItem={renderSessionCard}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={renderListHeader}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>Không có buổi học</Text>
              <Text style={styles.emptyText}>
                Chưa có buổi học nào được tạo
              </Text>
            </View>
          )}
        />
      )}

      {/* Attendance Detail Modal */}
      <Modal
        visible={isDetailVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setIsDetailVisible(false);
          setSelectedClassDetail(null);
          setSelectedSession(null);
        }}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.modalBackButton}
              onPress={() => {
                setIsDetailVisible(false);
                setSelectedClassDetail(null);
                setSelectedSession(null);
              }}
            >
              <Ionicons name="arrow-back" size={22} color="#1F2937" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Chi tiết điểm danh</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView
            style={styles.modalContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Class-based detail */}
            {selectedClassDetail && (
              <>
                {/* Class Info Card */}
                <LinearGradient
                  colors={["#14B8A6", "#0D9488"]}
                  style={styles.detailInfoCard}
                >
                  <View style={styles.detailInfoIconBg}>
                    <Ionicons name="school" size={24} color="#14B8A6" />
                  </View>
                  <Text style={styles.detailInfoClass}>
                    {selectedClassDetail.name}
                  </Text>
                  <Text style={styles.detailInfoDate}>
                    {new Date(selectedDate).toLocaleDateString("vi-VN", {
                      weekday: "long",
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </Text>
                  <Text style={styles.detailInfoTeacher}>
                    GV: {getClassTeacherName(selectedClassDetail)}
                  </Text>
                </LinearGradient>

                {/* Attendance Stats */}
                <View style={styles.attendanceStats}>
                  <View
                    style={[
                      styles.attendanceStatItem,
                      { backgroundColor: "#D1FAE5" },
                    ]}
                  >
                    <Text
                      style={[styles.attendanceStatValue, { color: "#10B981" }]}
                    >
                      {
                        classAttendanceData.filter(
                          (a) => a.status === "present",
                        ).length
                      }
                    </Text>
                    <Text style={styles.attendanceStatLabel}>Có mặt</Text>
                  </View>
                  <View
                    style={[
                      styles.attendanceStatItem,
                      { backgroundColor: "#FEE2E2" },
                    ]}
                  >
                    <Text
                      style={[styles.attendanceStatValue, { color: "#EF4444" }]}
                    >
                      {
                        classAttendanceData.filter((a) => a.status === "absent")
                          .length
                      }
                    </Text>
                    <Text style={styles.attendanceStatLabel}>Vắng</Text>
                  </View>
                  <View
                    style={[
                      styles.attendanceStatItem,
                      { backgroundColor: "#FEF3C7" },
                    ]}
                  >
                    <Text
                      style={[styles.attendanceStatValue, { color: "#F59E0B" }]}
                    >
                      {
                        classAttendanceData.filter((a) => a.status === "late")
                          .length
                      }
                    </Text>
                    <Text style={styles.attendanceStatLabel}>Đi muộn</Text>
                  </View>
                </View>

                {/* Student List */}
                <Text style={styles.attendanceListTitle}>
                  Danh sách học sinh
                </Text>
                {isLoadingAttendance ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#14B8A6" />
                  </View>
                ) : classAttendanceData.length === 0 ? (
                  <View style={styles.emptyAttendance}>
                    <Ionicons name="people-outline" size={40} color="#D1D5DB" />
                    <Text style={styles.emptyAttendanceText}>
                      Lớp chưa có học sinh
                    </Text>
                  </View>
                ) : (
                  <FlatList
                    data={classAttendanceData}
                    renderItem={renderAttendanceItem}
                    keyExtractor={(item) => item._id}
                    scrollEnabled={false}
                  />
                )}
              </>
            )}

            {/* Session-based detail */}
            {selectedSession && !selectedClassDetail && (
              <>
                {/* Session Info */}
                <LinearGradient
                  colors={["#14B8A6", "#0D9488"]}
                  style={styles.detailInfoCard}
                >
                  <View style={styles.detailInfoIconBg}>
                    <Ionicons name="calendar" size={24} color="#14B8A6" />
                  </View>
                  <Text style={styles.detailInfoClass}>
                    {getClassName(selectedSession)}
                  </Text>
                  <Text style={styles.detailInfoDate}>
                    {formatDate(selectedSession.date)}
                  </Text>
                  <Text style={styles.detailInfoTime}>
                    🕐 {selectedSession.startTime} - {selectedSession.endTime}
                  </Text>
                  {getTeacherName(selectedSession) && (
                    <Text style={styles.detailInfoTeacher}>
                      👤 GV: {getTeacherName(selectedSession)}
                    </Text>
                  )}
                </LinearGradient>

                {/* Attendance Stats */}
                <View style={styles.attendanceStats}>
                  <View
                    style={[
                      styles.attendanceStatItem,
                      { backgroundColor: "#D1FAE5" },
                    ]}
                  >
                    <Text
                      style={[styles.attendanceStatValue, { color: "#10B981" }]}
                    >
                      {
                        sessionAttendance.filter((a) => a.status === "present")
                          .length
                      }
                    </Text>
                    <Text style={styles.attendanceStatLabel}>Có mặt</Text>
                  </View>
                  <View
                    style={[
                      styles.attendanceStatItem,
                      { backgroundColor: "#FEE2E2" },
                    ]}
                  >
                    <Text
                      style={[styles.attendanceStatValue, { color: "#EF4444" }]}
                    >
                      {
                        sessionAttendance.filter((a) => a.status === "absent")
                          .length
                      }
                    </Text>
                    <Text style={styles.attendanceStatLabel}>Vắng</Text>
                  </View>
                  <View
                    style={[
                      styles.attendanceStatItem,
                      { backgroundColor: "#FEF3C7" },
                    ]}
                  >
                    <Text
                      style={[styles.attendanceStatValue, { color: "#F59E0B" }]}
                    >
                      {
                        sessionAttendance.filter((a) => a.status === "late")
                          .length
                      }
                    </Text>
                    <Text style={styles.attendanceStatLabel}>Đi muộn</Text>
                  </View>
                  <View
                    style={[
                      styles.attendanceStatItem,
                      { backgroundColor: "#DBEAFE" },
                    ]}
                  >
                    <Text
                      style={[styles.attendanceStatValue, { color: "#3B82F6" }]}
                    >
                      {
                        sessionAttendance.filter((a) => a.status === "excused")
                          .length
                      }
                    </Text>
                    <Text style={styles.attendanceStatLabel}>Có phép</Text>
                  </View>
                </View>

                {/* Attendance List */}
                <Text style={styles.attendanceListTitle}>
                  Danh sách học sinh
                </Text>
                {isLoadingAttendance ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#14B8A6" />
                  </View>
                ) : sessionAttendance.length === 0 ? (
                  <View style={styles.emptyAttendance}>
                    <Ionicons name="people-outline" size={40} color="#D1D5DB" />
                    <Text style={styles.emptyAttendanceText}>
                      Chưa có dữ liệu điểm danh
                    </Text>
                  </View>
                ) : (
                  <FlatList
                    data={sessionAttendance}
                    renderItem={renderAttendanceItem}
                    keyExtractor={(item) => item._id}
                    scrollEnabled={false}
                  />
                )}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
  },
  // Header
  header: {
    paddingTop: 12,
    paddingBottom: 14,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerInfo: {
    flex: 1,
  },
  headerValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.8)",
    marginTop: 4,
  },
  // Stats
  statsContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginTop: 12,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 10,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statCardIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 10,
    color: "#6B7280",
    marginTop: 2,
    textAlign: "center",
  },
  // View Mode Toggle
  viewModeContainer: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: "#E5E7EB",
    borderRadius: 12,
    padding: 4,
  },
  viewModeTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  viewModeTabActive: {
    backgroundColor: "#14B8A6",
  },
  viewModeText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
  },
  viewModeTextActive: {
    color: "#FFFFFF",
  },
  // Search
  searchContainer: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  searchInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: "#1F2937",
  },
  // Date Picker
  datePickerRow: {
    paddingHorizontal: 16,
    marginTop: 12,
  },
  datePickerButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 8,
  },
  datePickerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    color: "#1F2937",
  },
  // Filter
  filterTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  filterScrollView: {
    marginTop: 12,
  },
  filterContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  filterChipActive: {
    backgroundColor: "#14B8A6",
    borderColor: "#14B8A6",
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#4B5563",
  },
  filterChipTextActive: {
    color: "#FFFFFF",
  },
  // Section Header
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginTop: 20,
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#374151",
  },
  // List
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  // Class Card (New web-like view)
  classCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "#F3F4F6",
    overflow: "hidden",
  },
  classCardAlert: {
    borderColor: "#FEE2E2",
    backgroundColor: "#FFF5F5",
  },
  classCardContent: {
    padding: 16,
  },
  classCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  classCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  classCardInfo: {
    flex: 1,
  },
  classCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  classCardName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
  },
  alertBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EF4444",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  alertBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  classCardTeacher: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
  },
  classCardStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 12,
  },
  statItem: {
    alignItems: "center",
  },
  statItemLabel: {
    fontSize: 11,
    color: "#6B7280",
    marginBottom: 4,
  },
  statItemValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
  },
  viewDetailButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    gap: 6,
  },
  viewDetailText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3B82F6",
  },
  // Session Card
  sessionCard: {
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
  sessionHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  sessionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionClass: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1F2937",
  },
  sessionDate: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  sessionTime: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
  },
  sessionRight: {
    alignItems: "flex-end",
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  sessionFooter: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    gap: 4,
  },
  teacherText: {
    fontSize: 12,
    color: "#6B7280",
  },
  // Loading & Empty
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6B7280",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginTop: 12,
  },
  emptyText: {
    fontSize: 13,
    color: "#9CA3AF",
    marginTop: 4,
    textAlign: "center",
  },
  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  modalBackButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1F2937",
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  detailInfoCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    alignItems: "center",
  },
  detailInfoIconBg: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  detailInfoClass: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 8,
    textAlign: "center",
  },
  detailInfoDate: {
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
    marginBottom: 4,
  },
  detailInfoTime: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
    marginBottom: 4,
  },
  detailInfoTeacher: {
    fontSize: 13,
    color: "rgba(255,255,255,0.8)",
  },
  // Attendance Stats
  attendanceStats: {
    flexDirection: "row",
    borderRadius: 16,
    marginBottom: 24,
    gap: 8,
  },
  attendanceStatItem: {
    flex: 1,
    alignItems: "center",
    borderRadius: 12,
    padding: 12,
  },
  attendanceStatValue: {
    fontSize: 22,
    fontWeight: "700",
  },
  attendanceStatLabel: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 4,
  },
  // Attendance List
  attendanceListTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 16,
  },
  attendanceItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
  },
  attendanceLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  attendanceAvatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  attendanceAvatarText: {
    fontSize: 16,
    fontWeight: "700",
  },
  attendanceName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1F2937",
  },
  attendanceSubtext: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  attendanceBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  attendanceBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  emptyAttendance: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyAttendanceText: {
    fontSize: 14,
    color: "#9CA3AF",
    marginTop: 12,
  },
});
