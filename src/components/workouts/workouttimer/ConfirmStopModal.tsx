import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type ConfirmStopModalProps = {
  visible: boolean;
  elapsedTime: number;
  loading: boolean;
  error: string;
  onDismiss: () => void;
  onConfirm: () => void;
};

export function ConfirmStopModal({ visible, elapsedTime, loading, error, onDismiss, onConfirm }: ConfirmStopModalProps) {
  return (
    <ConfirmDialog
      visible={visible}
      title="Finish workout?"
      message={`Your elapsed time will be logged, rounded up to the next minute (currently ${elapsedTime} ${elapsedTime === 1 ? "minute" : "minutes"}). You can finish even with sets remaining.`}
      confirmLabel="Finish & log"
      destructive={false}
      loading={loading}
      error={error}
      onDismiss={onDismiss}
      onConfirm={onConfirm}
    />
  );
}
