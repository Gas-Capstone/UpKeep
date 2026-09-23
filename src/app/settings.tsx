import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ActivityIndicator, TextInput } from "react-native-paper";

import { useProfileData } from "@/components/context/profileDataContext";
import { useThemeMode } from "@/components/context/ThemeContext";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Colors, MaxContentWidth, Radius, Spacing } from "@/constants/theme";
import { supabase } from "@/lib/supabaseClient";

type SectionKey = "profile" | "goal" | "wellness" | "security" | null;

const GOALS = [
  { key: "muscle", label: "Build muscle", icon: "barbell-outline" },
  { key: "weight", label: "Manage weight", icon: "scale-outline" },
  { key: "endurance", label: "Build endurance", icon: "pulse-outline" },
  { key: "mobility", label: "Improve mobility", icon: "body-outline" },
] as const;

function buildHeightValue(feetStr: string, inchesStr: string): number | null {
  const feet = Number(feetStr);
  if (!feetStr || Number.isNaN(feet)) return null;

  const rawInches = Number(inchesStr);
  const inches = Number.isNaN(rawInches)
    ? 0
    : Math.min(Math.max(Math.round(rawInches), 0), 11);

  return Number(`${feet}.${String(inches).padStart(2, "0")}`);
}

function splitStoredHeight(height: number | null | undefined) {
  if (!height) return { feet: "", inches: "" };

  const [feet = "", inches = "0"] = String(height).split(".");
  return {
    feet,
    inches: String(Number(inches)),
  };
}

