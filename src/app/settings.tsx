import { View } from "react-native";
import { useColorScheme } from "react-native";
import { router } from "expo-router";

import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { Colors, Spacing, MaxContentWidth } from "@/constants/theme";
import { supabase } from "@/lib/supabaseClient";
import { useUserContext } from "@/components/context/userContext";
import { useProfileData } from "@/components/context/profileDataContext";
import { useEffect, useState } from "react";

export default function SettingsScreen() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === "dark" ? "dark" : "light"];
  const { user } = useUserContext();
  const {
    profile,
    loading: profileLoading,
    updatePrimaryGoal,
  } = useProfileData();

  const [newPassword, setNewPassword] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(false);

  // Primary goal — prefilled from the shared profileDataContext once it loads.
  const [primaryGoal, setPrimaryGoal] = useState("");

  useEffect(() => {
    if (profile) {
      setPrimaryGoal(profile.primary_goal ?? "");
    }
  }, [profile]);

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

  async function handleChangePrimaryGoal() {
    setLoading(true);
    setError("");

    try {
      await updatePrimaryGoal(primaryGoal);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Couldn't update your goal",
      );
    }

    setLoading(false);
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

        {/* Change Primary Goal */}
        <Input
          placeholder="Primary Goal"
          value={primaryGoal}
          onChangeText={setPrimaryGoal}
          editable={!profileLoading}
          className="mb-4"
        />

        <View style={{ marginBottom: Spacing.four }}>
          <Button
            onPress={handleChangePrimaryGoal}
            isDisabled={loading || profileLoading || primaryGoal.length === 0}
          >
            Update Primary Goal
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
