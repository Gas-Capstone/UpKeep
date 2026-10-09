import { StyleSheet } from "react-native";
import { Button, Dialog, Portal, Text, useTheme } from "react-native-paper";

import { Radius, Spacing } from "@/constants/theme";

type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onDismiss: () => void;
  loading?: boolean;
  error?: string;
  // Destructive actions (deletes) show the confirm button in the error color.
  destructive?: boolean;
};

/** Yes/no confirmation styled like the app's cards and sheets. */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  onConfirm,
  onDismiss,
  loading = false,
  error = "",
  destructive = true,
}: ConfirmDialogProps) {
  const theme = useTheme();

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={loading ? undefined : onDismiss}
        style={[
          styles.dialog,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.outlineVariant,
          },
        ]}
      >
        <Dialog.Title style={styles.title}>{title}</Dialog.Title>
        <Dialog.Content>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            {message}
          </Text>
          {error !== "" && (
            <Text
              variant="bodySmall"
              style={[styles.error, { color: theme.colors.error }]}
            >
              {error}
            </Text>
          )}
        </Dialog.Content>
        <Dialog.Actions>
          <Button
            onPress={onDismiss}
            disabled={loading}
            textColor={theme.colors.onSurfaceVariant}
          >
            Cancel
          </Button>
          <Button
            mode="contained"
            onPress={onConfirm}
            loading={loading}
            disabled={loading}
            buttonColor={destructive ? theme.colors.error : theme.colors.primary}
            textColor={destructive ? theme.colors.onError : theme.colors.onPrimary}
            style={styles.confirm}
          >
            {confirmLabel}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  dialog: {
    borderRadius: Radius.large,
    borderWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontWeight: "800",
  },
  error: {
    marginTop: Spacing.two,
  },
  confirm: {
    borderRadius: Radius.pill,
  },
});
