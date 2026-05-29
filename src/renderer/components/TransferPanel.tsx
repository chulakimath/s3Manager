import { Square } from 'lucide-react';
import { useAppStore } from '../stores/app-store';
import { formatBytes } from '../utils/format';

export const TransferPanel = (): JSX.Element => {
  const { transfers, abortTransfer } = useAppStore();
  return (
    <aside className="h-48 shrink-0 border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="flex h-9 items-center justify-between border-b border-slate-100 px-3 text-sm font-semibold dark:border-slate-800">
        Transfers
        <span className="text-xs font-normal text-slate-500">{transfers.length} total</span>
      </div>
      <div className="h-[calc(100%-2.25rem)] overflow-auto">
        {transfers.length === 0 && <div className="grid h-full place-items-center text-sm text-slate-500">No active transfers.</div>}
        {transfers.map((item) => {
          const progress = item.bytesTotal > 0 ? Math.round((item.bytesTransferred / item.bytesTotal) * 100) : 0;
          return (
            <div key={item.id} className="grid grid-cols-[1fr_120px_90px_32px] items-center gap-3 border-b border-slate-100 px-3 py-2 text-xs dark:border-slate-800">
              <div className="min-w-0">
                <div className="truncate font-medium">{item.key}</div>
                {item.error && <div className="mt-1 truncate text-red-600 dark:text-red-400">{item.error}</div>}
                <div className="mt-1 h-1.5 rounded bg-slate-200 dark:bg-slate-800">
                  <div className={`h-1.5 rounded ${item.status === 'failed' ? 'bg-red-500' : 'bg-sky-500'}`} style={{ width: `${Math.min(100, progress)}%` }} />
                </div>
              </div>
              <div className="text-slate-500">{formatBytes(item.bytesTransferred)} / {formatBytes(item.bytesTotal)}</div>
              <div className="capitalize text-slate-500">{item.status}</div>
              {(item.status === 'queued' || item.status === 'running') && (
                <button className="icon-button h-7 w-7" onClick={() => void abortTransfer(item.id)} title="Abort">
                  <Square size={13} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
};
