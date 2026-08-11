import { View, Image, Platform } from "react-native";
import { useColorScheme } from "react-native";
import { router } from "expo-router";

import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { Colors, Spacing, MaxContentWidth } from "@/constants/theme";
import { supabase } from "@/lib/supabaseClient";
import { useState } from "react";

import * as ImagePicker from "expo-image-picker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useThemeMode } from "@/components/context/ThemeContext";

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
