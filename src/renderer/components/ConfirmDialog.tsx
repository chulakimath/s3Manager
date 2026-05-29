interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog = ({ open, title, message, confirmLabel, onConfirm, onCancel }: Props): JSX.Element | null => {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-5 py-4 text-sm font-semibold dark:border-slate-700">{title}</div>
        <div className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">{message}</div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-700">
          <button className="button-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="button-primary" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
