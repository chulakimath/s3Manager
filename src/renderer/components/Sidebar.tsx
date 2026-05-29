import { useState } from 'react';
import { Database, Folder, Plus, Server } from 'lucide-react';
import { useAppStore } from '../stores/app-store';

interface Props {
  onNewConnection: () => void;
  onEditConnection: (id: string) => void;
  onDeleteConnection: (id: string) => void;
}

export const Sidebar = ({ onNewConnection, onEditConnection, onDeleteConnection }: Props): JSX.Element => {
  const { profiles, selectedProfileId, buckets, bucket, selectProfile, selectBucket } = useAppStore();
  const [menu, setMenu] = useState<{ x: number; y: number; id: string }>();

  const openConnectionMenu = (event: React.MouseEvent, id: string): void => {
    event.preventDefault();
    void selectProfile(id);
    setMenu({ x: event.clientX, y: event.clientY, id });
  };

  return (
    <aside className="relative flex h-full w-72 shrink-0 flex-col border-r border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950" onClick={() => setMenu(undefined)}>
      <div className="flex h-14 items-center justify-between border-b border-slate-200 px-3 dark:border-slate-800">
        <div className="flex items-center gap-2 font-semibold">
          <Database size={18} />
          S3 Browser
        </div>
        <button className="icon-button" onClick={onNewConnection} title="New connection">
          <Plus size={17} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2">
        <div className="px-2 py-1 text-xs font-semibold uppercase text-slate-500">Connections</div>
        {profiles.map((profile) => (
          <button
            key={profile.id}
            className={`nav-row ${selectedProfileId === profile.id ? 'nav-row-active' : ''}`}
            onClick={() => void selectProfile(profile.id)}
            onContextMenu={(event) => openConnectionMenu(event, profile.id)}
            title={profile.name}
          >
            <Server size={16} />
            <span className="truncate">{profile.name}</span>
          </button>
        ))}
        <div className="mt-4 px-2 py-1 text-xs font-semibold uppercase text-slate-500">Buckets</div>
        {buckets.map((item) => (
          <button
            key={item.name}
            className={`nav-row ${bucket === item.name ? 'nav-row-active' : ''}`}
            onClick={() => void selectBucket(item.name)}
          >
            <Folder size={16} />
            <span className="truncate">{item.name}</span>
          </button>
        ))}
      </div>
      {menu && (
        <div
          className="fixed z-40 w-44 rounded-md border border-slate-200 bg-white py-1 text-sm shadow-xl dark:border-slate-700 dark:bg-slate-900"
          style={{ left: menu.x, top: menu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            className="menu-item"
            onClick={() => {
              setMenu(undefined);
              onEditConnection(menu.id);
            }}
          >
            Edit Connection
          </button>
          <button
            className="menu-item text-red-600"
            onClick={() => {
              setMenu(undefined);
              onDeleteConnection(menu.id);
            }}
          >
            Delete Connection
          </button>
        </div>
      )}
    </aside>
  );
};
