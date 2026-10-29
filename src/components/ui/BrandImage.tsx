import { useState } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { Image } from "expo-image";

import { useThemeMode } from "@/components/context/ThemeContext";
import { BrandImagePlaceholder } from "@/components/ui/BrandImagePlaceholder";
import { Colors, Radius } from "@/constants/theme";
import { track } from "@/lib/metrics";

type BrandImageProps = {
  /** Public URL of the photo. Null or empty falls back to the placeholder. */
  uri?: string | null;
  /** Shown by the placeholder when there is no photo. */
  label?: string;
  icon?: string;
  /** Alt text for screen readers. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * A photo in one of the app's reserved image slots, falling back to
 * BrandImagePlaceholder when there is no URL or the URL fails to load.
 *
 * The fallback matters as much as the photo: recipes the user creates have no
 * image, and a remote URL can 404 if a Storage object is renamed, so the slot
 * has to keep its size either way or card layouts shift.
 */
export function BrandImage({
  uri,
  label,
  icon,
  accessibilityLabel,
  style,
}: BrandImageProps) {
  const { resolvedTheme } = useThemeMode();
  const colors = Colors[resolvedTheme];
  const [failed, setFailed] = useState(false);

  if (!uri || failed) {
    return <BrandImagePlaceholder label={label} icon={icon} style={style} />;
  }

  // The photo fills a wrapper rather than taking `style` itself: callers size
  // these slots with ViewStyle, which expo-image's ImageStyle does not accept.
  return (
    <View
      style={[styles.container, { backgroundColor: colors.brandSoft }, style]}
    >
      <Image
        source={{ uri }}
        onError={(event) => {
          // Falling back silently hides the cause — a 404 from a renamed
          // object and a private bucket look identical on screen.
          console.warn("Image failed to load", uri, event.error);
          // The bucket only: object names under user-images carry user ids.
          track("image_error", {
            ok: false,
            props: {
              bucket:
                uri.match(/\/storage\/v1\/object\/public\/([^/]+)\//)?.[1] ??
                "external",
            },
          });
          setFailed(true);
        }}
        contentFit="cover"
        transition={200}
        style={StyleSheet.absoluteFill}
        accessibilityLabel={accessibilityLabel}
        accessible={Boolean(accessibilityLabel)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 96,
    borderRadius: Radius.medium,
    // Clips the photo to the rounded corners.
    overflow: "hidden",
  },
});
