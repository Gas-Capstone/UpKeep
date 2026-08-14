import { View, Image, Platform } from "react-native";
import { useColorScheme } from "react-native";
import { router } from "expo-router";

import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { HStack } from "@/components/ui/hstack";

import { Colors, Spacing, MaxContentWidth } from "@/constants/theme";
import { supabase } from "@/lib/supabaseClient";
import { useState } from "react";

import * as ImagePicker from "expo-image-picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useThemeMode } from "@/components/context/ThemeContext";

// `height` is stored as feet.inches (e.g. 5.11 = 5'11")
function buildHeightValue(feetStr: string, inchesStr: string): number | null {
  const feet = Number(feetStr);
  if (!feetStr || Number.isNaN(feet)) return null;

  const rawInches = Number(inchesStr);
  const inches = Number.isNaN(rawInches)
    ? 0
    : Math.min(Math.max(Math.round(rawInches), 0), 11);
  const inchesPadded = String(inches).padStart(2, "0");

  return Number(`${feet}.${inchesPadded}`);
}

export default function SettingsScreen() {
  const { theme, setTheme, resolvedTheme } = useThemeMode();
  const colors = Colors[resolvedTheme];

  const [newPassword, setNewPassword] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");

  // Birthdate picker
  const [newBirthdate, setNewBirthdate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Avatar picker
  const [newAvatarUri, setNewAvatarUri] = useState("");

  // Calorie-goal inputs
  const [heightFeet, setHeightFeet] = useState("");
  const [heightInches, setHeightInches] = useState("");
  const [newWeight, setNewWeight] = useState("");
  const [newAge, setNewAge] = useState("");
  const [newSex, setNewSex] = useState<boolean | null>(null);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function uploadAvatar(
    uri: string,
    userId: string,
  ): Promise<string | null> {
    try {
      // Convert URI → Blob
      const response = await fetch(uri);
      const blob = await response.blob();

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(`public/${userId}.jpg`, blob, {
          upsert: true,
        });

      if (uploadError) {
        console.log("Upload error:", uploadError.message);
        return null;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(`public/${userId}.jpg`);

      return urlData.publicUrl;
    } catch (err) {
      console.log("Avatar upload failed:", err);
      return null;
    }
  }

  // -----------------------------
  // DELETE ACCOUNT
  // -----------------------------
  async function handleDeleteAccount() {
    setLoading(true);
    setError("");

    const { error } = await supabase.rpc("delete_user_account");

    if (error) {
      setError(error.message);
    } else {
      router.replace("/(auth)/login");
    }

    setLoading(false);
  }

  // -----------------------------
  // CHANGE PASSWORD
  // -----------------------------
  async function handleChangePassword() {
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      setError(error.message);
    } else {
      setNewPassword("");
    }

    setLoading(false);
  }

  // -----------------------------
  // CHANGE DISPLAY NAME
  // -----------------------------
  async function handleChangeDisplayName() {
    setLoading(true);
    setError("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError("You must be logged in to perform this action.");
      setLoading(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ display_name: newDisplayName })
      .eq("id", user.id);

    if (error) {
      setError(error.message);
    } else {
      setNewDisplayName("");
    }

    setLoading(false);
  }

  // -----------------------------
  // CHANGE BIRTHDATE
  // -----------------------------
  async function handleChangeBirthdate() {
    setLoading(true);
    setError("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError("You must be logged in to perform this action.");
      setLoading(false);
      return;
    }

    const formatted = newBirthdate
      ? newBirthdate.toISOString().split("T")[0]
      : null;

    const { error } = await supabase
      .from("profiles")
      .update({ birthdate: formatted })
      .eq("id", user.id);

    if (error) {
      setError(error.message);
    } else {
      setNewBirthdate(null);
    }

    setLoading(false);
  }

  // -----------------------------
  // CHANGE AVATAR
  // -----------------------------
  async function handleChangeAvatar() {
    setLoading(true);
    setError("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError("You must be logged in to perform this action.");
      setLoading(false);
      return;
    }

    try {
      // Convert URI → Blob
      const response = await fetch(newAvatarUri);
      const blob = await response.blob();

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(`public/${user.id}.jpg`, blob, {
          upsert: true,
        });

      if (uploadError) {
        setError(uploadError.message);
        setLoading(false);
        return;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(`public/${user.id}.jpg`);

      const avatarUrl = urlData.publicUrl;

      // Save URL to profile
      const { error } = await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("id", user.id);

      if (error) {
        setError(error.message);
      } else {
        setNewAvatarUri("");
      }
    } catch (err) {
      setError("Failed to upload avatar.");
    }

    setLoading(false);
  }

  // -----------------------------
  // CHANGE CALORIE-GOAL BIOMETRICS (height/weight/age/sex)
  // -----------------------------
  async function handleChangeBiometrics() {
    setLoading(true);
    setError("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError("You must be logged in to perform this action.");
      setLoading(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        height: buildHeightValue(heightFeet, heightInches),
        weight: newWeight ? Number(newWeight) : null,
        age: newAge ? Number(newAge) : null,
        sex: newSex,
      })
      .eq("id", user.id);

    if (error) {
      setError(error.message);
    } else {
      setHeightFeet("");
      setHeightInches("");
      setNewWeight("");
      setNewAge("");
      setNewSex(null);
    }

    setLoading(false);
  }

  // -----------------------------
  // THEME SWITCHER
  // -----------------------------
  function cycleTheme() {
    const next =
      theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    setTheme(next);
  }

  return (
    <View className="flex-1 items-center justify-center px-6">
      <ThemedView
        type="backgroundElement"
        style={{
          width: "100%",
          maxWidth: MaxContentWidth,
          padding: Spacing.four,
          borderRadius: Spacing.five,
          shadowColor: "#000",
          shadowOpacity: 0.15,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 3 },
        }}
      >
        <ThemedText type="title" style={{ marginBottom: Spacing.four }}>
          Settings
        </ThemedText>

        {/* Theme Switcher */}
        <ThemedText type="smallBold" style={{ marginBottom: Spacing.two }}>
          Theme
        </ThemedText>

        <Button
          onPress={() => setTheme(resolvedTheme === "light" ? "dark" : "light")}
        >
          {resolvedTheme === "light"
            ? "Switch to Dark Mode"
            : "Switch to Light Mode"}
        </Button>

        {error.length > 0 && (
          <ThemedText
            type="smallBold"
            style={{ color: "red", marginBottom: Spacing.four }}
          >
            {error}
          </ThemedText>
        )}

        {/* Change Password */}
        <Input
          placeholder="New Password"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          className="mb-4"
        />

        <View style={{ marginBottom: Spacing.four }}>
          <Button
            onPress={handleChangePassword}
            isDisabled={loading || newPassword.length === 0}
          >
            Change Password
          </Button>
        </View>

        {/* Display Name */}
        <Input
          placeholder="New Display Name"
          value={newDisplayName}
          onChangeText={setNewDisplayName}
          className="mb-4"
        />

        <View style={{ marginBottom: Spacing.four }}>
          <Button
            onPress={handleChangeDisplayName}
            isDisabled={loading || newDisplayName.length === 0}
          >
            Update Display Name
          </Button>
        </View>

        {/* Birthdate Picker */}
        <Button onPress={() => setShowDatePicker(true)}>
          {newBirthdate
            ? `Birthday: ${newBirthdate.toDateString()}`
            : "Choose Birthdate"}
        </Button>

        {showDatePicker && (
          <DateTimePicker
            value={newBirthdate || new Date()}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "calendar"}
            onChange={(event, selectedDate) => {
              setShowDatePicker(false);
              if (selectedDate) setNewBirthdate(selectedDate);
            }}
          />
        )}

        <View style={{ marginBottom: Spacing.four }}>
          <Button
            onPress={handleChangeBirthdate}
            isDisabled={loading || !newBirthdate}
          >
            Update Birthdate
          </Button>
        </View>

        {/* Avatar Picker */}
        <Button onPress={handleChangeAvatar}>
          {newAvatarUri ? "Change Avatar" : "Pick Avatar"}
        </Button>

        {newAvatarUri.length > 0 && (
          <Image
            source={{ uri: newAvatarUri }}
            style={{
              width: 100,
              height: 100,
              borderRadius: 50,
              marginBottom: Spacing.four,
            }}
          />
        )}

        <View style={{ marginBottom: Spacing.four }}>
          <Button
            onPress={handleChangeAvatar}
            isDisabled={loading || newAvatarUri.length === 0}
          >
            Update Avatar
          </Button>
        </View>

        {/* Calorie Goal Info: Height/Weight/Age/Sex */}
        <ThemedText type="smallBold" style={{ marginBottom: Spacing.two }}>
          Height
        </ThemedText>
        <HStack space="sm" style={{ marginBottom: Spacing.four }}>
          <Input
            placeholder="Feet"
            value={heightFeet}
            onChangeText={setHeightFeet}
            keyboardType="numeric"
            style={{ flex: 1 }}
          />
          <Input
            placeholder="Inches"
            value={heightInches}
            onChangeText={setHeightInches}
            keyboardType="numeric"
            style={{ flex: 1 }}
          />
        </HStack>

        <ThemedText type="smallBold" style={{ marginBottom: Spacing.two }}>
          Weight (lbs)
        </ThemedText>
        <Input
          placeholder="Weight in pounds"
          value={newWeight}
          onChangeText={setNewWeight}
          keyboardType="numeric"
          className="mb-4"
        />

        <ThemedText type="smallBold" style={{ marginBottom: Spacing.two }}>
          Age
        </ThemedText>
        <Input
          placeholder="Age"
          value={newAge}
          onChangeText={setNewAge}
          keyboardType="numeric"
          className="mb-4"
        />

        <ThemedText type="smallBold" style={{ marginBottom: Spacing.two }}>
          Sex
        </ThemedText>
        <HStack space="sm" style={{ marginBottom: Spacing.four }}>
          <View style={{ flex: 1 }}>
            <Button onPress={() => setNewSex(true)}>
              {newSex === true ? "✓ Male" : "Male"}
            </Button>
          </View>
          <View style={{ flex: 1 }}>
            <Button onPress={() => setNewSex(false)}>
              {newSex === false ? "✓ Female" : "Female"}
            </Button>
          </View>
        </HStack>

        <View style={{ marginBottom: Spacing.four }}>
          <Button
            onPress={handleChangeBiometrics}
            isDisabled={
              loading ||
              (!heightFeet && !newWeight && !newAge && newSex === null)
            }
          >
            Update Calorie Info
          </Button>
        </View>

        {/* Delete Account */}
        {!confirmDelete ? (
          <View style={{ marginBottom: Spacing.four }}>
            <Button onPress={() => setConfirmDelete(true)} isDisabled={loading}>
              Delete Account
            </Button>
          </View>
        ) : (
          <>
            <ThemedText
              type="smallBold"
              style={{
                color: "red",
                marginBottom: Spacing.four,
                textAlign: "center",
              }}
            >
              This action is permanent. Are you absolutely sure?
            </ThemedText>

            <View style={{ marginBottom: Spacing.four }}>
              <Button onPress={handleDeleteAccount} isDisabled={loading}>
                Yes, Delete My Account
              </Button>
            </View>

            <View style={{ marginBottom: Spacing.four }}>
              <Button onPress={() => setConfirmDelete(false)}>Cancel</Button>
            </View>
          </>
        )}

        <Button onPress={() => router.back()}>Back</Button>
      </ThemedView>
    </View>
  );
}
