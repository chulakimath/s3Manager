import { ChevronRight, Home } from 'lucide-react';
import { useAppStore } from '../stores/app-store';

export const Breadcrumbs = (): JSX.Element => {
  const { prefix, openPrefix, bucket } = useAppStore();
  const parts = prefix.split('/').filter(Boolean);
  return (
    <div className="flex min-w-0 items-center gap-1 text-sm">
      <button className="breadcrumb" onClick={() => void openPrefix('')} disabled={!bucket}>
        <Home size={16} />
      </button>
      {parts.map((part, index) => {
        const next = `${parts.slice(0, index + 1).join('/')}/`;
        return (
          <div className="flex min-w-0 items-center gap-1" key={next}>
            <ChevronRight size={14} className="text-slate-400" />
            <button className="breadcrumb truncate" onClick={() => void openPrefix(next)}>
              {part}
            </button>
          </div>
        );
      })}
    </div>
  );
};
