import { Ionicons } from "@expo/vector-icons";
import { format } from "date-fns";
import { router } from "expo-router";
import { useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { ActivityIndicator } from "react-native-paper";

import { getAge, useProfileData } from "@/components/context/profileDataContext";
import { useScreenInteractive } from "@/components/context/startupContext";
import { useThemeMode } from "@/components/context/ThemeContext";
import { useUserContext } from "@/components/context/userContext";
import { ThemedText } from "@/components/themed-text";
import { ScreenView } from "@/components/ui/ScreenView";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { formatHeight as formatStoredHeight } from "@/lib/height";

const GOAL_LABELS: Record<string, string> = {
  muscle: "Build muscle",
  weight: "Manage weight",
  endurance: "Build endurance",
  mobility: "Improve mobility",
};

function formatHeight(height: number | null) {
  return height ? formatStoredHeight(height) : "Not set";
}

function formatAge(age: number | null) {
  return age === null ? "Add your birthday" : `${age}`;
}

function formatSex(sex: boolean | null) {
  if (sex === true) return "Male";
  if (sex === false) return "Female";
  return "Not set";
}

export default function ProfileScreen() {
  const { resolvedTheme } = useThemeMode();
  const colors = Colors[resolvedTheme];
  const { profile, loading } = useProfileData();
  const { logout } = useUserContext();
  const [loggingOut, setLoggingOut] = useState(false);
  useScreenInteractive(!loading);

  const handleLogout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);
    try {
      await logout();
      router.replace("/(auth)/login");
    } finally {
      setLoggingOut(false);
    }
  };

  // The Settings button opens Settings as a whole; the goal card and the
  // wellness Edit link open the one section they're about.
  const openSettings = (section?: "goal" | "wellness") =>
    router.push(section ? { pathname: "/settings", params: { section } } : "/settings");

  const memberSince = profile?.created_at
    ? format(new Date(profile.created_at), "MMMM d, yyyy")
    : null;

  const goalLabel = profile?.primary_goal
    ? (GOAL_LABELS[profile.primary_goal] ?? profile.primary_goal)
    : "Not set yet";

  return (
    <ScreenView contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View>
          <ThemedText style={styles.eyebrow} themeColor="brand">
            YOUR ACCOUNT
          </ThemedText>
          <ThemedText style={styles.pageTitle}>Profile</ThemedText>
        </View>
      </View>

      <View
        style={[
          styles.heroCard,
          {
            backgroundColor: colors.backgroundElement,
            borderColor: colors.border,
          },
        ]}
      >
        {loading ? (
          <View
            style={[
              styles.avatar,
              styles.avatarPlaceholder,
              { backgroundColor: colors.brandSoft },
            ]}
          >
            <ActivityIndicator />
          </View>
        ) : profile?.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
        ) : (
          <View
            style={[
              styles.avatar,
              styles.avatarPlaceholder,
              { backgroundColor: colors.brandSoft },
            ]}
          >
            <Ionicons name="person" size={48} color={colors.brand} />
          </View>
        )}

        <View style={styles.heroCopy}>
          <ThemedText style={styles.name} numberOfLines={1}>
            {loading ? "Loading..." : profile?.display_name || "No name set"}
          </ThemedText>
          {memberSince ? (
            <ThemedText type="small" themeColor="textSecondary">
              Member since {memberSince}
            </ThemedText>
          ) : null}
        </View>

        <Pressable
          onPress={() => openSettings()}
          accessibilityRole="button"
          accessibilityLabel="Open settings"
          style={({ pressed }) => [
            styles.editButton,
            { backgroundColor: colors.brandSoft },
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name="settings-outline"
            size={17}
            color={colors.brandStrong}
          />
          <ThemedText type="smallBold" style={{ color: colors.brandStrong }}>
            Settings
          </ThemedText>
        </Pressable>

        <View style={[styles.heroDivider, { backgroundColor: colors.border }]} />

        <View style={styles.wellnessHeader}>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.wellnessTitle}>Wellness details</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Used for your personalized estimates
            </ThemedText>
          </View>
          <Pressable
            onPress={() => openSettings("wellness")}
            accessibilityRole="button"
            accessibilityLabel="Edit wellness details"
            hitSlop={8}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <ThemedText type="smallBold" style={{ color: colors.brand }}>
              Edit
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.statsGrid}>
          <DetailTile
            icon="resize-outline"
            label="Height"
            value={loading ? "..." : formatHeight(profile?.height ?? null)}
          />
          <DetailTile
            icon="scale-outline"
            label="Weight"
            value={
              loading
                ? "..."
                : profile?.weight
                  ? `${profile.weight} lb`
                  : "Not set"
            }
          />
          <DetailTile
            icon="calendar-outline"
            label="Age"
            value={loading ? "..." : formatAge(getAge(profile))}
          />
          <DetailTile
            icon="person-outline"
            label="Sex"
            value={loading ? "..." : formatSex(profile?.sex ?? null)}
          />
        </View>
      </View>

      <Pressable
        onPress={() => openSettings("goal")}
        accessibilityRole="button"
        accessibilityLabel={`Primary goal: ${goalLabel}. Change goal`}
        style={({ pressed }) => [
          styles.goalCard,
          {
            backgroundColor: colors.brandSoft,
            borderColor: colors.border,
          },
          pressed && styles.pressed,
        ]}
      >
        <View
          style={[
            styles.goalIcon,
            { backgroundColor: colors.backgroundElement },
          ]}
        >
          <Ionicons name="locate-outline" size={24} color={colors.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText type="small" themeColor="textSecondary">
            Primary goal
          </ThemedText>
          <ThemedText style={styles.goalValue}>
            {loading ? "..." : goalLabel}
          </ThemedText>
        </View>
        <Ionicons
          name="chevron-forward"
          size={20}
          color={colors.textSecondary}
        />
      </Pressable>

      <View style={styles.sectionHeader}>
        <ThemedText style={styles.sectionTitle}>Account</ThemedText>
      </View>

      <View
        style={[
          styles.menuCard,
          {
            backgroundColor: colors.backgroundElement,
            borderColor: colors.border,
          },
        ]}
      >
        <MenuRow
          icon="log-out-outline"
          title={loggingOut ? "Signing out..." : "Sign out"}
          subtitle="Sign out of this device"
          onPress={handleLogout}
          danger
          showChevron={false}
        />
      </View>
    </ScreenView>
  );
}

