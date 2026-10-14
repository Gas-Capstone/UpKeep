/**
 * AgentScreen — the assistant.
 *
 * Renders the turn list from useAgent, an input box, and tappable chips when
 * the agent asks a clarifying question. Chips send the exact option text back,
 * which resolves unambiguously server side.
 *
 * Built on ThemedView/SafeAreaView rather than ScreenView because a chat needs
 * its own ScrollView ref to scroll to the newest turn, which ScreenView does
 * not expose.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { ActivityIndicator, Icon, IconButton, Text } from "react-native-paper";

import { useThemeMode } from "@/components/context/ThemeContext";
import { useHabitsContext } from "@/components/context/habitsContext";
import { useMealsData } from "@/components/context/mealsDataContext";
import { useWorkoutsData } from "@/components/context/workoutsDataContext";
import { ThemedView } from "@/components/themed-view";
import { BottomTabInset, Colors, Radius, Spacing } from "@/constants/theme";
import { useAgent } from "@/lib/useAgent";

const COMPOSER_HEIGHT = 44;

export default function AgentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { resolvedTheme } = useThemeMode();
  const colors = Colors[resolvedTheme];

  const { refreshCatalog, refreshFridge } = useMealsData();
  const { refreshHabits } = useHabitsContext();
  const { refreshWorkouts, refreshCompletedWorkouts } = useWorkoutsData();

  // The agent writes straight to Supabase, so the contexts the rest of the
  // app reads from are stale until something reloads them. They only load on
  // mount, so without this the fridge still looks unchanged after "I bought
  // 2 lbs of chicken".
  const refreshAfterAgentActions = useCallback(() => {
    refreshFridge();
    refreshCatalog();
    refreshWorkouts();
    refreshCompletedWorkouts();
    refreshHabits();
  }, [
    refreshFridge,
    refreshCatalog,
    refreshWorkouts,
    refreshCompletedWorkouts,
    refreshHabits,
  ]);

  const { turns, busy, offline, send, choose } = useAgent({
    onActionsCompleted: refreshAfterAgentActions,
  });
  const [draft, setDraft] = useState("");
  const scroller = useRef<ScrollView>(null);

  const submit = () => {
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");
    send(text);
  };

  // Only the newest agent turn's chips stay tappable — older questions have
  // been answered or abandoned.
  const lastTurn = turns[turns.length - 1];
  const chips =
    lastTurn?.role === "agent" && lastTurn.options?.length
      ? lastTurn.options
      : [];

  // The tab bar floats over this screen, so the composer clears it — but only
  // while the keyboard is down. With the keyboard up the bar is hidden behind
  // it, and keeping the gap would strand the input mid-screen.
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () =>
      setKeyboardOpen(true),
    );
    const hide = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboardOpen(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const composerClearance = keyboardOpen
    ? Spacing.two
    : BottomTabInset + insets.bottom;

  return (
    <ThemedView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        <View style={[styles.header, { paddingHorizontal: Spacing.three }]}>
          <IconButton
            icon="arrow-left"
            size={24}
            style={{ margin: 0 }}
            onPress={() => router.back()}
            accessibilityLabel="Back"
          />
          <Text
            variant="titleLarge"
            style={{ color: colors.text, marginLeft: Spacing.two, flex: 1 }}
          >
            Assistant
          </Text>
        </View>

        {offline && (
          <View style={[styles.banner, { backgroundColor: colors.brandSoft }]}>
            <Icon source="cloud-off-outline" size={16} color={colors.danger} />
            <Text variant="labelMedium" style={{ color: colors.danger }}>
              Assistant offline
            </Text>
          </View>
        )}

        <ScrollView
            ref={scroller}
            style={{ flex: 1 }}
            contentContainerStyle={{
              padding: Spacing.three,
              paddingBottom: Spacing.three,
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() =>
              scroller.current?.scrollToEnd({ animated: true })
            }
          >
            {turns.length === 0 && (
              <View style={{ paddingVertical: Spacing.five }}>
                <Text
                  variant="titleMedium"
                  style={{ color: colors.text, marginBottom: Spacing.two }}
                >
                  Ask me anything about your day
                </Text>
                <Text variant="bodyMedium" style={{ color: colors.textSecondary }}>
                  &ldquo;What can I cook tonight?&rdquo; ·
                  &ldquo;I bought chicken and rice&rdquo; ·
                  &ldquo;Remind me to stretch at 6pm&rdquo;
                </Text>
              </View>
            )}

            {turns.map((turn, index) => {
              const isUser = turn.role === "user";
              return (
                <View
                  key={index}
                  style={[
                    styles.bubble,
                    isUser
                      ? {
                          alignSelf: "flex-end",
                          backgroundColor: colors.brandStrong,
                        }
                      : {
                          alignSelf: "flex-start",
                          backgroundColor: colors.backgroundElement,
                          borderWidth: StyleSheet.hairlineWidth,
                          borderColor: colors.border,
                        },
                  ]}
                >
                  <Text
                    variant="bodyMedium"
                    style={{ color: isUser ? "#FFFFFF" : colors.text }}
                  >
                    {turn.text}
                  </Text>
                </View>
              );
            })}

            {chips.length > 0 && (
              <View style={styles.chipRow}>
                {chips.map((option) => (
                  <Pressable
                    key={option}
                    disabled={busy}
                    onPress={() => choose(option)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: colors.brandSoft,
                        borderColor: colors.brand,
                        opacity: busy ? 0.5 : 1,
                      },
                    ]}
                  >
                    <Text variant="labelLarge" style={{ color: colors.brandStrong }}>
                      {option}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            {busy && (
              <View style={styles.thinking}>
                <ActivityIndicator size="small" color={colors.brand} />
                <Text variant="bodySmall" style={{ color: colors.textSecondary }}>
                  Thinking…
                </Text>
              </View>
            )}
          </ScrollView>

        {/* RN's KeyboardAvoidingView doesn't move this on Android under
            edge-to-edge, which SDK 54+ enables by default — the window no
            longer resizes the way it assumes. This tracks the keyboard
            directly instead. */}
        <KeyboardStickyView offset={{ closed: 0, opened: 0 }}>
          <View
            style={[
              styles.composer,
              {
                paddingBottom: Spacing.two + composerClearance,
                backgroundColor: colors.backgroundElement,
                borderColor: colors.border,
              },
            ]}
          >
          <TextInput
            style={[
              styles.input,
              {
                borderColor: colors.border,
                color: colors.text,
                backgroundColor: colors.background,
              },
            ]}
            value={draft}
            onChangeText={setDraft}
            placeholder="Ask or tell me something"
            placeholderTextColor={colors.textSecondary}
            onSubmitEditing={submit}
            returnKeyType="send"
            editable={!busy}
          />
          <Pressable
            onPress={submit}
            disabled={!draft.trim() || busy}
            style={[
              styles.sendButton,
              {
                backgroundColor: colors.brandStrong,
                opacity: !draft.trim() || busy ? 0.4 : 1,
              },
            ]}
            accessibilityLabel="Send message"
          >
            <Icon source="send" size={20} color="#FFFFFF" />
          </Pressable>
          </View>
        </KeyboardStickyView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  bubble: {
    maxWidth: "85%",
    borderRadius: Radius.large,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    marginBottom: Spacing.two,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  chip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.pill,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  thinking: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingLeft: Spacing.one,
  },
  composer: {
    flexDirection: "row",
    gap: Spacing.two,
    padding: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    height: COMPOSER_HEIGHT,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    fontSize: 15,
  },
  sendButton: {
    height: COMPOSER_HEIGHT,
    width: COMPOSER_HEIGHT,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
});
