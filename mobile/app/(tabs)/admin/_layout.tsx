import { Stack } from "expo-router";
import { TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

export default function AdminLayout() {
  const BackButton = () => (
    <TouchableOpacity
      onPress={() => router.replace("/(tabs)/admin")}
      style={{ marginLeft: 8, padding: 8 }}
    >
      <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
    </TouchableOpacity>
  );

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: "#8B5CF6",
        },
        headerTintColor: "#FFFFFF",
        headerTitleStyle: {
          fontWeight: "600",
        },
        headerBackTitle: "Quay lại",
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          headerShown: false,
          title: "Admin Dashboard",
        }}
      />
      <Stack.Screen
        name="accounts"
        options={{
          headerShown: true,
          title: "Quản lý tài khoản",
          headerLeft: () => <BackButton />,
        }}
      />
      <Stack.Screen
        name="branches"
        options={{
          headerShown: true,
          title: "Quản lý cơ sở",
          headerLeft: () => <BackButton />,
        }}
      />
      <Stack.Screen
        name="incidents"
        options={{
          headerShown: true,
          title: "Quản lý sự cố",
          headerLeft: () => <BackButton />,
        }}
      />
      <Stack.Screen
        name="payments"
        options={{
          headerShown: true,
          title: "Quản lý thanh toán",
          headerLeft: () => <BackButton />,
        }}
      />
      <Stack.Screen
        name="attendance"
        options={{
          headerShown: true,
          title: "Quản lý điểm danh",
          headerLeft: () => <BackButton />,
        }}
      />
      <Stack.Screen
        name="class-transfer"
        options={{
          headerShown: true,
          title: "Duyệt chuyển lớp",
          headerLeft: () => <BackButton />,
        }}
      />
      <Stack.Screen
        name="finance"
        options={{
          headerShown: true,
          title: "Quản lý tài chính",
          headerLeft: () => <BackButton />,
        }}
      />
      <Stack.Screen
        name="leaderboard"
        options={{
          headerShown: true,
          title: "Bảng xếp hạng",
          headerLeft: () => <BackButton />,
        }}
      />
      <Stack.Screen
        name="evaluations"
        options={{
          headerShown: true,
          title: "Quản lý đánh giá",
          headerLeft: () => <BackButton />,
        }}
      />
      <Stack.Screen
        name="payroll"
        options={{
          headerShown: true,
          title: "Tính lương (70/30)",
          headerLeft: () => <BackButton />,
        }}
      />
    </Stack>
  );
}
