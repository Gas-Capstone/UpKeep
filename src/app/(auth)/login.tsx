import { router } from "expo-router";
import { useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";

import { useThemeMode } from "@/components/context/ThemeContext";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Colors, MaxContentWidth, Radius, Spacing } from "@/constants/theme";
import { supabase } from "@/lib/supabaseClient";

export default function Login() {
  const { resolvedTheme } = useThemeMode();
  const colors = Colors[resolvedTheme];

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);

  async function routeAfterAuthentication() {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error("Could not load user.");
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("onboarding_complete")
      .eq("id", user.id)
      .single();

    if (profileError) {
      throw profileError;
    }

    if (!profile.onboarding_complete) {
      router.replace("/(auth)/setupProfileScreen");
    } else {
      router.replace("/");
    }
  }

  async function handleLogin() {
    if (loading) return;

    setLoading(true);
    setError("");

    try {
      // First factor: email + password
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (loginError) {
        setError(loginError.message);
        return;
      }

      // Check whether this account has verified TOTP enabled
      const { data: factors, error: factorsError } =
        await supabase.auth.mfa.listFactors();

      if (factorsError) {
        setError(factorsError.message);
        return;
      }

      const verifiedTotpFactor = factors.totp.find(
        (factor: { id: string; status: string }) =>
          factor.status === "verified",
      );

      // If TOTP exists, do NOT enter the app yet
      if (verifiedTotpFactor) {
        setMfaFactorId(verifiedTotpFactor.id);
        setMfaCode("");
        setMfaRequired(true);
        return;
      }

      // No 2FA enrolled
      await routeAfterAuthentication();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not sign in.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyMfa() {
    if (loading || !mfaFactorId) return;

    const code = mfaCode.trim();

    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify(
        {
          factorId: mfaFactorId,
          code,
        },
      );

      if (verifyError) {
        setError(verifyError.message);
        return;
      }

      // Password + TOTP are now both verified
      await routeAfterAuthentication();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not verify two-factor authentication.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleBackToLogin() {
    if (loading) return;

    setLoading(true);
    setError("");

    try {
      // Important because password login already created an AAL1 session
      await supabase.auth.signOut();
    } finally {
      setMfaRequired(false);
      setMfaFactorId(null);
      setMfaCode("");
      setPassword("");
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
            Your wellness, kept simple.
          </ThemedText>
        </View>

        <ThemedView
          type="backgroundElement"
          style={[styles.card, { borderColor: colors.border }]}
        >
          {!mfaRequired ? (
            <>
              <ThemedText type="title" style={styles.title}>
                Welcome back
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

              {error.length > 0 && (
                <ThemedText
                  type="smallBold"
                  style={[
                    styles.message,
                    {
                      color: colors.danger,
                    },
                  ]}
                >
                  {error}
                </ThemedText>
              )}

              <Button onPress={handleLogin} isDisabled={loading}>
                {loading ? "Logging in..." : "Login"}
              </Button>

              <View style={styles.createRow}>
                <ThemedText type="small" themeColor="textSecondary">
                  Don&apos;t have an account?{" "}
                </ThemedText>

                <Pressable
                  onPress={() => router.push("/(auth)/register")}
                  accessibilityRole="button"
                  accessibilityLabel="Create an account"
                  hitSlop={8}
                >
                  {({ pressed }) => (
                    <ThemedText
                      type="smallBold"
                      style={{
                        color: colors.brand,
                        opacity: pressed ? 0.65 : 1,
                      }}
                    >
                      Create account
                    </ThemedText>
                  )}
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <ThemedText type="title" style={styles.title} adjustsFontSizeToFit={true}>
                2FA
              </ThemedText>

              <ThemedText
                type="small"
                themeColor="textSecondary"
                style={styles.mfaDescription}
              >
                Enter the 6-digit code from your authenticator app to finish
                signing in.
              </ThemedText>

              <Input
                placeholder="6-digit code"
                value={mfaCode}
                onChangeText={(value) =>
                  setMfaCode(value.replace(/\D/g, "").slice(0, 6))
                }
                keyboardType="number-pad"
                maxLength={6}
                style={styles.input}
              />

              {error.length > 0 && (
                <ThemedText
                  type="smallBold"
                  style={[
                    styles.message,
                    {
                      color: colors.danger,
                    },
                  ]}
                >
                  {error}
                </ThemedText>
              )}

              <Button
                onPress={handleVerifyMfa}
                isDisabled={loading || mfaCode.length !== 6}
              >
                {loading ? "Verifying..." : "Verify code"}
              </Button>

              <Pressable
                onPress={handleBackToLogin}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel="Back to login"
                style={styles.backButton}
              >
                {({ pressed }) => (
                  <ThemedText
                    type="smallBold"
                    style={{
                      color: colors.brand,
                      opacity: pressed || loading ? 0.65 : 1,
                    }}
                  >
                    Back to login
                  </ThemedText>
                )}
              </Pressable>
            </>
          )}
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
    paddingVertical: Spacing.five,
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
    shadowOffset: {
      width: 0,
      height: 3,
    },
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

  createRow: {
    marginTop: Spacing.four,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap",
  },

  mfaDescription: {
    marginBottom: Spacing.four,
  },

  backButton: {
    alignSelf: "center",
    marginTop: Spacing.four,
  },
});