function formatBirthday(value: string | null | undefined) {
  if (!value) return "Not set";

  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function SettingsScreen() {
  const { theme, setTheme, resolvedTheme } = useThemeMode();
  const colors = Colors[resolvedTheme];
  const {
    profile,
    updateDisplayName,
    updateBirthdate,
    updateAvatar,
    updatePrimaryGoal,
    updateBiometrics,
  } = useProfileData();

  const [openSection, setOpenSection] = useState<SectionKey>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [birthdate, setBirthdate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [avatarUri, setAvatarUri] = useState("");
  const [goal, setGoal] = useState<string | null>(null);

  const [heightFeet, setHeightFeet] = useState("");
  const [heightInches, setHeightInches] = useState("");
  const [weight, setWeight] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!profile) return;

    setDisplayName(profile.display_name ?? "");
    setBirthdate(
      profile.birthdate ? new Date(`${profile.birthdate}T00:00:00`) : null,
    );
    setGoal(profile.primary_goal);

    const storedHeight = splitStoredHeight(profile.height);
    setHeightFeet(storedHeight.feet);
    setHeightInches(storedHeight.inches);
    setWeight(profile.weight?.toString() ?? "");
    setAge(profile.age?.toString() ?? "");
    setSex(profile.sex);
  }, [profile]);

  const clearMessages = () => {
    setError("");
    setStatus("");
  };

  const toggleSection = (section: Exclude<SectionKey, null>) => {
    clearMessages();
    setOpenSection((current) => (current === section ? null : section));
  };

  async function uploadAvatar(uri: string, userId: string) {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    if (!base64) return null;

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    const filePath = `public/${userId}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, bytes.buffer, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
    return data?.publicUrl ? `${data.publicUrl}?t=${Date.now()}` : null;
  }

  async function pickAvatar() {
    clearMessages();

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Photo access is needed to choose a profile picture.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      setAvatarUri(result.assets[0].uri);
    }
  }

  async function saveProfileDetails() {
    const cleanedName = displayName.trim();
    if (!cleanedName) {
      setError("Please enter a display name.");
      return;
    }

    setSaving(true);
    clearMessages();
    try {
      await updateDisplayName(cleanedName);
      await updateBirthdate(
        birthdate ? birthdate.toISOString().split("T")[0] : null,
      );

      if (avatarUri) {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) throw new Error("You must be logged in.");

        const url = await uploadAvatar(avatarUri, user.id);
        if (!url) throw new Error("Could not upload your profile picture.");
        await updateAvatar(url);
        setAvatarUri("");
      }

      setStatus("Profile details updated.");
      setOpenSection(null);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not update your profile.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveGoal() {
    if (!goal) {
      setError("Choose a primary goal first.");
      return;
    }

    setSaving(true);
    clearMessages();
    try {
      await updatePrimaryGoal(goal);
      setStatus("Primary goal updated.");
      setOpenSection(null);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not update your goal.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveWellnessDetails() {
    setSaving(true);
    clearMessages();

    try {
      const height = buildHeightValue(heightFeet, heightInches);
      const parsedWeight = weight.trim() ? Number(weight) : null;
      const parsedAge = age.trim() ? Number(age) : null;

      if (
        weight.trim() &&
        (!Number.isFinite(parsedWeight) || (parsedWeight ?? 0) <= 0)
      ) {
        throw new Error("Enter a valid weight.");
      }
      if (
        age.trim() &&
        (!Number.isFinite(parsedAge) || (parsedAge ?? 0) <= 0)
      ) {
        throw new Error("Enter a valid age.");
      }

      await updateBiometrics({
        height,
        weight: parsedWeight,
        age: parsedAge,
        sex,
      });

      setStatus("Wellness details updated.");
      setOpenSection(null);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not update your wellness details.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function savePassword() {
    if (password.length < 6) {
      setError("Your new password must be at least 6 characters.");
      return;
    }

    setSaving(true);
    clearMessages();
    try {
      const { error: passwordError } = await supabase.auth.updateUser({
        password,
      });
      if (passwordError) throw passwordError;

      setPassword("");
      setStatus("Password updated.");
      setOpenSection(null);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not update your password.",
      );
    } finally {
      setSaving(false);
    }
  }

  function confirmDeleteAccount() {
    Alert.alert(
      "Delete account?",
      "This permanently deletes your account and cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete account",
          style: "destructive",
          onPress: async () => {
            setSaving(true);
            clearMessages();
            try {
              const { error: deleteError } = await supabase.rpc(
                "delete_user_account",
              );
              if (deleteError) throw deleteError;
              router.replace("/(auth)/login");
            } catch (caught) {
              setError(
                caught instanceof Error
                  ? caught.message
                  : "Could not delete your account.",
              );
              setSaving(false);
            }
          },
        },
      ],
    );
  }

  const avatarSource = avatarUri || profile?.avatar_url || "";

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView
        style={styles.safeArea}
        edges={["top", "left", "right", "bottom"]}
      >
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.header}>
            <Pressable
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={({ pressed }) => [
                styles.backButton,
                {
                  backgroundColor: colors.backgroundElement,
                  borderColor: colors.border,
                },
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="arrow-back" size={21} color={colors.text} />
            </Pressable>

            <View style={{ flex: 1 }}>
              <ThemedText style={styles.eyebrow} themeColor="brand">
                YOUR ACCOUNT
              </ThemedText>
              <ThemedText style={styles.title}>Settings</ThemedText>
            </View>
          </View>

          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.content}>
              {error ? (
                <MessageBox
                  icon="alert-circle-outline"
                  text={error}
                  color={colors.danger}
                  backgroundColor={
                    resolvedTheme === "dark" ? "#3A2023" : "#FDECEE"
                  }
                />
              ) : null}

              {status ? (
                <MessageBox
                  icon="checkmark-circle-outline"
                  text={status}
                  color={colors.success}
                  backgroundColor={colors.brandSoft}
                />
              ) : null}

              <SectionLabel
                title="Appearance"
                subtitle="Choose how Upkeep looks on this device"
              />
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.backgroundElement,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.themeRow}>
                  {(["light", "system", "dark"] as const).map((option) => {
                    const selected = theme === option;
                    return (
                      <Pressable
                        key={option}
                        onPress={() => setTheme(option)}
                        style={({ pressed }) => [
                          styles.themeChoice,
                          {
                            backgroundColor: selected
                              ? colors.brandSoft
                              : colors.background,
                            borderColor: selected
                              ? colors.brand
                              : colors.border,
                          },
                          pressed && styles.pressed,
                        ]}
                      >
                        <Ionicons
                          name={
                            option === "light"
                              ? "sunny-outline"
                              : option === "dark"
                                ? "moon-outline"
                                : "phone-portrait-outline"
                          }
                          size={19}
                          color={selected ? colors.brand : colors.textSecondary}
                        />
                        <ThemedText
                          type="smallBold"
                          style={
                            selected ? { color: colors.brandStrong } : undefined
                          }
                        >
                          {option.charAt(0).toUpperCase() + option.slice(1)}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <SectionLabel
                title="Profile"
                subtitle="Your public profile and personal details"
              />

              <ExpandableCard
                icon="person-outline"
                title="Profile details"
                summary={profile?.display_name || "Name, birthday, and photo"}
                open={openSection === "profile"}
                onPress={() => toggleSection("profile")}
              >
                <View style={styles.avatarEditor}>
                  <Pressable
                    onPress={pickAvatar}
                    style={styles.avatarPressable}
                  >
                    {avatarSource ? (
                      <Image
                        source={{ uri: avatarSource }}
                        style={styles.avatar}
                      />
                    ) : (
                      <View
                        style={[
                          styles.avatar,
                          styles.avatarEmpty,
                          { backgroundColor: colors.brandSoft },
                        ]}
                      >
                        <Ionicons
                          name="person"
                          size={34}
                          color={colors.brand}
                        />
                      </View>
                    )}
                    <View
                      style={[
                        styles.cameraBadge,
                        {
                          backgroundColor: colors.brandStrong,
                          borderColor: colors.backgroundElement,
                        },
                      ]}
                    >
                      <Ionicons name="camera" size={13} color="#FFFFFF" />
                    </View>
                  </Pressable>
                  <Pressable onPress={pickAvatar}>
                    <ThemedText
                      type="smallBold"
                      style={{ color: colors.brand }}
                    >
                      {avatarSource ? "Change photo" : "Choose photo"}
                    </ThemedText>
                  </Pressable>
                </View>

                <TextInput
                  label="Display name"
                  mode="outlined"
                  value={displayName}
                  onChangeText={setDisplayName}
                  autoCapitalize="words"
                  outlineColor={colors.border}
                  activeOutlineColor={colors.brand}
                />

                <Pressable
                  onPress={() => setShowDatePicker(true)}
                  style={({ pressed }) => [
                    styles.fieldButton,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.fieldButtonCopy}>
                    <ThemedText type="small" themeColor="textSecondary">
                      Birthday
                    </ThemedText>
                    <ThemedText type="smallBold">
                      {birthdate
                        ? birthdate.toLocaleDateString(undefined, {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "Not set"}
                    </ThemedText>
                  </View>
                  <Ionicons
                    name="calendar-outline"
                    size={20}
                    color={colors.brand}
                  />
                </Pressable>

                {showDatePicker ? (
                  <View
                    style={[styles.pickerWrap, { borderColor: colors.border }]}
                  >
                    <DateTimePicker
                      value={birthdate || new Date()}
                      mode="date"
                      maximumDate={new Date()}
                      display={Platform.OS === "ios" ? "spinner" : "calendar"}
                      onValueChange={(_event, selectedDate) =>
                        setBirthdate(selectedDate)
                      }
                      onDismiss={() => setShowDatePicker(false)}
                    />
                    {Platform.OS === "ios" ? (
                      <Pressable
                        onPress={() => setShowDatePicker(false)}
                        style={styles.doneButton}
                      >
                        <ThemedText
                          type="smallBold"
                          style={{ color: colors.brand }}
                        >
                          Done
                        </ThemedText>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}

                <PrimaryAction
                  label="Save profile details"
                  onPress={saveProfileDetails}
                  disabled={saving}
                />
              </ExpandableCard>

              <ExpandableCard
                icon="locate-outline"
                title="Primary goal"
                summary={
                  profile?.primary_goal
                    ? (GOALS.find((item) => item.key === profile.primary_goal)
                        ?.label ?? profile.primary_goal)
                    : "Choose what you're working toward"
                }
                open={openSection === "goal"}
                onPress={() => toggleSection("goal")}
              >
                <View style={styles.goalGrid}>
                  {GOALS.map((item) => {
                    const selected = goal === item.key;
                    return (
                      <Pressable
                        key={item.key}
                        onPress={() => setGoal(item.key)}
                        style={({ pressed }) => [
                          styles.goalChoice,
                          {
                            backgroundColor: selected
                              ? colors.brandSoft
                              : colors.background,
                            borderColor: selected
                              ? colors.brand
                              : colors.border,
                          },
                          pressed && styles.pressed,
                        ]}
                      >
                        <Ionicons
                          name={item.icon}
                          size={20}
                          color={selected ? colors.brand : colors.textSecondary}
                        />
                        <ThemedText
                          type="smallBold"
                          style={
                            selected ? { color: colors.brandStrong } : undefined
                          }
                        >
                          {item.label}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>

                <PrimaryAction
                  label="Save primary goal"
                  onPress={saveGoal}
                  disabled={saving}
                />
              </ExpandableCard>

              <ExpandableCard
                icon="fitness-outline"
                title="Wellness details"
                summary="Height, weight, age, and sex"
                open={openSection === "wellness"}
                onPress={() => toggleSection("wellness")}
              >
                <View style={styles.twoColumnRow}>
                  <TextInput
                    label="Feet"
                    mode="outlined"
                    value={heightFeet}
                    onChangeText={setHeightFeet}
                    keyboardType="number-pad"
                    outlineColor={colors.border}
                    activeOutlineColor={colors.brand}
                    style={{ flex: 1 }}
                  />
                  <TextInput
                    label="Inches"
                    mode="outlined"
                    value={heightInches}
                    onChangeText={setHeightInches}
                    keyboardType="number-pad"
                    outlineColor={colors.border}
                    activeOutlineColor={colors.brand}
                    style={{ flex: 1 }}
                  />
                </View>

                <TextInput
                  label="Weight (lb)"
                  mode="outlined"
                  value={weight}
                  onChangeText={setWeight}
                  keyboardType="decimal-pad"
                  outlineColor={colors.border}
                  activeOutlineColor={colors.brand}
                />

                <TextInput
                  label="Age"
                  mode="outlined"
                  value={age}
                  onChangeText={setAge}
                  keyboardType="number-pad"
                  outlineColor={colors.border}
                  activeOutlineColor={colors.brand}
                />

                <View style={styles.sexRow}>
                  <ChoiceButton
                    label="Male"
                    selected={sex === true}
                    onPress={() => setSex(true)}
                  />
                  <ChoiceButton
                    label="Female"
                    selected={sex === false}
                    onPress={() => setSex(false)}
                  />
                </View>

                <PrimaryAction
                  label="Save wellness details"
                  onPress={saveWellnessDetails}
                  disabled={saving}
                />
              </ExpandableCard>

              <SectionLabel
                title="Security"
                subtitle="Keep your account protected"
              />
              <ExpandableCard
                icon="lock-closed-outline"
                title="Password"
                summary="Change your account password"
                open={openSection === "security"}
                onPress={() => toggleSection("security")}
              >
                <TextInput
                  label="New password"
                  mode="outlined"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  outlineColor={colors.border}
                  activeOutlineColor={colors.brand}
                />
                <PrimaryAction
                  label="Update password"
                  onPress={savePassword}
                  disabled={saving}
                />
              </ExpandableCard>

              <SectionLabel
                title="Account"
                subtitle="Permanent account actions"
              />
              <Pressable
                onPress={confirmDeleteAccount}
                disabled={saving}
                style={({ pressed }) => [
                  styles.deleteCard,
                  {
                    backgroundColor: colors.backgroundElement,
                    borderColor: colors.danger,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <View
                  style={[
                    styles.deleteIcon,
                    {
                      backgroundColor:
                        resolvedTheme === "dark" ? "#3A2023" : "#FDECEE",
                    },
                  ]}
                >
                  <Ionicons
                    name="trash-outline"
                    size={20}
                    color={colors.danger}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <ThemedText type="smallBold" style={{ color: colors.danger }}>
                    Delete account
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Permanently delete your account and data
                  </ThemedText>
                </View>
                {saving ? <ActivityIndicator size="small" /> : null}
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

function SectionLabel({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.sectionLabel}>
      <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {subtitle}
      </ThemedText>
    </View>
  );
}

function ExpandableCard({
  icon,
  title,
  summary,
  open,
  onPress,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  summary: string;
  open: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const { resolvedTheme } = useThemeMode();
  const colors = Colors[resolvedTheme];

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.backgroundElement,
          borderColor: open ? colors.brand : colors.border,
        },
      ]}
    >
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.cardHeader, pressed && styles.pressed]}
      >
        <View style={[styles.cardIcon, { backgroundColor: colors.brandSoft }]}>
          <Ionicons name={icon} size={20} color={colors.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText type="smallBold">{title}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {summary}
          </ThemedText>
        </View>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={20}
          color={colors.textSecondary}
        />
      </Pressable>

      {open ? (
        <View style={[styles.editor, { borderTopColor: colors.border }]}>
          {children}
        </View>
      ) : null}
    </View>
  );
}

function ChoiceButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { resolvedTheme } = useThemeMode();
  const colors = Colors[resolvedTheme];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.choiceButton,
        {
          backgroundColor: selected ? colors.brandSoft : colors.background,
          borderColor: selected ? colors.brand : colors.border,
        },
        pressed && styles.pressed,
      ]}
    >
      {selected ? (
        <Ionicons name="checkmark-circle" size={18} color={colors.brand} />
      ) : null}
      <ThemedText
        type="smallBold"
        style={selected ? { color: colors.brandStrong } : undefined}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

function PrimaryAction({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  const { resolvedTheme } = useThemeMode();
  const colors = Colors[resolvedTheme];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.primaryAction,
        { backgroundColor: colors.brandStrong },
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {disabled ? (
        <ActivityIndicator
          size="small"
          color={resolvedTheme === "dark" ? Colors.dark.background : "#FFFFFF"}
        />
      ) : (
        <ThemedText
          type="smallBold"
          style={{
            color:
              resolvedTheme === "dark" ? Colors.dark.background : "#FFFFFF",
          }}
        >
          {label}
        </ThemedText>
      )}
    </Pressable>
  );
}

function MessageBox({
  icon,
  text,
  color,
  backgroundColor,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  color: string;
  backgroundColor: string;
}) {
  return (
    <View style={[styles.messageBox, { backgroundColor, borderColor: color }]}>
      <Ionicons name={icon} size={19} color={color} />
      <ThemedText type="smallBold" style={{ color, flex: 1 }}>
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  header: {
    width: "100%",
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
  },
  backButton: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderRadius: Radius.medium,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "800",
    letterSpacing: 1.1,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.five,
  },
  content: {
    width: "100%",
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    gap: Spacing.three,
  },
  sectionLabel: {
    marginTop: Spacing.two,
    gap: 2,
  },
  sectionTitle: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: "800",
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius.large,
    overflow: "hidden",
  },
  cardHeader: {
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    padding: Spacing.three,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  editor: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  themeRow: {
    padding: Spacing.two,
    flexDirection: "row",
    gap: Spacing.two,
  },
  themeChoice: {
    flex: 1,
    minHeight: 64,
    borderWidth: 1,
    borderRadius: Radius.medium,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  avatarEditor: {
    alignItems: "center",
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  avatarPressable: {
    position: "relative",
  },
  avatar: {
    width: 86,
    height: 86,
    borderRadius: 43,
  },
  avatarEmpty: {
    alignItems: "center",
    justifyContent: "center",
  },
  cameraBadge: {
    position: "absolute",
    right: -2,
    bottom: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  fieldButton: {
    minHeight: 58,
    borderWidth: 1,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fieldButtonCopy: {
    gap: 1,
  },
  pickerWrap: {
    borderWidth: 1,
    borderRadius: Radius.medium,
    overflow: "hidden",
    paddingBottom: Platform.OS === "ios" ? Spacing.two : 0,
  },
  doneButton: {
    alignSelf: "flex-end",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  goalGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  goalChoice: {
    width: "48%",
    flexGrow: 1,
    minWidth: 140,
    minHeight: 58,
    borderWidth: 1,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  twoColumnRow: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  sexRow: {
    flexDirection: "row",
    gap: Spacing.two,
  },
  choiceButton: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: Radius.medium,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
  },
  primaryAction: {
    minHeight: 48,
    borderRadius: Radius.medium,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.three,
  },
  deleteCard: {
    minHeight: 72,
    borderWidth: 1,
    borderRadius: Radius.large,
    padding: Spacing.three,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
  },
  deleteIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  messageBox: {
    borderWidth: 1,
    borderRadius: Radius.medium,
    padding: Spacing.three,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  pressed: {
    opacity: 0.72,
  },
  disabled: {
    opacity: 0.5,
  },
});
