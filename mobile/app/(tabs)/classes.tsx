import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  Modal,
  ScrollView,
  Alert,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import {
  useClassesStore,
  useAuthStore,
  Class,
  useBranchesStore,
  useUsersStore,
  useChildrenStore,
} from "@/lib/stores";
import {
  getSubjectLabel,
  subjects as SUBJECTS,
} from "@/lib/constants/subjects";
import api from "@/lib/api";
import ChildSelector from "@/components/ChildSelector";

const { width } = Dimensions.get("window");

const DAYS_OF_WEEK = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const DAYS_OF_WEEK_FULL = [
  "Chủ nhật",
  "Thứ 2",
  "Thứ 3",
  "Thứ 4",
  "Thứ 5",
  "Thứ 6",
  "Thứ 7",
];

const GRADE_LEVELS = [
  { value: "10", label: "Lớp 10" },
  { value: "11", label: "Lớp 11" },
  { value: "12", label: "Lớp 12" },
  { value: "9", label: "Lớp 9" },
  { value: "8", label: "Lớp 8" },
  { value: "7", label: "Lớp 7" },
  { value: "6", label: "Lớp 6" },
];

// Subject color mapping
const getSubjectColors = (subject: string): [string, string] => {
  const colorMap: Record<string, [string, string]> = {
    math: ["#3B82F6", "#2563EB"],
    english: ["#10B981", "#059669"],
    physics: ["#8B5CF6", "#7C3AED"],
    chemistry: ["#F59E0B", "#D97706"],
    biology: ["#EC4899", "#DB2777"],
    literature: ["#6366F1", "#4F46E5"],
    history: ["#F97316", "#EA580C"],
    geography: ["#14B8A6", "#0D9488"],
  };
  return colorMap[subject] || ["#6B7280", "#4B5563"];
};

