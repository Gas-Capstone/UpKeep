import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";

import { useProfileData } from "@/components/context/profileDataContext";
import { useThemeMode } from "@/components/context/ThemeContext";
import { useUserContext } from "@/components/context/userContext";
import { ThemedText } from "@/components/themed-text";
import { Colors, Radius, Spacing } from "@/constants/theme";

function isBirthdayToday(birthdate: string | null | undefined) {
  if (!birthdate) return false;

  const [year, month, day] = birthdate.split("-").map(Number);
  if (!year || !month || !day) return false;

  const today = new Date();
  return today.getMonth() + 1 === month && today.getDate() === day;
}

export function BirthdayCelebration() {
  const { user } = useUserContext();
  const { profile, loading } = useProfileData();
  const { resolvedTheme } = useThemeMode();
  const colors = Colors[resolvedTheme];
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!user?.id || loading || !isBirthdayToday(profile?.birthdate)) {
      setVisible(false);
      return;
    }

    let active = true;
    const year = new Date().getFullYear();
    const key = `birthday-celebration:${user.id}:${year}`;

    AsyncStorage.getItem(key)
      .then(async (alreadyShown) => {
        if (!active || alreadyShown) return;
        setVisible(true);
        await AsyncStorage.setItem(key, "shown");
      })
      .catch(() => {
        if (active) setVisible(true);
      });

    return () => {
      active = false;
    };
  }, [user?.id, profile?.birthdate, loading]);

  const displayName = profile?.display_name?.trim();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => setVisible(false)}
    >
      <View style={styles.backdrop}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.backgroundElement,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.sparkleRow}>
            <Ionicons name="sparkles" size={22} color={colors.brand} />
            <View
              style={[styles.iconBubble, { backgroundColor: colors.brandSoft }]}
            >
              <Ionicons
                name="gift-outline"
                size={34}
                color={colors.brandStrong}
              />
            </View>
            <Ionicons name="sparkles" size={22} color={colors.brand} />
          </View>

          <ThemedText style={styles.title}>
            Happy birthday{displayName ? `, ${displayName}` : ""}! 🎉
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.body}>
            Hope today feels like a good one. Keep taking care of yourself and
            enjoy your day.
          </ThemedText>

          <Pressable
            onPress={() => setVisible(false)}
            accessibilityRole="button"
            accessibilityLabel="Close birthday message"
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: colors.brandStrong },
              pressed && styles.pressed,
            ]}
          >
            <ThemedText type="smallBold" style={styles.buttonText}>
              Thanks!
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.52)",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.four,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: Radius.large,
    borderWidth: 1,
    padding: Spacing.five,
    alignItems: "center",
  },
  sparkleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    marginBottom: Spacing.four,
  },
  iconBubble: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "900",
    textAlign: "center",
  },
  body: {
    textAlign: "center",
    lineHeight: 22,
    marginTop: Spacing.two,
    marginBottom: Spacing.four,
  },
  button: {
    minHeight: 46,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.five,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#FFFFFF",
  },
  pressed: {
    opacity: 0.86,
  },
});
