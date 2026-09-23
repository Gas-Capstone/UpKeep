import {
  View,
  Image,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
} from "react-native";
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
import * as FileSystem from "expo-file-system/legacy";
import DateTimePicker from "@react-native-community/datetimepicker";

import { useThemeMode } from "@/components/context/ThemeContext";
import { useProfileData } from "@/components/context/profileDataContext";

// `height` is stored as feet.inches (e.g. 5.11 = 5'11")
function buildHeightValue(feetStr: string, inchesStr: string): number | null {
  const feet = Number(feetStr);

  if (!feetStr || Number.isNaN(feet)) {
    return null;
  }

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

  const { updateDisplayName, updateBirthdate, updateAvatar, updateBiometrics } =
    useProfileData();

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

  // -----------------------------
  // AVATAR UPLOAD
  // -----------------------------
  async function uploadAvatar(
    uri: string,
    userId: string,
  ): Promise<string | null> {
    try {
      console.log("Starting avatar upload...");
      console.log("Local URI:", uri);

      // Read the Expo local image as base64.
      // `/legacy` is required for readAsStringAsync in newer Expo versions.
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (!base64) {
        console.log("Could not read image as base64.");
        return null;
      }

      console.log("Image successfully read as base64.");

      // Convert base64 -> binary bytes
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);

      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const filePath = `public/${userId}.jpg`;

      console.log("Uploading to:", filePath);

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, bytes.buffer, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadError) {
        console.log("Upload error:", uploadError.message);
        return null;
      }

      console.log("Image uploaded successfully.");

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      if (!urlData?.publicUrl) {
        console.log("Could not get public avatar URL.");
        return null;
      }

      // Cache-busting makes sure the new avatar appears immediately.
      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      console.log("Avatar URL:", avatarUrl);

      return avatarUrl;
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

    try {
      const { error } = await supabase.rpc("delete_user_account");

      if (error) {
        setError(error.message);
      } else {
        router.replace("/(auth)/login");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete account.",
      );
    }

    setLoading(false);
  }

  // -----------------------------
  // CHANGE PASSWORD
  // -----------------------------
  async function handleChangePassword() {
    if (!newPassword) {
      setError("Please enter a new password.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setError(error.message);
      } else {
        setNewPassword("");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to change password.",
      );
    }

    setLoading(false);
  }

  // -----------------------------
  // CHANGE DISPLAY NAME
  // -----------------------------
  async function handleChangeDisplayName() {
    setLoading(true);
    setError("");

    if (!newDisplayName.trim()) {
      setError("Please enter a display name.");
      setLoading(false);
      return;
    }

    try {
      await updateDisplayName(newDisplayName.trim());
      setNewDisplayName("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update display name.",
      );
    }

    setLoading(false);
  }

  // -----------------------------
  // CHANGE BIRTHDATE
  // -----------------------------
  async function handleChangeBirthdate() {
    setLoading(true);
    setError("");

    const formatted = newBirthdate
      ? newBirthdate.toISOString().split("T")[0]
      : null;

    try {
      await updateBirthdate(formatted);
      setNewBirthdate(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update birthdate.",
      );
    }

    setLoading(false);
  }

  // -----------------------------
  // PICK AVATAR
  // -----------------------------
  async function handlePickAvatar() {
    setError("");

    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        setError("Permission to access your photos is required.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || result.assets.length === 0) {
        return;
      }

      const selectedUri = result.assets[0].uri;

      console.log("Selected avatar:", selectedUri);

      setNewAvatarUri(selectedUri);
    } catch (err) {
      console.log("Image picker error:", err);

      setError(err instanceof Error ? err.message : "Failed to select image.");
    }
  }

  // -----------------------------
  // CHANGE AVATAR
  // -----------------------------
  async function handleChangeAvatar() {
    setLoading(true);
    setError("");

    if (!newAvatarUri) {
      setError("Please select an avatar first.");
      setLoading(false);
      return;
    }

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError("You must be logged in to perform this action.");
        setLoading(false);
        return;
      }

      console.log("Uploading avatar for user:", user.id);

      const avatarUrl = await uploadAvatar(newAvatarUri, user.id);

      if (!avatarUrl) {
        setError("Failed to upload avatar.");
        setLoading(false);
        return;
      }

      // Updates Supabase AND the shared profile context.
      await updateAvatar(avatarUrl);

      console.log("Avatar successfully updated!");

      setNewAvatarUri("");
    } catch (err) {
      console.log("Avatar update error:", err);

      setError(err instanceof Error ? err.message : "Failed to update avatar.");
    }

    setLoading(false);
  }

  // -----------------------------
  // CHANGE CALORIE-GOAL BIOMETRICS
  // -----------------------------
  async function handleChangeBiometrics() {
    setLoading(true);
    setError("");

    const height = buildHeightValue(heightFeet, heightInches);

    const weight = newWeight ? Number(newWeight) : null;

    const age = newAge ? Number(newAge) : null;

    const sex = newSex;

    if (height === null && weight === null && age === null && sex === null) {
      setError("Please enter at least one value.");
      setLoading(false);
      return;
    }

    try {
      await updateBiometrics({
        height,
        weight,
        age,
        sex,
      });

      setHeightFeet("");
      setHeightInches("");
      setNewWeight("");
      setNewAge("");
      setNewSex(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update calorie information.",
      );
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
    <KeyboardAvoidingView
      className="flex-1"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 24,
          paddingVertical: 24,
        }}
        keyboardShouldPersistTaps="handled"
      >
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
            shadowOffset: {
              width: 0,
              height: 3,
            },
          }}
        >
          <ThemedText
            type="title"
            style={{
              marginBottom: Spacing.four,
            }}
          >
            Settings
          </ThemedText>

          {/* Theme Switcher */}
          <ThemedText
            type="smallBold"
            style={{
              marginBottom: Spacing.two,
            }}
          >
            Theme
          </ThemedText>

          <Button
            onPress={() =>
              setTheme(resolvedTheme === "light" ? "dark" : "light")
            }
          >
            {resolvedTheme === "light"
              ? "Switch to Dark Mode"
              : "Switch to Light Mode"}
          </Button>

          {/* Error */}
          {error.length > 0 && (
            <ThemedText
              type="smallBold"
              style={{
                color: "red",
                marginBottom: Spacing.four,
                marginTop: Spacing.four,
              }}
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

          <View
            style={{
              marginBottom: Spacing.four,
            }}
          >
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

          <View
            style={{
              marginBottom: Spacing.four,
            }}
          >
            <Button
              onPress={handleChangeDisplayName}
              isDisabled={loading || newDisplayName.trim().length === 0}
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

                if (selectedDate) {
                  setNewBirthdate(selectedDate);
                }
              }}
            />
          )}

          <View
            style={{
              marginBottom: Spacing.four,
            }}
          >
            <Button
              onPress={handleChangeBirthdate}
              isDisabled={loading || !newBirthdate}
            >
              Update Birthdate
            </Button>
          </View>

          {/* Avatar Picker */}
          <Button onPress={handlePickAvatar} isDisabled={loading}>
            {newAvatarUri ? "Change Avatar" : "Pick Avatar"}
          </Button>

          {/* Selected Avatar Preview */}
          {newAvatarUri.length > 0 && (
            <Image
              source={{
                uri: newAvatarUri,
              }}
              style={{
                width: 100,
                height: 100,
                borderRadius: 50,
                marginBottom: Spacing.four,
                marginTop: Spacing.four,
                alignSelf: "center",
              }}
            />
          )}

          <View
            style={{
              marginBottom: Spacing.four,
            }}
          >
            <Button
              onPress={handleChangeAvatar}
              isDisabled={loading || newAvatarUri.length === 0}
            >
              Update Avatar
            </Button>
          </View>

          {/* Calorie Goal Info */}
          <ThemedText
            type="smallBold"
            style={{
              marginBottom: Spacing.two,
            }}
          >
            Height
          </ThemedText>

          <HStack
            space="sm"
            style={{
              marginBottom: Spacing.four,
            }}
          >
            <Input
              placeholder="Feet"
              value={heightFeet}
              onChangeText={setHeightFeet}
              keyboardType="numeric"
              style={{
                flex: 1,
              }}
            />

            <Input
              placeholder="Inches"
              value={heightInches}
              onChangeText={setHeightInches}
              keyboardType="numeric"
              style={{
                flex: 1,
              }}
            />
          </HStack>

          <ThemedText
            type="smallBold"
            style={{
              marginBottom: Spacing.two,
            }}
          >
            Weight (lbs)
          </ThemedText>

          <Input
            placeholder="Weight in pounds"
            value={newWeight}
            onChangeText={setNewWeight}
            keyboardType="numeric"
            className="mb-4"
          />

          <ThemedText
            type="smallBold"
            style={{
              marginBottom: Spacing.two,
            }}
          >
            Age
          </ThemedText>

          <Input
            placeholder="Age"
            value={newAge}
            onChangeText={setNewAge}
            keyboardType="numeric"
            className="mb-4"
          />

          <ThemedText
            type="smallBold"
            style={{
              marginBottom: Spacing.two,
            }}
          >
            Sex
          </ThemedText>

          <HStack
            space="sm"
            style={{
              marginBottom: Spacing.four,
            }}
          >
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

          <View
            style={{
              marginBottom: Spacing.four,
            }}
          >
            <Button
              onPress={handleChangeBiometrics}
              isDisabled={
                loading ||
                (!heightFeet &&
                  !heightInches &&
                  !newWeight &&
                  !newAge &&
                  newSex === null)
              }
            >
              Update Calorie Info
            </Button>
          </View>

          {/* Delete Account */}
          {!confirmDelete ? (
            <View
              style={{
                marginBottom: Spacing.four,
              }}
            >
              <Button
                onPress={() => setConfirmDelete(true)}
                isDisabled={loading}
              >
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

              <View
                style={{
                  marginBottom: Spacing.four,
                }}
              >
                <Button onPress={handleDeleteAccount} isDisabled={loading}>
                  Yes, Delete My Account
                </Button>
              </View>

              <View
                style={{
                  marginBottom: Spacing.four,
                }}
              >
                <Button onPress={() => setConfirmDelete(false)}>Cancel</Button>
              </View>
            </>
          )}

          {/* Back */}
          <Button onPress={() => router.back()}>Back</Button>
        </ThemedView>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
