import { userContext } from "@/components/context/userContext";
import { useContext } from "react";
import { View, Pressable } from "react-native";
import { router } from "expo-router";
import { Icon, Text, useTheme } from "react-native-paper";
import { format } from "date-fns";
import { useProfileData } from "@/components/context/profileDataContext";

export default function ProfileScreen() {
  const ctx = useContext(userContext);
  const theme = useTheme();
  const { profile, loading: profileLoading } = useProfileData();

  const user = ctx?.user;
  const logout = ctx?.logout;

  if (!ctx) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: theme.colors.background,
        }}
      >
        <Text variant="headlineMedium">Profile</Text>
        <Text>Loading...</Text>
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.background,
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 100, // keeps content above nav bar
      }}
    >
      {/* Header row: Profile title + settings + logout */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "flex-end",
          alignItems: "center",
          marginTop: 16,
          marginBottom: 32,
        }}
      >
        <View style={{ flexDirection: "row", gap: 12 }}>
          {/* Settings button */}
          <Pressable
            onPress={() => router.push("/settings")}
            style={{
              padding: 8,
              borderRadius: 8,
              backgroundColor: theme.colors.surfaceVariant,
            }}
          >
            <Icon
              source="cog"
              size={22}
              color={theme.colors.onSurfaceVariant}
            />
          </Pressable>

          {/* Logout button (small clickable icon) */}
          <Pressable
            onPress={() => {
              logout?.();
              router.replace("/login");
            }}
            style={{
              padding: 8,
              borderRadius: 8,
              backgroundColor: theme.colors.surfaceVariant,
            }}
          >
            <Icon
              source="logout"
              size={22}
              color={theme.colors.onSurfaceVariant}
            />
          </Pressable>
        </View>
      </View>

      {/* Centered profile content */}
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          gap: 16,
        }}
      >
        <Text variant="headlineSmall">
          {profileLoading ? "..." : profile?.display_name || "No name set"}
        </Text>

        <Text variant="bodyMedium">{user?.email || "No email found"}</Text>

        {/* Primary goal display box */}
        <View
          style={{
            marginTop: 24,
            width: "100%",
            padding: 16,
            borderRadius: 12,
            backgroundColor: theme.colors.surfaceVariant,
            alignItems: "center",
          }}
        >
          <Text
            variant="labelMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            Primary Goal
          </Text>
          <Text
            variant="titleMedium"
            style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}
          >
            {profileLoading ? "..." : profile?.primary_goal || "Not set"}
          </Text>
        </View>

        <Text
          variant="bodySmall"
          style={{ marginTop: 16, color: theme.colors.onSurfaceVariant }}
        >
          {profileLoading
            ? ""
            : profile?.created_at
              ? `Member since ${format(new Date(profile.created_at), "MMMM d, yyyy")}`
              : ""}
        </Text>
      </View>
    </View>
  );
}
