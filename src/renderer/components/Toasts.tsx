import { useAppStore } from '../stores/app-store';

export const Toasts = (): JSX.Element => {
  const { toasts, dismissToast } = useAppStore();
  return (
    <div className="fixed bottom-4 right-4 z-[60] grid gap-2">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          className={`w-80 rounded border px-4 py-3 text-left text-sm shadow-lg ${
            toast.type === 'error'
              ? 'border-red-300 bg-red-50 text-red-800'
              : toast.type === 'success'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                : 'border-sky-300 bg-sky-50 text-sky-800'
          }`}
          onClick={() => dismissToast(toast.id)}
        >
          {toast.message}
        </button>
      ))}
    </div>
  );
};