function DetailTile({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  const { resolvedTheme } = useThemeMode();
  const colors = Colors[resolvedTheme];

  return (
    <View
      style={[
        styles.detailTile,
        {
          backgroundColor: colors.background,
          borderColor: colors.border,
        },
      ]}
    >
      <View style={[styles.detailIcon, { backgroundColor: colors.brandSoft }]}>
        <Ionicons name={icon} size={18} color={colors.brand} />
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold" numberOfLines={1}>
        {value}
      </ThemedText>
    </View>
  );
}

function MenuRow({
  icon,
  title,
  subtitle,
  onPress,
  danger = false,
  showChevron = true,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
  danger?: boolean;
  showChevron?: boolean;
}) {
  const { resolvedTheme } = useThemeMode();
  const colors = Colors[resolvedTheme];
  const tint = danger ? colors.danger : colors.brand;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.menuRow, pressed && styles.pressed]}
    >
      <View
        style={[
          styles.menuIcon,
          { backgroundColor: danger ? "transparent" : colors.brandSoft },
        ]}
      >
        <Ionicons name={icon} size={20} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <ThemedText
          type="smallBold"
          style={danger ? { color: colors.danger } : undefined}
        >
          {title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {subtitle}
        </ThemedText>
      </View>
      {showChevron ? (
        <Ionicons
          name="chevron-forward"
          size={19}
          color={colors.textSecondary}
        />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.four,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  eyebrow: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  pageTitle: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "800",
    marginTop: 2,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: Radius.large,
    padding: Spacing.four,
    alignItems: "center",
  },
  avatar: {
    width: 104,
    height: 104,
    borderRadius: 52,
  },
  avatarPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  heroCopy: {
    alignItems: "center",
    marginTop: Spacing.three,
    maxWidth: "90%",
  },
  name: {
    fontSize: 25,
    lineHeight: 31,
    fontWeight: "800",
    marginBottom: 2,
  },
  editButton: {
    marginTop: Spacing.three,
    minHeight: 42,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
  },
  goalCard: {
    borderWidth: 1,
    borderRadius: Radius.large,
    padding: Spacing.three,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
  },
  goalIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  goalValue: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "800",
    marginTop: 2,
  },
  sectionHeader: {
    gap: 2,
  },
  sectionTitle: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: "800",
  },
  heroDivider: {
    alignSelf: "stretch",
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.four,
  },
  wellnessHeader: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    marginBottom: Spacing.three,
  },
  wellnessTitle: {
    fontSize: 18,
    lineHeight: 23,
    fontWeight: "800",
  },
  statsGrid: {
    alignSelf: "stretch",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.three,
  },
  detailTile: {
    width: "47%",
    flexGrow: 1,
    minWidth: 140,
    borderWidth: 1,
    borderRadius: Radius.medium,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  detailIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.one,
  },
  menuCard: {
    borderWidth: 1,
    borderRadius: Radius.large,
    overflow: "hidden",
  },
  menuRow: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.three,
  },
  menuIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.72,
  },
});
