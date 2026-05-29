import { useState } from 'react';
import { Download, FolderPlus, RefreshCw, Search, Settings, Upload, UploadCloud } from 'lucide-react';
import { useAppStore } from '../stores/app-store';
import { Breadcrumbs } from './Breadcrumbs';

interface Props {
  onSettings: () => void;
  onDownload: () => void;
}

export const Toolbar = ({ onSettings, onDownload }: Props): JSX.Element => {
  const store = useAppStore();
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const createFolder = async (): Promise<void> => {
    const trimmed = folderName.trim();
    if (!trimmed) {
      return;
    }
    await store.createFolder(trimmed);
    setFolderName('');
    setFolderDialogOpen(false);
  };
  return (
    <>
      <header className="flex h-24 shrink-0 flex-col border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="flex h-12 items-center gap-2 px-3">
          <button className="toolbar-button" onClick={() => void store.chooseUploadFiles()} title="Upload files">
            <Upload size={17} /> Upload
          </button>
          <button className="toolbar-button" onClick={() => void store.chooseUploadFolder()} title="Upload folder">
            <UploadCloud size={17} /> Folder
          </button>
          <button className="toolbar-button" onClick={onDownload} title="Download selected">
            <Download size={17} /> Download
          </button>
          <button className="toolbar-button" onClick={() => setFolderDialogOpen(true)} title="Create folder">
            <FolderPlus size={17} /> New Folder
          </button>
          <button className="icon-button ml-auto" onClick={() => void store.refresh()} title="Refresh">
            <RefreshCw size={17} />
          </button>
          <button className="icon-button" onClick={onSettings} title="Settings">
            <Settings size={17} />
          </button>
        </div>
        <div className="flex h-12 items-center gap-3 border-t border-slate-100 px-3 dark:border-slate-800">
          <div className="min-w-0 flex-1">
            <Breadcrumbs />
          </div>
          <label className="flex w-72 items-center gap-2 rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950">
            <Search size={16} className="text-slate-500" />
            <input
              className="min-w-0 flex-1 bg-transparent outline-none"
              placeholder="Search current listing"
              value={store.search}
              onChange={(event) => store.setSearch(event.target.value)}
            />
          </label>
        </div>
      </header>
      {folderDialogOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4">
          <form
            className="w-full max-w-sm rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
            onSubmit={(event) => {
              event.preventDefault();
              void createFolder();
            }}
          >
            <div className="border-b border-slate-200 px-5 py-4 text-sm font-semibold dark:border-slate-700">Create Folder</div>
            <div className="grid gap-2 p-5">
              <label className="grid gap-1 text-sm">
                <span>Folder name</span>
                <input className="input" autoFocus value={folderName} onChange={(event) => setFolderName(event.target.value)} />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-700">
              <button type="button" className="button-secondary" onClick={() => setFolderDialogOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="button-primary" disabled={!folderName.trim()}>
                Create
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};
