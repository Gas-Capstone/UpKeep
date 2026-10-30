import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Text, useTheme } from "react-native-paper";

import { Radius, Spacing } from "@/constants/theme";

/** Lays StatTiles out two to a row at phone width. */
export function StatGrid({ children }: { children: ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

/**
 * One labelled figure in a summary: "Day streak / 3 / 4 this week". Read out
 * as a single item by screen readers.
 */
export function StatTile({
  label,
  value,
  detail,
  compact = false,
}: {
  label: string;
  value: string;
  detail?: string;
  // Tighter padding and a smaller figure, for summaries that share space
  // with a list (History).
  compact?: boolean;
}) {
  const theme = useTheme();

  return (
    <View
      accessible
      accessibilityLabel={[label, value, detail].filter(Boolean).join(", ")}
      style={[
        styles.tile,
        compact && styles.compactTile,
        { backgroundColor: theme.colors.surfaceVariant },
      ]}
    >
      <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
        {label}
      </Text>
      <Text
        variant={compact ? "titleMedium" : "titleLarge"}
        numberOfLines={1}
        style={[styles.value, { color: theme.colors.onSurface }]}
      >
        {value}
      </Text>
      {detail ? (
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  tile: {
    flexBasis: "47%",
    flexGrow: 1,
    padding: Spacing.three,
    borderRadius: Radius.medium,
    gap: Spacing.half,
  },
  compactTile: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    gap: 0,
  },
  value: {
    fontWeight: "600",
  },
});
