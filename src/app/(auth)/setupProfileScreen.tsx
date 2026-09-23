import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useThemeMode } from "@/components/context/ThemeContext";
import { useProfileData } from "@/components/context/profileDataContext";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Colors, MaxContentWidth, Radius, Spacing } from "@/constants/theme";
import { supabase } from "@/lib/supabaseClient";

// Height is stored in the existing feet.inches format used by the app.
// Example: 5 feet 11 inches -> 5.11
function buildHeightValue(feetStr: string, inchesStr: string): number | null {
  const feet = Number(feetStr);

  if (!feetStr || Number.isNaN(feet)) {
    return null;
  }

  const rawInches = Number(inchesStr);
  const inches = Number.isNaN(rawInches)
    ? 0
    : Math.min(Math.max(Math.round(rawInches), 0), 11);

  return Number(`${feet}.${String(inches).padStart(2, "0")}`);
}

function formatBirthday(date: Date | null) {
  if (!date) return "Choose your birthday";

  return date.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function SetupProfileScreen() {
  const { resolvedTheme } = useThemeMode();
  const { refreshProfile } = useProfileData();
  const colors = Colors[resolvedTheme];

  const [displayName, setDisplayName] = useState("");
  const [birthdate, setBirthdate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [avatarUri, setAvatarUri] = useState("");

  const [heightFeet, setHeightFeet] = useState("");
  const [heightInches, setHeightInches] = useState("");
  const [weight, setWeight] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<boolean | null>(null);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function pickAvatar() {
    setError("");

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setError("Photo access is needed to choose a profile picture.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      setAvatarUri(result.assets[0].uri);
    }
  }

  async function uploadAvatar(
    uri: string,
    userId: string,
  ): Promise<string | null> {
    try {
      // This is the same Expo-compatible upload approach used by Settings.
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (!base64) return null;

      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);

      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const filePath = `public/${userId}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, bytes.buffer, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      if (!urlData?.publicUrl) return null;

      // Prevent a previously cached avatar from showing after an overwrite.
      return `${urlData.publicUrl}?t=${Date.now()}`;
    } catch (uploadError) {
      console.log("Avatar upload failed:", uploadError);
      return null;
    }
  }

  async function handleSubmit() {
    if (loading) return;

    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError("You must be logged in to finish setting up your profile.");
        return;
      }

      let avatarUrl: string | null = null;

      if (avatarUri) {
        avatarUrl = await uploadAvatar(avatarUri, user.id);

        if (!avatarUrl) {
          setError(
            "Your profile photo could not be uploaded. Please try again.",
          );
          return;
        }
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim() || null,
          birthdate: birthdate ? birthdate.toISOString().split("T")[0] : null,
          avatar_url: avatarUrl,
          height: buildHeightValue(heightFeet, heightInches),
          weight: weight ? Number(weight) : null,
          age: age ? Number(age) : null,
          sex,
          onboarding_complete: true,
        })
        .eq("id", user.id);

      if (updateError) {
        setError(updateError.message);
        return;
      }

      // Refresh the shared profile before Home renders so the new name,
      // avatar, and biometrics are reflected immediately across the app.
      refreshProfile();
      router.replace("/");
    } catch (submitError) {
      console.log("Profile setup failed:", submitError);
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Something went wrong while saving your profile.",
      );
    } finally {
      setLoading(false);
    }
  }

  const selectionStyle = (selected: boolean) => [
    styles.choice,
    {
      backgroundColor: selected ? colors.brandSoft : colors.backgroundElement,
      borderColor: selected ? colors.brand : colors.border,
    },
  ];

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.content}>
              <View style={styles.brandRow}>
                <Image
                  source={require("../../../assets/images/upkeep-logo.png")}
                  style={styles.logo}
                  resizeMode="contain"
                />

                <View style={styles.progressWrap}>
                  <View
                    style={[
                      styles.progressTrack,
                      { backgroundColor: colors.border },
                    ]}
                  >
                    <View
                      style={[
                        styles.progressFill,
                        { backgroundColor: colors.brand },
                      ]}
                    />
                  </View>
                  <ThemedText type="small" themeColor="textSecondary">
                    Final step
                  </ThemedText>
                </View>
              </View>

              <View style={styles.hero}>
                <ThemedText style={styles.eyebrow} themeColor="brand">
                  PROFILE SETUP
                </ThemedText>
                <ThemedText type="subtitle" style={styles.title}>
                  Make Upkeep yours
                </ThemedText>
                <ThemedText themeColor="textSecondary" style={styles.subtitle}>
                  A few details help personalize your dashboard, goals, and
                  daily wellness experience.
                </ThemedText>
              </View>

              {error.length > 0 && (
                <View
                  style={[
                    styles.errorBox,
                    {
                      backgroundColor:
                        resolvedTheme === "dark" ? "#3A2023" : "#FDECEE",
                      borderColor: colors.danger,
                    },
                  ]}
                >
                  <Ionicons
                    name="alert-circle-outline"
                    size={20}
                    color={colors.danger}
                  />
                  <ThemedText
                    type="smallBold"
                    style={[styles.errorText, { color: colors.danger }]}
                  >
                    {error}
                  </ThemedText>
                </View>
              )}

              <ThemedView
                type="backgroundElement"
                style={[styles.card, { borderColor: colors.border }]}
              >
                <View style={styles.sectionHeader}>
                  <View
                    style={[
                      styles.sectionIcon,
                      { backgroundColor: colors.brandSoft },
                    ]}
                  >
                    <Ionicons
                      name="person-outline"
                      size={20}
                      color={colors.brand}
                    />
                  </View>
                  <View style={styles.sectionHeaderText}>
                    <ThemedText style={styles.sectionTitle}>
                      Your profile
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Choose how you'll appear in the app.
                    </ThemedText>
                  </View>
                </View>

                <View style={styles.avatarRow}>
                  <Pressable
                    onPress={pickAvatar}
                    accessibilityRole="button"
                    accessibilityLabel="Choose profile photo"
                    style={[
                      styles.avatar,
                      {
                        backgroundColor: colors.brandSoft,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    {avatarUri ? (
                      <Image
                        source={{ uri: avatarUri }}
                        style={styles.avatarImage}
                      />
                    ) : (
                      <Ionicons name="person" size={38} color={colors.brand} />
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
                      <Ionicons name="camera" size={14} color="#FFFFFF" />
                    </View>
                  </Pressable>

                  <View style={styles.avatarCopy}>
                    <ThemedText type="smallBold">Profile picture</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Optional. You can change this later in Settings.
                    </ThemedText>
                    <Pressable onPress={pickAvatar} hitSlop={8}>
                      <ThemedText
                        type="smallBold"
                        style={[styles.changePhoto, { color: colors.brand }]}
                      >
                        {avatarUri ? "Change photo" : "Choose photo"}
                      </ThemedText>
                    </Pressable>
                  </View>
                </View>

                <FieldLabel>Name</FieldLabel>
                <Input
                  placeholder="What should we call you?"
                  value={displayName}
                  onChangeText={setDisplayName}
                  autoCapitalize="words"
                  returnKeyType="next"
                  style={styles.inputSpacing}
                />

                <FieldLabel>Birthday</FieldLabel>
                <Pressable
                  onPress={() => setShowDatePicker(true)}
                  style={({ pressed }) => [
                    styles.dateButton,
                    {
                      backgroundColor: colors.backgroundElement,
                      borderColor: colors.border,
                    },
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.dateButtonLeft}>
                    <Ionicons
                      name="calendar-outline"
                      size={20}
                      color={colors.brand}
                    />
                    <ThemedText
                      style={
                        birthdate ? undefined : { color: colors.textSecondary }
                      }
                    >
                      {formatBirthday(birthdate)}
                    </ThemedText>
                  </View>
                  <Ionicons
                    name="chevron-down"
                    size={18}
                    color={colors.textSecondary}
                  />
                </Pressable>

                {showDatePicker && (
                  <DateTimePicker
                    value={birthdate || new Date()}
                    mode="date"
                    maximumDate={new Date()}
                    display={Platform.OS === "ios" ? "spinner" : "calendar"}
                    onValueChange={(_event, selectedDate) => {
                      setBirthdate(selectedDate);
                    }}
                    onDismiss={() => setShowDatePicker(false)}
                  />
                )}

                {showDatePicker && Platform.OS === "ios" && (
                  <Pressable
                    onPress={() => setShowDatePicker(false)}
                    style={styles.doneDate}
                  >
                    <ThemedText
                      type="smallBold"
                      style={{ color: colors.brand }}
                    >
                      Done
                    </ThemedText>
                  </Pressable>
                )}
              </ThemedView>

              <ThemedView
                type="backgroundElement"
                style={[styles.card, { borderColor: colors.border }]}
              >
                <View style={styles.sectionHeader}>
                  <View
                    style={[
                      styles.sectionIcon,
                      { backgroundColor: colors.brandSoft },
                    ]}
                  >
                    <Ionicons
                      name="fitness-outline"
                      size={20}
                      color={colors.brand}
                    />
                  </View>
                  <View style={styles.sectionHeaderText}>
                    <ThemedText style={styles.sectionTitle}>
                      Wellness basics
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Used for more useful wellness and calorie estimates.
                    </ThemedText>
                  </View>
                </View>

                <FieldLabel>Height</FieldLabel>
                <View style={styles.twoColumnRow}>
                  <View style={styles.column}>
                    <Input
                      placeholder="Feet"
                      value={heightFeet}
                      onChangeText={setHeightFeet}
                      keyboardType="number-pad"
                      maxLength={1}
                    />
                  </View>
                  <View style={styles.column}>
                    <Input
                      placeholder="Inches"
                      value={heightInches}
                      onChangeText={setHeightInches}
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                  </View>
                </View>

                <View style={styles.twoColumnRow}>
                  <View style={styles.column}>
                    <FieldLabel>Weight</FieldLabel>
                    <View style={styles.inputWithSuffixWrap}>
                      <Input
                        placeholder="Weight"
                        value={weight}
                        onChangeText={setWeight}
                        keyboardType="decimal-pad"
                        style={styles.inputWithSuffix}
                      />
                      <ThemedText
                        type="small"
                        themeColor="textSecondary"
                        style={styles.inputSuffix}
                      >
                        lb
                      </ThemedText>
                    </View>
                  </View>

                  <View style={styles.column}>
                    <FieldLabel>Age</FieldLabel>
                    <Input
                      placeholder="Age"
                      value={age}
                      onChangeText={setAge}
                      keyboardType="number-pad"
                      maxLength={3}
                    />
                  </View>
                </View>

                <FieldLabel>Sex</FieldLabel>
                <View style={styles.twoColumnRow}>
                  <Pressable
                    onPress={() => setSex(true)}
                    style={({ pressed }) => [
                      ...selectionStyle(sex === true),
                      styles.column,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Ionicons
                      name={sex === true ? "checkmark-circle" : "male-outline"}
                      size={20}
                      color={sex === true ? colors.brand : colors.textSecondary}
                    />
                    <ThemedText type="smallBold">Male</ThemedText>
                  </Pressable>

                  <Pressable
                    onPress={() => setSex(false)}
                    style={({ pressed }) => [
                      ...selectionStyle(sex === false),
                      styles.column,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Ionicons
                      name={
                        sex === false ? "checkmark-circle" : "female-outline"
                      }
                      size={20}
                      color={
                        sex === false ? colors.brand : colors.textSecondary
                      }
                    />
                    <ThemedText type="smallBold">Female</ThemedText>
                  </Pressable>
                </View>
              </ThemedView>

              <View style={styles.footer}>
                <Button onPress={handleSubmit} isDisabled={loading}>
                  {loading ? "Saving your profile..." : "Save & Continue"}
                </Button>
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  style={styles.footerNote}
                >
                  You can update these details anytime from Settings.
                </ThemedText>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

function FieldLabel({ children }: { children: string }) {
  return (
    <ThemedText type="smallBold" style={styles.fieldLabel}>
      {children}
    </ThemedText>
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
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.five,
  },
  content: {
    width: "100%",
    maxWidth: MaxContentWidth,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.four,
  },
  logo: {
    width: 58,
    height: 58,
  },
  progressWrap: {
    width: 120,
    alignItems: "flex-end",
    gap: 6,
  },
  progressTrack: {
    width: "100%",
    height: 6,
    borderRadius: Radius.pill,
    overflow: "hidden",
  },
  progressFill: {
    width: "100%",
    height: "100%",
    borderRadius: Radius.pill,
  },
  hero: {
    marginBottom: Spacing.four,
  },
  eyebrow: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginBottom: 8,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
    marginBottom: 10,
  },
  subtitle: {
    maxWidth: 560,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderWidth: 1,
    borderRadius: Radius.medium,
    padding: Spacing.three,
    marginBottom: Spacing.three,
  },
  errorText: {
    flex: 1,
  },
  card: {
    width: "100%",
    borderWidth: 1,
    borderRadius: Radius.large,
    padding: Spacing.four,
    marginBottom: Spacing.three,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: Spacing.four,
  },
  sectionIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHeaderText: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    marginBottom: Spacing.four,
  },
  avatar: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 41,
  },
  cameraBadge: {
    position: "absolute",
    right: -1,
    bottom: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarCopy: {
    flex: 1,
    gap: 3,
  },
  changePhoto: {
    marginTop: 3,
  },
  fieldLabel: {
    marginBottom: 8,
    marginTop: 2,
  },
  inputSpacing: {
    marginBottom: Spacing.three,
  },
  dateButton: {
    minHeight: 50,
    borderWidth: 1,
    borderRadius: Radius.medium,
    paddingHorizontal: Spacing.three,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.three,
  },
  dateButtonLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  doneDate: {
    alignSelf: "flex-end",
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: Spacing.two,
  },
  twoColumnRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: Spacing.three,
  },
  column: {
    flex: 1,
  },
  choice: {
    minHeight: 50,
    borderRadius: Radius.medium,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  inputWithSuffixWrap: {
    position: "relative",
  },
  inputWithSuffix: {
    paddingRight: 42,
  },
  inputSuffix: {
    position: "absolute",
    right: 14,
    top: 14,
  },
  footer: {
    paddingTop: Spacing.one,
  },
  footerNote: {
    textAlign: "center",
    marginTop: Spacing.three,
  },
  pressed: {
    opacity: 0.76,
  },
});
