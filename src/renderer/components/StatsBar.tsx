import { Database, FileArchive, FolderTree } from 'lucide-react';
import { useAppStore } from '../stores/app-store';
import { formatBytes } from '../utils/format';

export const StatsBar = (): JSX.Element => {
  const { stats } = useAppStore();
  return (
    <div className="grid grid-cols-3 gap-px border-b border-slate-200 bg-slate-200 text-xs dark:border-slate-800 dark:bg-slate-800">
      <div className="flex items-center gap-2 bg-white px-3 py-2 dark:bg-slate-900"><FileArchive size={15} /> {stats?.objectCount ?? 0} objects</div>
      <div className="flex items-center gap-2 bg-white px-3 py-2 dark:bg-slate-900"><FolderTree size={15} /> {stats?.folderCount ?? 0} folders</div>
      <div className="flex items-center gap-2 bg-white px-3 py-2 dark:bg-slate-900"><Database size={15} /> {formatBytes(stats?.totalBytes ?? 0)}{stats?.sampled ? ' sampled' : ''}</div>
    </div>
  );
};
