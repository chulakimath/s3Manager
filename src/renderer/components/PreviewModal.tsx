import { X } from 'lucide-react';
import { useAppStore } from '../stores/app-store';

export const PreviewModal = (): JSX.Element | null => {
  const { preview, closePreview } = useAppStore();
  if (!preview) {
    return null;
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4">
      <div className="flex h-[86vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex h-12 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-700">
          <div className="truncate text-sm font-semibold">{preview.key}</div>
          <button className="icon-button" onClick={closePreview} title="Close preview">
            <X size={17} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-slate-100 p-4 dark:bg-slate-950">
          {preview.kind === 'image' && <img src={preview.dataUrl} className="mx-auto max-h-full max-w-full rounded" />}
          {(preview.kind === 'text' || preview.kind === 'json') && <pre className="whitespace-pre-wrap rounded bg-white p-4 text-sm dark:bg-slate-900">{preview.text}</pre>}
          {preview.kind === 'pdf' && <iframe src={preview.dataUrl} className="h-full min-h-[70vh] w-full rounded bg-white" title="PDF preview" />}
          {preview.kind === 'unsupported' && <div className="grid h-full place-items-center text-slate-500">Preview is unavailable for this file type.</div>}
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-slate-200 p-3 text-xs text-slate-500 dark:border-slate-700 sm:grid-cols-4">
          {Object.entries(preview.metadata).map(([key, value]) => (
            <div key={key} className="truncate"><span className="font-semibold">{key}:</span> {value}</div>
          ))}
        </div>
      </div>
    </div>
  );
};