export default function ClassesScreen() {
  const { classes, isLoading, fetchClasses, updateClass, createClass } =
    useClassesStore();
  const { branches, fetchBranches } = useBranchesStore();
  const { users, fetchUsers } = useUsersStore();
  const { user } = useAuthStore();
  const [activeFilter, setActiveFilter] = useState<
    "all" | "active" | "inactive"
  >("all");
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [isDetailVisible, setIsDetailVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    maxStudents: "",
    tuitionFee: "",
    description: "",
  });

  // Create Class Modal states
  const [isCreateVisible, setIsCreateVisible] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    subject: "",
    grade: "",
    branchId: "",
    teacherId: "",
    description: "",
    maxStudents: "30",
  });
  const [schedules, setSchedules] = useState<
    Array<{
      daysOfWeek: number[];
      startTime: string;
      endTime: string;
    }>
  >([]);
  const [activeCreatePicker, setActiveCreatePicker] = useState<
    "subject" | "grade" | "branch" | "teacher" | null
  >(null);
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [showStudentsList, setShowStudentsList] = useState(false);
  const [studentSearchQuery, setStudentSearchQuery] = useState("");
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [studentsList, setStudentsList] = useState<
    Array<{ _id: string; fullName?: string; name?: string; email: string }>
  >([]);

  const isAdmin = user?.role === "admin";
  const isParent = user?.role === "parent";
  const teachers = users.filter((u) => u.role === "teacher");

  // Multi-child support for parent
  const { children, selectedChild, fetchChildren } = useChildrenStore();

  useEffect(() => {
    const loadData = async () => {
      if (isParent && user?._id) {
        await fetchChildren(user._id);
        const child = useChildrenStore.getState().selectedChild;
        if (child) {
          await fetchClasses(undefined, child._id);
        } else {
          await fetchClasses();
        }
      } else {
        await fetchClasses();
      }
      fetchBranches();
      fetchUsers();
    };
    loadData();
  }, []);

  // Re-fetch classes when selected child changes
  useEffect(() => {
    if (isParent && selectedChild?._id) {
      fetchClasses(undefined, selectedChild._id);
    }
  }, [selectedChild?._id]);

  const onRefresh = async () => {
    if (isParent && selectedChild?._id) {
      await fetchClasses(undefined, selectedChild._id);
    } else {
      await fetchClasses();
    }
  };

  const filteredClasses = classes.filter((c) => {
    if (activeFilter === "active") return c.isActive;
    if (activeFilter === "inactive") return !c.isActive;
    return true;
  });

  const getScheduleText = (
    schedule: { dayOfWeek: number; startTime: string; endTime: string }[],
  ) => {
    return schedule
      .map((s) => `${DAYS_OF_WEEK[s.dayOfWeek]} ${s.startTime}-${s.endTime}`)
      .join(", ");
  };

  const openDetail = (classItem: Class) => {
    setSelectedClass(classItem);
    setEditForm({
      name: classItem.name,
      maxStudents: classItem.maxStudents?.toString() || "30",
      tuitionFee: classItem.tuitionFee?.toString() || "0",
      description: classItem.description || "",
    });
    setIsDetailVisible(true);
    setIsEditing(false);
  };

  const closeDetail = () => {
    setIsDetailVisible(false);
    setSelectedClass(null);
    setIsEditing(false);
    setShowStudentsList(false);
    setStudentsList([]);
    setStudentSearchQuery("");
  };

  const openCreateModal = () => {
    setCreateForm({
      name: "",
      subject: "",
      grade: "",
      branchId: "",
      teacherId: "",
      description: "",
      maxStudents: "30",
    });
    setSchedules([]);
    setActiveCreatePicker(null);
    setIsCreateVisible(true);
  };

  const closeCreateModal = () => {
    setActiveCreatePicker(null);
    setIsCreateVisible(false);
  };

  // Auto-generate name when subject and grade change
  useEffect(() => {
    if (createForm.subject && createForm.grade) {
      const subjectLabel =
        SUBJECTS.find((s) => s.value === createForm.subject)?.label ||
        createForm.subject;
      setCreateForm((prev) => ({
        ...prev,
        name: `${subjectLabel} - Lớp ${createForm.grade}`,
      }));
    }
  }, [createForm.subject, createForm.grade]);

  const handleCreateClass = async () => {
    if (!createForm.name || !createForm.branchId || !createForm.teacherId) {
      Alert.alert("Lỗi", "Vui lòng điền đầy đủ thông tin bắt buộc");
      return;
    }

    setIsCreating(true);
    try {
      await createClass({
        name: createForm.name,
        subject: createForm.subject,
        grade: createForm.grade,
        branchId: createForm.branchId,
        teacherId: createForm.teacherId,
        description: createForm.description,
        maxStudents: parseInt(createForm.maxStudents) || 30,
        schedule: schedules.flatMap((sch) =>
          sch.daysOfWeek.map((day) => ({
            dayOfWeek: day,
            startTime: sch.startTime,
            endTime: sch.endTime,
          })),
        ),
      });
      Alert.alert("Thành công", "Đã tạo lớp học mới");
      closeCreateModal();
      fetchClasses();
    } catch (error: any) {
      Alert.alert("Lỗi", error.message || "Không thể tạo lớp học");
    } finally {
      setIsCreating(false);
    }
  };

  const addSchedule = () => {
    setSchedules([
      ...schedules,
      { daysOfWeek: [1], startTime: "08:00", endTime: "10:00" },
    ]);
  };

  const removeSchedule = (index: number) => {
    setSchedules(schedules.filter((_, i) => i !== index));
  };

  const updateSchedule = (
    index: number,
    field: string,
    value: number | string,
  ) => {
    const newSchedules = [...schedules];
    if (field === "dayOfWeek") {
      const day = value as number;
      const current = newSchedules[index].daysOfWeek;
      newSchedules[index] = {
        ...newSchedules[index],
        daysOfWeek: current.includes(day)
          ? current.filter((d) => d !== day)
          : [...current, day],
      };
    } else {
      newSchedules[index] = { ...newSchedules[index], [field]: value };
    }
    setSchedules(newSchedules);
  };

  const handleSaveEdit = async () => {
    if (!selectedClass) return;

    try {
      await api.patch(`/classes/${selectedClass._id}`, {
        name: editForm.name,
        maxStudents: parseInt(editForm.maxStudents) || 30,
        tuitionFee: parseInt(editForm.tuitionFee) || 0,
        description: editForm.description,
      });
      Alert.alert("Thành công", "Đã cập nhật thông tin lớp học");
      fetchClasses();
      setIsEditing(false);
    } catch (error) {
      Alert.alert("Lỗi", "Không thể cập nhật lớp học");
    }
  };

  const getTeacherName = (classItem: any): string => {
    if (classItem.teacher) {
      return (
        classItem.teacher?.fullName ||
        classItem.teacher?.name ||
        "Chưa phân công"
      );
    }
    if (classItem.teacher?.name) return classItem.teacher.name;
    return "Chưa phân công";
  };

  const getBranchName = (classItem: any): string => {
    if (classItem.branch) {
      return classItem.branch?.name;
    }
    if (classItem.branch?.name) return classItem.branch.name;
    return "Chưa xác định";
  };

  const renderClassItem = ({ item }: { item: Class }) => {
    const subjectColors = getSubjectColors(item.subject);
    return (
      <TouchableOpacity
        style={styles.classCard}
        activeOpacity={0.7}
        onPress={() => openDetail(item)}
      >
        <View style={styles.classHeader}>
          <LinearGradient
            colors={item.isActive ? subjectColors : ["#E5E7EB", "#D1D5DB"]}
            style={styles.subjectIcon}
          >
            <Ionicons
              name="book"
              size={22}
              color={item.isActive ? "#FFFFFF" : "#9CA3AF"}
            />
          </LinearGradient>
          <View style={styles.classMainInfo}>
            <Text style={styles.className}>{item.name}</Text>
            <Text style={styles.classSubject}>
              {getSubjectLabel(item.subject)}
            </Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              item.isActive ? styles.activeBadge : styles.inactiveBadge,
            ]}
          >
            <View
              style={[
                styles.statusDot,
                item.isActive ? styles.activeDot : styles.inactiveDot,
              ]}
            />
            <Text
              style={[
                styles.statusText,
                item.isActive ? styles.activeText : styles.inactiveText,
              ]}
            >
              {item.isActive ? "Đang học" : "Kết thúc"}
            </Text>
          </View>
        </View>

        <View style={styles.classDetails}>
          {item.schedule && item.schedule.length > 0 && (
            <View style={styles.detailRow}>
              <View style={styles.detailIconBg}>
                <Ionicons name="calendar-outline" size={14} color="#3B82F6" />
              </View>
              <Text style={styles.detailText}>
                {getScheduleText(item.schedule)}
              </Text>
            </View>
          )}

          <View style={styles.detailRow}>
            <View style={styles.detailIconBg}>
              <Ionicons name="people-outline" size={14} color="#10B981" />
            </View>
            <Text style={styles.detailText}>
              {item.studentIds?.length || 0}/{item.maxStudents} học sinh
            </Text>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBar,
                  {
                    width: `${((item.studentIds?.length || 0) / item.maxStudents) * 100}%`,
                  },
                ]}
              />
            </View>
          </View>

          <View style={styles.detailRow}>
            <View style={styles.detailIconBg}>
              <Ionicons name="cash-outline" size={14} color="#F59E0B" />
            </View>
            <Text style={styles.detailText}>
              {new Intl.NumberFormat("vi-VN").format(item.tuitionFee)} VNĐ/tháng
            </Text>
          </View>
        </View>

        <View style={styles.classFooter}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => openDetail(item)}
          >
            <Ionicons
              name="information-circle-outline"
              size={18}
              color="#3B82F6"
            />
            <Text style={styles.actionText}>Chi tiết</Text>
          </TouchableOpacity>
          {isAdmin && (
            <>
              <View style={styles.actionDivider} />
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  openDetail(item);
                  setTimeout(() => setIsEditing(true), 100);
                }}
              >
                <Ionicons name="create-outline" size={18} color="#F59E0B" />
                <Text style={[styles.actionText, { color: "#F59E0B" }]}>
                  Sửa
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const filters = [
    { key: "all" as const, label: "Tất cả", count: classes.length },
    {
      key: "active" as const,
      label: "Đang học",
      count: classes.filter((c) => c.isActive).length,
    },
    {
      key: "inactive" as const,
      label: "Đã kết thúc",
      count: classes.filter((c) => !c.isActive).length,
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={["left", "right"]}>
      {/* Child Selector for Parent */}
      {isParent && <ChildSelector />}

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {filters.map((filter) => (
            <TouchableOpacity
              key={filter.key}
              style={[
                styles.filterTab,
                activeFilter === filter.key && styles.filterTabActive,
              ]}
              onPress={() => setActiveFilter(filter.key)}
            >
              <Text
                style={[
                  styles.filterText,
                  activeFilter === filter.key && styles.filterTextActive,
                ]}
              >
                {filter.label}
              </Text>
              <View
                style={[
                  styles.filterBadge,
                  activeFilter === filter.key && styles.filterBadgeActive,
                ]}
              >
                <Text
                  style={[
                    styles.filterBadgeText,
                    activeFilter === filter.key && styles.filterBadgeTextActive,
                  ]}
                >
                  {filter.count}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filteredClasses}
        keyExtractor={(item) => item._id}
        renderItem={renderClassItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <LinearGradient
              colors={["#F3F4F6", "#E5E7EB"]}
              style={styles.emptyIconBg}
            >
              <Ionicons name="school-outline" size={48} color="#9CA3AF" />
            </LinearGradient>
            <Text style={styles.emptyTitle}>Chưa có lớp học</Text>
            <Text style={styles.emptyText}>
              Bạn chưa được phân công vào lớp học nào
            </Text>
          </View>
        }
      />

      {/* Class Detail Modal */}
      <Modal
        visible={isDetailVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeDetail}
      >
        <SafeAreaView style={styles.modalContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => {
                if (showStudentsList) {
                  setShowStudentsList(false);
                } else {
                  closeDetail();
                }
              }}
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={24} color="#1F2937" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {showStudentsList
                ? "Danh sách học sinh"
                : isEditing
                  ? "Chỉnh sửa lớp học"
                  : "Chi tiết lớp học"}
            </Text>
            {isAdmin && !isEditing && (
              <TouchableOpacity
                onPress={() => setIsEditing(true)}
                style={styles.editButton}
              >
                <Ionicons name="create-outline" size={22} color="#3B82F6" />
              </TouchableOpacity>
            )}
            {isEditing && (
              <TouchableOpacity
                onPress={() => setIsEditing(false)}
                style={styles.editButton}
              >
                <Ionicons name="close" size={22} color="#6B7280" />
              </TouchableOpacity>
            )}
            {!isAdmin && !showStudentsList && <View style={{ width: 40 }} />}
            {showStudentsList && <View style={{ width: 40 }} />}
          </View>

          {selectedClass && showStudentsList ? (
            /* ===== STUDENT LIST VIEW (inside detail modal) ===== */
            <View style={{ flex: 1 }}>
              {/* Class info header */}
              <LinearGradient
                colors={getSubjectColors(selectedClass.subject)}
                style={{
                  marginHorizontal: 16,
                  marginTop: 12,
                  borderRadius: 16,
                  padding: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <Ionicons name="book" size={24} color="#FFFFFF" />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: "700",
                      color: "#FFFFFF",
                    }}
                  >
                    {selectedClass.name}
                  </Text>
                  <Text
                    style={{
                      fontSize: 13,
                      color: "rgba(255,255,255,0.8)",
                      marginTop: 2,
                    }}
                  >
                    {getSubjectLabel(selectedClass.subject)} •{" "}
                    {studentsList.length} học sinh
                  </Text>
                </View>
              </LinearGradient>

              {/* Search bar */}
              <View
                style={{
                  marginHorizontal: 16,
                  marginTop: 12,
                  marginBottom: 8,
                  backgroundColor: "#F3F4F6",
                  borderRadius: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 12,
                }}
              >
                <Ionicons name="search" size={20} color="#9CA3AF" />
                <TextInput
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    paddingHorizontal: 8,
                    fontSize: 15,
                    color: "#111827",
                  }}
                  placeholder="Tìm kiếm học sinh..."
                  placeholderTextColor="#9CA3AF"
                  value={studentSearchQuery}
                  onChangeText={setStudentSearchQuery}
                />
                {studentSearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setStudentSearchQuery("")}>
                    <Ionicons name="close-circle" size={20} color="#9CA3AF" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Student list */}
              {loadingStudents ? (
                <View
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    alignItems: "center",
                    paddingTop: 60,
                  }}
                >
                  <ActivityIndicator size="large" color="#3B82F6" />
                  <Text
                    style={{ fontSize: 14, color: "#6B7280", marginTop: 12 }}
                  >
                    Đang tải danh sách học sinh...
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={studentsList.filter((s) => {
                    if (!studentSearchQuery.trim()) return true;
                    const q = studentSearchQuery.toLowerCase();
                    const sName = (s.fullName || s.name || "").toLowerCase();
                    const sEmail = (s.email || "").toLowerCase();
                    return sName.includes(q) || sEmail.includes(q);
                  })}
                  keyExtractor={(item) => item._id}
                  contentContainerStyle={{
                    paddingHorizontal: 16,
                    paddingBottom: 40,
                  }}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item, index }) => (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: "#FFFFFF",
                        borderRadius: 14,
                        padding: 14,
                        marginBottom: 8,
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.04,
                        shadowRadius: 4,
                        elevation: 1,
                      }}
                    >
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 16,
                          backgroundColor: index < 3 ? "#EFF6FF" : "#F3F4F6",
                          justifyContent: "center",
                          alignItems: "center",
                          marginRight: 12,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: "700",
                            color: index < 3 ? "#3B82F6" : "#6B7280",
                          }}
                        >
                          {index + 1}
                        </Text>
                      </View>
                      <View
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 22,
                          backgroundColor: "#EFF6FF",
                          justifyContent: "center",
                          alignItems: "center",
                          marginRight: 12,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 16,
                            fontWeight: "bold",
                            color: "#3B82F6",
                          }}
                        >
                          {(item.fullName || item.name || "?")
                            .charAt(0)
                            .toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontSize: 15,
                            fontWeight: "600",
                            color: "#111827",
                          }}
                        >
                          {item.fullName || item.name || "Chưa cập nhật"}
                        </Text>
                        <Text
                          style={{
                            fontSize: 13,
                            color: "#6B7280",
                            marginTop: 2,
                          }}
                        >
                          {item.email}
                        </Text>
                      </View>
                      <Ionicons
                        name="person-circle-outline"
                        size={24}
                        color="#D1D5DB"
                      />
                    </View>
                  )}
                  ListEmptyComponent={
                    <View style={{ alignItems: "center", paddingVertical: 48 }}>
                      <Ionicons
                        name="people-outline"
                        size={56}
                        color="#D1D5DB"
                      />
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: "600",
                          color: "#6B7280",
                          marginTop: 12,
                        }}
                      >
                        {studentSearchQuery
                          ? "Không tìm thấy học sinh"
                          : "Chưa có học sinh"}
                      </Text>
                      <Text
                        style={{ fontSize: 14, color: "#9CA3AF", marginTop: 4 }}
                      >
                        {studentSearchQuery
                          ? "Thử tìm với từ khóa khác"
                          : "Lớp học chưa có học sinh nào"}
                      </Text>
                    </View>
                  }
                />
              )}
            </View>
          ) : selectedClass ? (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 16 }}
              showsVerticalScrollIndicator={false}
            >
              {!isEditing ? (
                <>
                  {/* Class Header */}
                  <View style={styles.detailHeader}>
                    <LinearGradient
                      colors={getSubjectColors(selectedClass.subject)}
                      style={styles.detailHeaderIconBg}
                    >
                      <Ionicons name="book" size={32} color="#FFFFFF" />
                    </LinearGradient>
                    <Text style={styles.detailClassName}>
                      {selectedClass.name}
                    </Text>
                    <View style={styles.detailSubjectBadge}>
                      <Text style={styles.detailSubjectText}>
                        {getSubjectLabel(selectedClass.subject)}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.detailStatusBadge,
                        {
                          backgroundColor: selectedClass.isActive
                            ? "#D1FAE5"
                            : "#F3F4F6",
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.detailStatusDot,
                          {
                            backgroundColor: selectedClass.isActive
                              ? "#10B981"
                              : "#9CA3AF",
                          },
                        ]}
                      />
                      <Text
                        style={[
                          styles.detailStatusText,
                          {
                            color: selectedClass.isActive
                              ? "#059669"
                              : "#6B7280",
                          },
                        ]}
                      >
                        {selectedClass.isActive ? "Đang học" : "Đã kết thúc"}
                      </Text>
                    </View>
                  </View>

                  {/* Student Details Button */}
                  <TouchableOpacity
                    style={{
                      marginBottom: 16,
                      backgroundColor: "#EFF6FF",
                      borderRadius: 14,
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      flexDirection: "row",
                      alignItems: "center",
                      borderWidth: 1,
                      borderColor: "#DBEAFE",
                    }}
                    onPress={async () => {
                      setStudentSearchQuery("");
                      setShowStudentsList(true);
                      setLoadingStudents(true);
                      try {
                        const response = await api.get(
                          `/classes/${selectedClass._id}`,
                        );
                        const classData = response.data;
                        if (
                          classData.studentIds &&
                          Array.isArray(classData.studentIds) &&
                          classData.studentIds.length > 0 &&
                          typeof classData.studentIds[0] === "object"
                        ) {
                          setStudentsList(classData.studentIds);
                        } else if (
                          classData.students &&
                          Array.isArray(classData.students)
                        ) {
                          setStudentsList(classData.students);
                        } else {
                          setStudentsList([]);
                        }
                      } catch (err) {
                        console.error("Error fetching class students:", err);
                        setStudentsList(selectedClass.students || []);
                      } finally {
                        setLoadingStudents(false);
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="people" size={20} color="#3B82F6" />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: "600",
                          color: "#1E40AF",
                        }}
                      >
                        Chi tiết học sinh
                      </Text>
                      <Text
                        style={{ fontSize: 13, color: "#6B7280", marginTop: 2 }}
                      >
                        {selectedClass.students?.length ||
                          selectedClass.studentIds?.length ||
                          0}{" "}
                        học sinh trong lớp
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color="#3B82F6"
                    />
                  </TouchableOpacity>

                  {/* Info Cards */}
                  <View style={styles.infoGrid}>
                    <View style={styles.infoCard}>
                      <Ionicons
                        name="person-outline"
                        size={20}
                        color="#3B82F6"
                      />
                      <Text style={styles.infoLabel}>Giáo viên</Text>
                      <Text style={styles.infoValue}>
                        {getTeacherName(selectedClass)}
                      </Text>
                    </View>
                    <View style={styles.infoCard}>
                      <Ionicons
                        name="business-outline"
                        size={20}
                        color="#10B981"
                      />
                      <Text style={styles.infoLabel}>Cơ sở</Text>
                      <Text style={styles.infoValue}>
                        {getBranchName(selectedClass)}
                      </Text>
                    </View>
                    <View style={styles.infoCard}>
                      <Ionicons
                        name="people-outline"
                        size={20}
                        color="#F59E0B"
                      />
                      <Text style={styles.infoLabel}>Sĩ số</Text>
                      <Text style={styles.infoValue}>
                        {selectedClass.studentIds?.length || 0}/
                        {selectedClass.maxStudents}
                      </Text>
                    </View>
                    <View style={styles.infoCard}>
                      <Ionicons name="cash-outline" size={20} color="#8B5CF6" />
                      <Text style={styles.infoLabel}>Học phí</Text>
                      <Text style={styles.infoValue}>
                        {new Intl.NumberFormat("vi-VN").format(
                          selectedClass.tuitionFee || 0,
                        )}
                        đ
                      </Text>
                    </View>
                  </View>

                  {/* Schedule */}
                  {selectedClass.schedule &&
                    selectedClass.schedule.length > 0 && (
                      <View style={styles.scheduleSection}>
                        <Text style={styles.sectionLabel}>
                          📅 Lịch học cố định
                        </Text>
                        {selectedClass.schedule.map((sch, index) => (
                          <View key={index} style={styles.scheduleItem}>
                            <View style={styles.scheduleDayBadge}>
                              <Text style={styles.scheduleDayText}>
                                {DAYS_OF_WEEK[sch.dayOfWeek]}
                              </Text>
                            </View>
                            <View style={styles.scheduleInfo}>
                              <Text style={styles.scheduleDay}>
                                {DAYS_OF_WEEK_FULL[sch.dayOfWeek]}
                              </Text>
                              <Text style={styles.scheduleTime}>
                                🕐 {sch.startTime} - {sch.endTime}
                                {sch.room && ` • 📍 ${sch.room}`}
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}

                  {/* Description */}
                  {selectedClass.description && (
                    <View style={styles.descriptionSection}>
                      <Text style={styles.sectionLabel}>📝 Mô tả</Text>
                      <Text style={styles.descriptionText}>
                        {selectedClass.description}
                      </Text>
                    </View>
                  )}
                </>
              ) : (
                /* Edit Form */
                <View style={styles.editForm}>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Tên lớp</Text>
                    <TextInput
                      style={styles.formInput}
                      value={editForm.name}
                      onChangeText={(text) =>
                        setEditForm({ ...editForm, name: text })
                      }
                      placeholder="Nhập tên lớp"
                    />
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Sĩ số tối đa</Text>
                    <TextInput
                      style={styles.formInput}
                      value={editForm.maxStudents}
                      onChangeText={(text) =>
                        setEditForm({ ...editForm, maxStudents: text })
                      }
                      placeholder="30"
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Học phí (VNĐ/tháng)</Text>
                    <TextInput
                      style={styles.formInput}
                      value={editForm.tuitionFee}
                      onChangeText={(text) =>
                        setEditForm({ ...editForm, tuitionFee: text })
                      }
                      placeholder="0"
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Mô tả</Text>
                    <TextInput
                      style={[styles.formInput, styles.formTextarea]}
                      value={editForm.description}
                      onChangeText={(text) =>
                        setEditForm({ ...editForm, description: text })
                      }
                      placeholder="Mô tả lớp học..."
                      multiline
                      numberOfLines={4}
                    />
                  </View>
                  <TouchableOpacity
                    style={styles.saveButton}
                    onPress={handleSaveEdit}
                  >
                    <LinearGradient
                      colors={["#3B82F6", "#2563EB"]}
                      style={styles.saveButtonGradient}
                    >
                      <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                      <Text style={styles.saveButtonText}>Lưu thay đổi</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          ) : null}
        </SafeAreaView>
      </Modal>

      {/* FAB - Add Class Button (Admin only) */}
      {isAdmin && (
        <TouchableOpacity
          style={styles.fab}
          onPress={openCreateModal}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={["#3B82F6", "#2563EB"]}
            style={styles.fabGradient}
          >
            <Ionicons name="add" size={28} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Create Class Modal */}
      <Modal
        visible={isCreateVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeCreateModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1 }}
          >
            {/* Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={closeCreateModal}
                style={styles.backButton}
              >
                <Ionicons name="close" size={24} color="#1F2937" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Tạo lớp học mới</Text>
              <View style={{ width: 40 }} />
            </View>

            <ScrollView
              style={styles.modalContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Branch Picker */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Cơ sở *</Text>
                <TouchableOpacity
                  style={[
                    styles.formPicker,
                    activeCreatePicker === "branch" && styles.formPickerActive,
                  ]}
                  onPress={() =>
                    setActiveCreatePicker(
                      activeCreatePicker === "branch" ? null : "branch",
                    )
                  }
                >
                  <Text
                    style={
                      createForm.branchId
                        ? styles.formPickerText
                        : styles.formPickerPlaceholder
                    }
                  >
                    {createForm.branchId
                      ? branches.find((b) => b._id === createForm.branchId)
                          ?.name
                      : "Chọn cơ sở"}
                  </Text>
                  <Ionicons
                    name={
                      activeCreatePicker === "branch"
                        ? "chevron-up"
                        : "chevron-down"
                    }
                    size={20}
                    color="#6B7280"
                  />
                </TouchableOpacity>
                {activeCreatePicker === "branch" && (
                  <ScrollView
                    style={styles.inlineDropdown}
                    nestedScrollEnabled
                    showsVerticalScrollIndicator={false}
                  >
                    {branches.length === 0 ? (
                      <Text style={styles.inlineDropdownEmpty}>
                        Không có cơ sở nào
                      </Text>
                    ) : (
                      branches.map((item) => (
                        <TouchableOpacity
                          key={item._id}
                          style={[
                            styles.inlineDropdownItem,
                            createForm.branchId === item._id &&
                              styles.inlineDropdownItemActive,
                          ]}
                          onPress={() => {
                            setCreateForm((prev) => ({
                              ...prev,
                              branchId: item._id,
                            }));
                            setActiveCreatePicker(null);
                          }}
                        >
                          <Text
                            style={[
                              styles.inlineDropdownText,
                              createForm.branchId === item._id &&
                                styles.inlineDropdownTextActive,
                            ]}
                          >
                            {item.name}
                          </Text>
                          {createForm.branchId === item._id && (
                            <Ionicons
                              name="checkmark"
                              size={18}
                              color="#3B82F6"
                            />
                          )}
                        </TouchableOpacity>
                      ))
                    )}
                  </ScrollView>
                )}
              </View>

              {/* Subject Picker */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Môn học *</Text>
                <TouchableOpacity
                  style={[
                    styles.formPicker,
                    activeCreatePicker === "subject" && styles.formPickerActive,
                  ]}
                  onPress={() =>
                    setActiveCreatePicker(
                      activeCreatePicker === "subject" ? null : "subject",
                    )
                  }
                >
                  <Text
                    style={
                      createForm.subject
                        ? styles.formPickerText
                        : styles.formPickerPlaceholder
                    }
                  >
                    {createForm.subject
                      ? SUBJECTS.find((s) => s.value === createForm.subject)
                          ?.label
                      : "Chọn môn học"}
                  </Text>
                  <Ionicons
                    name={
                      activeCreatePicker === "subject"
                        ? "chevron-up"
                        : "chevron-down"
                    }
                    size={20}
                    color="#6B7280"
                  />
                </TouchableOpacity>
                {activeCreatePicker === "subject" && (
                  <ScrollView
                    style={styles.inlineDropdown}
                    nestedScrollEnabled
                    showsVerticalScrollIndicator={false}
                  >
                    {SUBJECTS.map((item) => (
                      <TouchableOpacity
                        key={item.value}
                        style={[
                          styles.inlineDropdownItem,
                          createForm.subject === item.value &&
                            styles.inlineDropdownItemActive,
                        ]}
                        onPress={() => {
                          setCreateForm((prev) => ({
                            ...prev,
                            subject: item.value,
                          }));
                          setActiveCreatePicker(null);
                        }}
                      >
                        <Text
                          style={[
                            styles.inlineDropdownText,
                            createForm.subject === item.value &&
                              styles.inlineDropdownTextActive,
                          ]}
                        >
                          {item.label}
                        </Text>
                        {createForm.subject === item.value && (
                          <Ionicons
                            name="checkmark"
                            size={18}
                            color="#3B82F6"
                          />
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>

              {/* Grade Picker */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Khối lỜp *</Text>
                <TouchableOpacity
                  style={[
                    styles.formPicker,
                    activeCreatePicker === "grade" && styles.formPickerActive,
                  ]}
                  onPress={() =>
                    setActiveCreatePicker(
                      activeCreatePicker === "grade" ? null : "grade",
                    )
                  }
                >
                  <Text
                    style={
                      createForm.grade
                        ? styles.formPickerText
                        : styles.formPickerPlaceholder
                    }
                  >
                    {createForm.grade
                      ? `Lớp ${createForm.grade}`
                      : "Chọn khối lớp"}
                  </Text>
                  <Ionicons
                    name={
                      activeCreatePicker === "grade"
                        ? "chevron-up"
                        : "chevron-down"
                    }
                    size={20}
                    color="#6B7280"
                  />
                </TouchableOpacity>
                {activeCreatePicker === "grade" && (
                  <ScrollView
                    style={styles.inlineDropdown}
                    nestedScrollEnabled
                    showsVerticalScrollIndicator={false}
                  >
                    {GRADE_LEVELS.map((item) => (
                      <TouchableOpacity
                        key={item.value}
                        style={[
                          styles.inlineDropdownItem,
                          createForm.grade === item.value &&
                            styles.inlineDropdownItemActive,
                        ]}
                        onPress={() => {
                          setCreateForm((prev) => ({
                            ...prev,
                            grade: item.value,
                          }));
                          setActiveCreatePicker(null);
                        }}
                      >
                        <Text
                          style={[
                            styles.inlineDropdownText,
                            createForm.grade === item.value &&
                              styles.inlineDropdownTextActive,
                          ]}
                        >
                          {item.label}
                        </Text>
                        {createForm.grade === item.value && (
                          <Ionicons
                            name="checkmark"
                            size={18}
                            color="#3B82F6"
                          />
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}
              </View>

              {/* Auto-generated Name */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Tên lớp</Text>
                <TextInput
                  style={styles.formInput}
                  value={createForm.name}
                  onChangeText={(text) =>
                    setCreateForm({ ...createForm, name: text })
                  }
                  placeholder="Tên lớp sẽ được tự động tạo"
                />
              </View>

              {/* Teacher Picker */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Giáo viên *</Text>
                <TouchableOpacity
                  style={[
                    styles.formPicker,
                    activeCreatePicker === "teacher" && styles.formPickerActive,
                  ]}
                  onPress={() =>
                    setActiveCreatePicker(
                      activeCreatePicker === "teacher" ? null : "teacher",
                    )
                  }
                >
                  <Text
                    style={
                      createForm.teacherId
                        ? styles.formPickerText
                        : styles.formPickerPlaceholder
                    }
                  >
                    {createForm.teacherId
                      ? teachers.find((t) => t._id === createForm.teacherId)
                          ?.fullName ||
                        teachers.find((t) => t._id === createForm.teacherId)
                          ?.name
                      : "Chọn giáo viên"}
                  </Text>
                  <Ionicons
                    name={
                      activeCreatePicker === "teacher"
                        ? "chevron-up"
                        : "chevron-down"
                    }
                    size={20}
                    color="#6B7280"
                  />
                </TouchableOpacity>
                {activeCreatePicker === "teacher" && (
                  <ScrollView
                    style={styles.inlineDropdown}
                    nestedScrollEnabled
                    showsVerticalScrollIndicator={false}
                  >
                    {teachers.length === 0 ? (
                      <Text style={styles.inlineDropdownEmpty}>
                        Không có giáo viên nào
                      </Text>
                    ) : (
                      teachers.map((item) => (
                        <TouchableOpacity
                          key={item._id}
                          style={[
                            styles.inlineDropdownItem,
                            createForm.teacherId === item._id &&
                              styles.inlineDropdownItemActive,
                          ]}
                          onPress={() => {
                            setCreateForm((prev) => ({
                              ...prev,
                              teacherId: item._id,
                            }));
                            setActiveCreatePicker(null);
                          }}
                        >
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.inlineDropdownText,
                                createForm.teacherId === item._id &&
                                  styles.inlineDropdownTextActive,
                              ]}
                            >
                              {item.fullName || item.name || "Giáo viên"}
                            </Text>
                            <Text style={styles.inlineDropdownSubtext}>
                              {item.email}
                            </Text>
                          </View>
                          {createForm.teacherId === item._id && (
                            <Ionicons
                              name="checkmark"
                              size={18}
                              color="#3B82F6"
                            />
                          )}
                        </TouchableOpacity>
                      ))
                    )}
                  </ScrollView>
                )}
              </View>

              {/* Max Students */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Sĩ số tối đa</Text>
                <TextInput
                  style={styles.formInput}
                  value={createForm.maxStudents}
                  onChangeText={(text) =>
                    setCreateForm({ ...createForm, maxStudents: text })
                  }
                  placeholder="30"
                  keyboardType="numeric"
                />
              </View>

              {/* Schedules */}
              <View style={styles.formGroup}>
                <View style={styles.formLabelRow}>
                  <Text style={styles.formLabel}>Lịch học</Text>
                  <TouchableOpacity
                    onPress={addSchedule}
                    style={styles.addScheduleBtn}
                  >
                    <Ionicons name="add-circle" size={24} color="#3B82F6" />
                  </TouchableOpacity>
                </View>
                {schedules.map((sch, index) => (
                  <View key={index} style={styles.scheduleFormItem}>
                    <View style={styles.scheduleFormRow}>
                      <View style={styles.scheduleFormField}>
                        <Text style={styles.scheduleFormLabel}>Ngày</Text>
                        <View style={styles.dayPickerRow}>
                          {[1, 2, 3, 4, 5, 6, 0].map((day) => (
                            <TouchableOpacity
                              key={day}
                              style={[
                                styles.dayPickerItem,
                                sch.daysOfWeek.includes(day) &&
                                  styles.dayPickerItemActive,
                              ]}
                              onPress={() =>
                                updateSchedule(index, "dayOfWeek", day)
                              }
                            >
                              <Text
                                style={[
                                  styles.dayPickerText,
                                  sch.daysOfWeek.includes(day) &&
                                    styles.dayPickerTextActive,
                                ]}
                              >
                                {DAYS_OF_WEEK[day]}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    </View>
                    <View style={styles.scheduleFormRow}>
                      <View style={[styles.scheduleFormField, { flex: 1 }]}>
                        <Text style={styles.scheduleFormLabel}>Bắt đầu</Text>
                        <TextInput
                          style={styles.timeInput}
                          value={sch.startTime}
                          onChangeText={(text) =>
                            updateSchedule(index, "startTime", text)
                          }
                          placeholder="08:00"
                        />
                      </View>
                      <View style={[styles.scheduleFormField, { flex: 1 }]}>
                        <Text style={styles.scheduleFormLabel}>Kết thúc</Text>
                        <TextInput
                          style={styles.timeInput}
                          value={sch.endTime}
                          onChangeText={(text) =>
                            updateSchedule(index, "endTime", text)
                          }
                          placeholder="10:00"
                        />
                      </View>
                      <TouchableOpacity
                        style={styles.removeScheduleBtn}
                        onPress={() => removeSchedule(index)}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={20}
                          color="#EF4444"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>

              {/* Description */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Mô tả</Text>
                <TextInput
                  style={[styles.formInput, styles.formTextarea]}
                  value={createForm.description}
                  onChangeText={(text) =>
                    setCreateForm({ ...createForm, description: text })
                  }
                  placeholder="Mô tả lớp học..."
                  multiline
                  numberOfLines={4}
                />
              </View>

              {/* Create Button */}
              <TouchableOpacity
                style={[styles.saveButton, isCreating && { opacity: 0.7 }]}
                onPress={handleCreateClass}
                disabled={isCreating}
              >
                <LinearGradient
                  colors={["#10B981", "#059669"]}
                  style={styles.saveButtonGradient}
                >
                  {isCreating ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Ionicons name="add-circle" size={20} color="#FFFFFF" />
                      <Text style={styles.saveButtonText}>Tạo lớp học</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <View style={{ height: 40 }} />
            </ScrollView>
          </KeyboardAvoidingView>
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
  filterContainer: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  filterScroll: {
    paddingHorizontal: 16,
  },
  filterTab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 10,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
  },
  filterTabActive: {
    backgroundColor: "#EFF6FF",
  },
  filterText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
    marginRight: 8,
  },
  filterTextActive: {
    color: "#3B82F6",
    fontWeight: "600",
  },
  filterBadge: {
    backgroundColor: "#E5E7EB",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  filterBadgeActive: {
    backgroundColor: "#3B82F6",
  },
  filterBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  filterBadgeTextActive: {
    color: "#FFFFFF",
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
    flexGrow: 1,
  },
  classCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  classHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  subjectIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  classMainInfo: {
    flex: 1,
  },
  className: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 3,
  },
  classSubject: {
    fontSize: 14,
    color: "#6B7280",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  activeBadge: {
    backgroundColor: "#D1FAE5",
  },
  inactiveBadge: {
    backgroundColor: "#F3F4F6",
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  activeDot: {
    backgroundColor: "#10B981",
  },
  inactiveDot: {
    backgroundColor: "#9CA3AF",
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  activeText: {
    color: "#059669",
  },
  inactiveText: {
    color: "#6B7280",
  },
  classDetails: {
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  detailIconBg: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  detailText: {
    fontSize: 14,
    color: "#4B5563",
    flex: 1,
  },
  progressBarBg: {
    width: 60,
    height: 6,
    backgroundColor: "#E5E7EB",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#10B981",
    borderRadius: 3,
  },
  classFooter: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    gap: 8,
  },
  actionDivider: {
    width: 1,
    height: 24,
    backgroundColor: "#E5E7EB",
  },
  actionText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3B82F6",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
  },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
  },
  // Modal Styles
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
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  editButton: {
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
  detailHeader: {
    alignItems: "center",
    marginBottom: 24,
  },
  detailHeaderIconBg: {
    width: 72,
    height: 72,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  detailClassName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1F2937",
    textAlign: "center",
    marginBottom: 8,
  },
  detailSubjectBadge: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 12,
  },
  detailSubjectText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3B82F6",
  },
  detailStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  detailStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  detailStatusText: {
    fontSize: 14,
    fontWeight: "600",
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 24,
  },
  infoCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  infoLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 8,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1F2937",
  },
  scheduleSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 12,
  },
  scheduleItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  scheduleDayBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  scheduleDayText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  scheduleInfo: {
    flex: 1,
  },
  scheduleDay: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1F2937",
    marginBottom: 2,
  },
  scheduleTime: {
    fontSize: 13,
    color: "#6B7280",
  },
  descriptionSection: {
    marginBottom: 24,
  },
  descriptionText: {
    fontSize: 14,
    color: "#4B5563",
    lineHeight: 22,
    backgroundColor: "#F9FAFB",
    padding: 16,
    borderRadius: 12,
  },
  // Edit Form
  editForm: {
    paddingBottom: 32,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#1F2937",
  },
  formTextarea: {
    height: 100,
    textAlignVertical: "top",
  },
  saveButton: {
    marginTop: 12,
    borderRadius: 12,
    overflow: "hidden",
  },
  saveButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  // FAB
  fab: {
    position: "absolute",
    right: 20,
    bottom: 90,
    zIndex: 100,
  },
  fabGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  // Form Picker
  formPicker: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F9FAFB",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  formPickerText: {
    fontSize: 16,
    color: "#1F2937",
  },
  formPickerPlaceholder: {
    fontSize: 16,
    color: "#9CA3AF",
  },
  formPickerActive: {
    borderColor: "#3B82F6",
    backgroundColor: "#F0F9FF",
  },
  inlineDropdown: {
    marginTop: 4,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#3B82F6",
    borderRadius: 12,
    maxHeight: 220,
  },
  inlineDropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  inlineDropdownItemActive: {
    backgroundColor: "#EFF6FF",
  },
  inlineDropdownText: {
    fontSize: 15,
    color: "#1F2937",
  },
  inlineDropdownTextActive: {
    color: "#3B82F6",
    fontWeight: "600",
  },
  inlineDropdownSubtext: {
    fontSize: 12,
    color: "#9CA3AF",
    marginTop: 2,
  },
  inlineDropdownEmpty: {
    padding: 16,
    textAlign: "center",
    color: "#9CA3AF",
    fontSize: 14,
  },
  formLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  addScheduleBtn: {
    padding: 4,
  },
  scheduleFormItem: {
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  scheduleFormRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
    marginBottom: 12,
  },
  scheduleFormField: {
    flex: 1,
  },
  scheduleFormLabel: {
    fontSize: 12,
    color: "#6B7280",
    marginBottom: 6,
  },
  dayPickerRow: {
    flexDirection: "row",
    gap: 4,
  },
  dayPickerItem: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  dayPickerItemActive: {
    backgroundColor: "#3B82F6",
    borderColor: "#3B82F6",
  },
  dayPickerText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  dayPickerTextActive: {
    color: "#FFFFFF",
  },
  timeInput: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1F2937",
    textAlign: "center",
  },
  removeScheduleBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
  },
  // Picker Modal
  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  pickerContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "60%",
    paddingBottom: 34,
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1F2937",
  },
  pickerItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  pickerItemActive: {
    backgroundColor: "#EFF6FF",
  },
  pickerItemText: {
    fontSize: 16,
    color: "#1F2937",
  },
  pickerItemTextActive: {
    color: "#3B82F6",
    fontWeight: "600",
  },
  pickerItemSubtext: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },
  emptyPicker: {
    padding: 40,
    alignItems: "center",
  },
  emptyPickerText: {
    fontSize: 14,
    color: "#9CA3AF",
  },
});
