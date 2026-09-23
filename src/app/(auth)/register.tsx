// app/(auth)/register.tsx
import { router } from "expo-router";
import { useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useThemeMode } from "@/components/context/ThemeContext";
import { Colors, MaxContentWidth, Radius, Spacing } from "@/constants/theme";
import { supabase } from "@/lib/supabaseClient";

export default function Register() {
  const { resolvedTheme } = useThemeMode();
  const colors = Colors[resolvedTheme];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const passwordsMatch = password === confirm;

  async function handleRegister() {
    setError("");

    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }

    if (!password) {
      setError("Please enter a password.");
      return;
    }

    if (!passwordsMatch) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      const { data: signupData, error: signupError } =
        await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

      if (signupError) {
        console.error("SIGNUP ERROR MESSAGE:", signupError.message);
        console.error("SIGNUP ERROR NAME:", signupError.name);
        console.error("SIGNUP ERROR STATUS:", signupError.status);

        setError(signupError.message);
        return;
      }

      const user = signupData.user;

      if (!user) {
        setError("Registration succeeded but no user was returned.");
        return;
      }

      router.replace("/(auth)/setupProfileScreen");
    } catch (err) {
      console.error("REGISTRATION UNEXPECTED ERROR:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while creating your account.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <ThemedView type="background" style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.brandBlock}>
          <Image
            source={require("../../../assets/images/upkeep-logo.png")}
            style={styles.logo}
            resizeMode="cover"
            accessibilityLabel="UpKeep logo"
          />
          <ThemedText type="subtitle" style={styles.brandName}>
            UpKeep
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Start building your wellness routine.
          </ThemedText>
        </View>

        <ThemedView
          type="backgroundElement"
          style={[
            styles.card,
            {
              borderColor: colors.border,
            },
          ]}
        >
          <ThemedText type="title" style={styles.title}>
            Create Account
          </ThemedText>

          <Input
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            style={styles.input}
          />

          <Input
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={styles.input}
          />

          <Input
            placeholder="Confirm Password"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            style={styles.input}
          />

          {!passwordsMatch && confirm.length > 0 && (
            <ThemedText
              type="smallBold"
              style={[styles.message, { color: colors.danger }]}
            >
              Passwords do not match
            </ThemedText>
          )}

          {error.length > 0 && (
            <ThemedText
              type="smallBold"
              style={[styles.message, { color: colors.danger }]}
            >
              {error}
            </ThemedText>
          )}

          <Button onPress={handleRegister} isDisabled={loading}>
            {loading ? "Creating account..." : "Register"}
          </Button>

          <View style={styles.signInRow}>
            <ThemedText type="small" themeColor="textSecondary">
              Already have an account?{" "}
            </ThemedText>
            <Pressable
              onPress={() => router.replace("/(auth)/login")}
              accessibilityRole="button"
              accessibilityLabel="Go back to login"
              hitSlop={8}
            >
              {({ pressed }) => (
                <ThemedText
                  type="smallBold"
                  style={[
                    styles.signInLink,
                    {
                      color: colors.brand,
                      opacity: pressed ? 0.65 : 1,
                    },
                  ]}
                >
                  Sign in
                </ThemedText>
              )}
            </Pressable>
          </View>
        </ThemedView>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  brandBlock: {
    alignItems: "center",
    marginBottom: Spacing.four,
  },
  logo: {
    width: 76,
    height: 76,
    borderRadius: Radius.large,
    marginBottom: Spacing.two,
  },
  brandName: {
    fontWeight: "800",
    marginBottom: 2,
  },
  card: {
    width: "100%",
    maxWidth: MaxContentWidth,
    padding: Spacing.four,
    borderRadius: Spacing.five,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  title: {
    marginBottom: Spacing.four,
  },
  input: {
    marginBottom: Spacing.four,
  },
  message: {
    marginBottom: Spacing.two,
  },
  signInRow: {
    marginTop: Spacing.four,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap",
  },
  signInLink: {
    textDecorationLine: "underline",
  },
});
