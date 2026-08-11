import { useState } from "react";
import { ScrollView, View, useColorScheme } from "react-native";
import { router } from "expo-router";

import { ThemedView } from "@/components/themed-view";
import { ThemedText } from "@/components/themed-text";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { Colors, Spacing, MaxContentWidth } from "@/constants/theme";
import { supabase } from "@/lib/supabaseClient";

export default function Login() {
  const scheme = useColorScheme();
  const colors = Colors[scheme === "dark" ? "dark" : "light"];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);
    setError("");

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (loginError) {
      setError(loginError.message);
      setLoading(false);
      return;
    }

    // After login → check profile
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError("Could not load user.");
      setLoading(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("onboarding_complete")
      .eq("id", user.id)
      .single();

    if (profileError) {
      setError(profileError.message);
      setLoading(false);
      return;
    }

    // If onboarding has NOT been completed → redirect to setup screen
    if (!profile.onboarding_complete) {
      router.replace("/(auth)/setupProfileScreen");
    } else {
      router.replace("/");
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
          Login
        </ThemedText>

        <Input
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          className="mb-4"
        />

        <Input
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          className="mb-4"
        />

        {error.length > 0 && (
          <ThemedText
            type="smallBold"
            style={{ color: "red", marginBottom: Spacing.four }}
          >
            {error}
          </ThemedText>
        )}

        <Button onPress={handleLogin} isDisabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </Button>

        <ThemedText type="small" style={{ marginBottom: Spacing.four }}>
          Don't have an account?
        </ThemedText>

        <Button onPress={() => router.push("/(auth)/register")}>
          Create Account
        </Button>
      </ThemedView>
    </View>
  );
}
