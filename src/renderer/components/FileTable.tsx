import { useMemo, useState } from 'react';
import { File, FileJson, FileText, Folder, Image, MoreVertical } from 'lucide-react';
import type { ObjectEntry } from '../../shared/types';
import { useAppStore } from '../stores/app-store';
import { formatBytes, formatDate } from '../utils/format';
import { unwrap } from '../utils/ipc';
import { ConfirmDialog } from './ConfirmDialog';

type SortKey = 'name' | 'size' | 'lastModified' | 'storageClass';

interface PropertiesState {
  entry: ObjectEntry;
  metadata: Record<string, string>;
}

const iconFor = (entry: ObjectEntry): JSX.Element => {
  if (entry.isFolder) {
    return <Folder size={18} className="text-sky-500" />;
  }
  if (entry.contentType?.startsWith('image/')) {
    return <Image size={18} className="text-emerald-500" />;
  }
  if (entry.contentType === 'application/json' || entry.key.endsWith('.json')) {
    return <FileJson size={18} className="text-amber-500" />;
  }
  if (entry.contentType?.startsWith('text/')) {
    return <FileText size={18} className="text-indigo-500" />;
  }
  return <File size={18} className="text-slate-500" />;
};

export const FileTable = (): JSX.Element => {
  const store = useAppStore();
  const [sort, setSort] = useState<SortKey>('name');
  const [ascending, setAscending] = useState(true);
  const [menu, setMenu] = useState<{ x: number; y: number; key: string }>();
  const [confirmDownloadOpen, setConfirmDownloadOpen] = useState(false);
  const [properties, setProperties] = useState<PropertiesState>();

  const rows = useMemo(() => {
    const filtered = [...store.folders, ...store.objects].filter((item) => item.name.toLowerCase().includes(store.search.toLowerCase()));
    return filtered.sort((a, b) => {
      const direction = ascending ? 1 : -1;
      if (a.isFolder !== b.isFolder) {
        return a.isFolder ? -1 : 1;
      }
      return String(a[sort] ?? '').localeCompare(String(b[sort] ?? ''), undefined, { numeric: true }) * direction;
    });
  }, [ascending, sort, store.folders, store.objects, store.search]);

  const changeSort = (next: SortKey): void => {
    setAscending(sort === next ? !ascending : true);
    setSort(next);
  };

  const openContext = (event: React.MouseEvent, key: string): void => {
    event.preventDefault();
    event.stopPropagation();
    store.selectKey(key, false);
    setMenu({ x: event.clientX, y: event.clientY, key });
  };

  const openContextFromButton = (event: React.MouseEvent<HTMLButtonElement>, key: string): void => {
    const rect = event.currentTarget.getBoundingClientRect();
    openContext(event, key);
    setMenu({ x: rect.left - 170, y: rect.bottom + 4, key });
  };

  const requestDownload = async (): Promise<void> => {
    setMenu(undefined);
    if (store.selectedIncludesFolder()) {
      setConfirmDownloadOpen(true);
      return;
    }
    await store.downloadSelected();
  };

  const confirmFolderDownload = async (): Promise<void> => {
    setConfirmDownloadOpen(false);
    await store.downloadSelected({ confirmFolders: true });
  };

  const showProperties = async (key: string): Promise<void> => {
    setMenu(undefined);
    const entry = rows.find((item) => item.key === key);
    if (!entry || !store.selectedProfileId || !store.bucket) {
      return;
    }
    if (entry.isFolder) {
      setProperties({
        entry,
        metadata: {
          bucket: store.bucket,
          key: entry.key,
          type: 'Folder prefix'
        }
      });
      return;
    }
    try {
      const metadata = await unwrap(window.s3Browser.s3.metadata(store.selectedProfileId, store.bucket, entry.key));
      setProperties({ entry, metadata: { bucket: store.bucket, key: entry.key, ...metadata } });
    } catch (error) {
      store.toast('error', error instanceof Error ? error.message : String(error));
    }
  };

  if (!store.bucket) {
    return <div className="grid flex-1 place-items-center text-slate-500">Select or create a connection to browse buckets.</div>;
  }

  return (
    <div className="relative min-h-0 flex-1 overflow-auto" onClick={() => setMenu(undefined)}>
      <table className="w-full table-fixed text-left text-sm">
        <thead className="sticky top-0 z-10 bg-white text-xs uppercase text-slate-500 shadow-sm dark:bg-slate-900">
          <tr>
            <th className="w-8 px-3 py-2"></th>
            <th className="px-3 py-2"><button onClick={() => changeSort('name')}>Name</button></th>
            <th className="w-32 px-3 py-2"><button onClick={() => changeSort('size')}>Size</button></th>
            <th className="w-44 px-3 py-2"><button onClick={() => changeSort('lastModified')}>Modified</button></th>
            <th className="w-40 px-3 py-2"><button onClick={() => changeSort('storageClass')}>Storage</button></th>
            <th className="w-10 px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {store.loading &&
            Array.from({ length: 8 }).map((_, index) => (
              <tr key={index} className="animate-pulse border-b border-slate-100 dark:border-slate-800">
                <td colSpan={6} className="px-3 py-3"><div className="h-4 rounded bg-slate-200 dark:bg-slate-800" /></td>
              </tr>
            ))}
          {!store.loading && rows.length === 0 && (
            <tr><td colSpan={6} className="py-16 text-center text-slate-500">This folder is empty.</td></tr>
          )}
          {!store.loading &&
            rows.map((entry) => (
              <tr
                key={entry.key}
                className={`cursor-default border-b border-slate-100 hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-800 ${
                  store.selectedKeys.includes(entry.key) ? 'bg-sky-100 dark:bg-sky-950' : ''
                }`}
                onClick={(event) => store.selectKey(entry.key, event.ctrlKey || event.metaKey)}
                onDoubleClick={() => (entry.isFolder ? void store.openPrefix(entry.key) : void store.previewObject(entry.key))}
                onContextMenu={(event) => openContext(event, entry.key)}
              >
                <td className="px-3 py-2">{iconFor(entry)}</td>
                <td className="truncate px-3 py-2">{entry.name}</td>
                <td className="px-3 py-2 text-slate-500">{entry.isFolder ? '' : formatBytes(entry.size)}</td>
                <td className="px-3 py-2 text-slate-500">{formatDate(entry.lastModified)}</td>
                <td className="truncate px-3 py-2 text-slate-500">{entry.storageClass ?? ''}</td>
                <td className="px-3 py-2">
                  <button className="icon-button h-7 w-7" onClick={(event) => openContextFromButton(event, entry.key)} title="More actions">
                    <MoreVertical size={16} />
                  </button>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
      {store.continuationToken && (
        <div className="p-3 text-center">
          <button className="button-secondary" onClick={() => void store.loadMore()}>Load more</button>
        </div>
      )}
      {menu && (
        <div className="fixed z-40 w-48 rounded-md border border-slate-200 bg-white py-1 text-sm shadow-xl dark:border-slate-700 dark:bg-slate-900" style={{ left: menu.x, top: menu.y }}>
          <button className="menu-item" onClick={() => void store.previewObject(menu.key)}>Preview</button>
          <button className="menu-item" onClick={() => void requestDownload()}>Download</button>
          <button className="menu-item" onClick={() => void showProperties(menu.key)}>Properties</button>
          <button className="menu-item" onClick={() => void store.copyUrlSelected()}>Copy Object URL</button>
          <button className="menu-item" onClick={() => void store.presignSelected()}>Copy Pre-signed URL</button>
          <button className="menu-item text-red-600" onClick={() => void store.deleteSelected()}>Delete</button>
        </div>
      )}
      {confirmDownloadOpen && (
        <ConfirmDialog
          open={confirmDownloadOpen}
          title="Download Folder"
          message="The selected items include a folder. Downloading it will recursively download every object inside that folder."
          confirmLabel="Download Folder"
          onCancel={() => setConfirmDownloadOpen(false)}
          onConfirm={() => void confirmFolderDownload()}
        />
      )}
      {properties && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4">
          <div className="flex max-h-[82vh] w-full max-w-2xl flex-col rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
              <div className="min-w-0">
                <div className="text-sm font-semibold">Properties</div>
                <div className="truncate text-xs text-slate-500">{properties.entry.key}</div>
              </div>
              <button className="icon-button" onClick={() => setProperties(undefined)} title="Close properties">
                x
              </button>
            </div>
            <div className="min-h-0 overflow-auto p-5">
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <Property label="Name" value={properties.entry.name} />
                <Property label="Type" value={properties.entry.isFolder ? 'Folder' : properties.entry.contentType ?? 'Object'} />
                <Property label="Bucket" value={properties.metadata.bucket} />
                <Property label="Size" value={properties.entry.isFolder ? '' : formatBytes(properties.entry.size)} />
                <Property label="Last modified" value={properties.entry.lastModified ? new Date(properties.entry.lastModified).toLocaleString() : ''} />
                <Property label="Storage class" value={properties.entry.storageClass ?? properties.metadata.storageClass ?? ''} />
                <Property label="Content type" value={properties.metadata.contentType ?? properties.entry.contentType ?? ''} />
                <Property label="ETag" value={properties.entry.etag ?? properties.metadata.etag ?? ''} />
              </div>
              <div className="mt-5">
                <div className="mb-2 text-xs font-semibold uppercase text-slate-500">S3 Metadata</div>
                <div className="overflow-hidden rounded border border-slate-200 dark:border-slate-700">
                  {Object.entries(properties.metadata).map(([key, value]) => (
                    <div key={key} className="grid grid-cols-[150px_1fr] border-b border-slate-100 text-xs last:border-b-0 dark:border-slate-800">
                      <div className="bg-slate-50 px-3 py-2 font-medium text-slate-600 dark:bg-slate-950 dark:text-slate-300">{key}</div>
                      <div className="min-w-0 break-all px-3 py-2 text-slate-700 dark:text-slate-200">{value || '-'}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end border-t border-slate-200 px-5 py-4 dark:border-slate-700">
              <button className="button-secondary" onClick={() => setProperties(undefined)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Property = ({ label, value }: { label: string; value: string }): JSX.Element => (
  <div className="min-w-0 rounded border border-slate-200 p-3 dark:border-slate-700">
    <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
    <div className="mt-1 min-h-5 break-all text-sm">{value || '-'}</div>
  </div>
);
