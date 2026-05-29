import { useState } from 'react';
import { X } from 'lucide-react';
import { useAppStore } from '../stores/app-store';

interface Props {
  open: boolean;
  onClose: () => void;
}

export const SettingsDialog = ({ open, onClose }: Props): JSX.Element | null => {
  const settings = useAppStore((state) => state.settings);
  const saveSettings = useAppStore((state) => state.saveSettings);
  const [draft, setDraft] = useState(settings);
  if (!open) {
    return null;
  }
  const save = async (): Promise<void> => {
    await saveSettings(draft);
    onClose();
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4">
      <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h2 className="text-base font-semibold">Settings</h2>
          <button className="icon-button" onClick={onClose} title="Close"><X size={17} /></button>
        </div>
        <div className="grid gap-4 p-5">
          <label className="grid gap-1 text-sm">
            <span>Theme</span>
            <select className="input" value={draft.theme} onChange={(event) => setDraft({ ...draft, theme: event.target.value as typeof draft.theme })}>
              <option value="system">System</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span>Auto-refresh seconds</span>
            <input className="input" type="number" min={0} value={draft.autoRefreshSeconds} onChange={(event) => setDraft({ ...draft, autoRefreshSeconds: Number(event.target.value) })} />
          </label>
          <label className="grid gap-1 text-sm">
            <span>Parallel transfers</span>
            <input className="input" type="number" min={1} max={12} value={draft.parallelTransfers} onChange={(event) => setDraft({ ...draft, parallelTransfers: Number(event.target.value) })} />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-700">
          <button className="button-secondary" onClick={onClose}>Cancel</button>
          <button className="button-primary" onClick={() => void save()}>Save</button>
        </div>
      </div>
    </div>
  );
};
