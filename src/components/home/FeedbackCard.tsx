import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, HelperText, Icon, Text, TextInput } from "react-native-paper";

import { useThemeMode } from "@/components/context/ThemeContext";
import { useUserContext } from "@/components/context/userContext";
import { StarRating } from "@/components/ui/StarRating";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { submitFeedback } from "@/lib/supabaseFunctions";

/** Survey at the bottom of Home: a half-star rating plus optional comments. */
export function FeedbackCard() {
  const { resolvedTheme } = useThemeMode();
  const colors = Colors[resolvedTheme];
  const { user } = useUserContext();

  const [stars, setStars] = useState(0);
  const [review, setReview] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const send = async () => {
    if (!user || stars === 0) return;
    setError("");
    setSending(true);
    try {
      await submitFeedback(user, stars, review);
      setSent(true);
      setStars(0);
      setReview("");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Couldn't send your feedback.",
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.backgroundElement, borderColor: colors.border },
      ]}
    >
      {sent ? (
        <View style={styles.thanks}>
          <View style={[styles.icon, { backgroundColor: colors.brandSoft }]}>
            <Icon source="heart-outline" size={24} color={colors.brand} />
          </View>
          <Text variant="titleMedium" style={[styles.title, { color: colors.text }]}>
            Thanks for the feedback!
          </Text>
          <Text
            variant="bodySmall"
            style={[styles.centered, { color: colors.textSecondary }]}
          >
            It helps us decide what to improve next.
          </Text>
          <Button mode="text" textColor={colors.brand} onPress={() => setSent(false)}>
            Send more feedback
          </Button>
        </View>
      ) : (
        <>
          <View>
            <Text variant="titleMedium" style={[styles.title, { color: colors.text }]}>
              How are we doing?
            </Text>
            <Text variant="bodySmall" style={{ color: colors.textSecondary }}>
              Rate UpKeep and tell us what you like or don&apos;t like.
            </Text>
          </View>

          <View style={styles.ratingRow}>
            <StarRating value={stars} onChange={setStars} disabled={sending} />
            <Text variant="labelLarge" style={{ color: colors.textSecondary }}>
              {stars > 0 ? `${stars} / 5` : "Tap to rate"}
            </Text>
          </View>

          <TextInput
            mode="outlined"
            label="What do you like or not like? (optional)"
            value={review}
            onChangeText={setReview}
            multiline
            numberOfLines={4}
            maxLength={1000}
            disabled={sending}
            outlineColor={colors.border}
            activeOutlineColor={colors.brand}
            style={{ backgroundColor: colors.background }}
          />

          {error !== "" && (
            <HelperText type="error" visible style={styles.error}>
              {error}
            </HelperText>
          )}

          <Button
            mode="contained"
            icon="send"
            onPress={send}
            loading={sending}
            disabled={sending || stars === 0}
            buttonColor={colors.brandStrong}
            textColor="#FFFFFF"
            style={styles.send}
          >
            Send feedback
          </Button>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  title: {
    fontWeight: "800",
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  error: {
    paddingHorizontal: 0,
  },
  send: {
    borderRadius: Radius.pill,
    alignSelf: "flex-start",
  },
  thanks: {
    alignItems: "center",
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  centered: {
    textAlign: "center",
  },
});
