import { userContext } from "@/components/context/userContext";
import { useContext } from "react";
import { View, Pressable, Image } from "react-native";
import { router } from "expo-router";
import { Icon, Text, useTheme } from "react-native-paper";
import { format } from "date-fns";
import { useProfileData } from "@/components/context/profileDataContext";

export default function ProfileScreen() {
  const ctx = useContext(userContext);
  const theme = useTheme();

  const { profile, loading: profileLoading } = useProfileData();

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
        paddingBottom: 100,
      }}
    >
      {/* Header buttons */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "flex-end",
          alignItems: "center",
          marginTop: 16,
          marginBottom: 32,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            gap: 12,
          }}
        >
          {/* Settings */}
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

          {/* Logout */}
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

      {/* Profile content */}
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          gap: 16,
        }}
      >
        {/* Avatar */}
        {profileLoading ? (
          <View
            style={{
              width: 110,
              height: 110,
              borderRadius: 55,
              backgroundColor: theme.colors.surfaceVariant,
            }}
          />
        ) : profile?.avatar_url ? (
          <Image
            source={{ uri: profile.avatar_url }}
            style={{
              width: 110,
              height: 110,
              borderRadius: 55,
            }}
          />
        ) : (
          <View
            style={{
              width: 110,
              height: 110,
              borderRadius: 55,
              backgroundColor: theme.colors.surfaceVariant,
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <Icon
              source="account"
              size={60}
              color={theme.colors.onSurfaceVariant}
            />
          </View>
        )}

        {/* Display name */}
        <Text variant="headlineSmall">
          {profileLoading ? "..." : profile?.display_name || "No name set"}
        </Text>

        {/* Primary goal */}
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
            style={{
              color: theme.colors.onSurfaceVariant,
            }}
          >
            Primary Goal
          </Text>

          <Text
            variant="titleMedium"
            style={{
              color: theme.colors.onSurfaceVariant,
              marginTop: 4,
            }}
          >
            {profileLoading ? "..." : profile?.primary_goal || "Not set"}
          </Text>
        </View>

        {/* Member since */}
        <Text
          variant="bodySmall"
          style={{
            marginTop: 16,
            color: theme.colors.onSurfaceVariant,
          }}
        >
          {profileLoading
            ? ""
            : profile?.created_at
              ? `Member since ${format(
                  new Date(profile.created_at),
                  "MMMM d, yyyy",
                )}`
              : ""}
        </Text>
      </View>
    </View>
  );
}
