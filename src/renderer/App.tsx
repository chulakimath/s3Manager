import { useCallback, useEffect, useMemo, useState } from 'react';
import { ConnectionDialog } from './components/ConnectionDialog';
import { ConfirmDialog } from './components/ConfirmDialog';
import { FileTable } from './components/FileTable';
import { PreviewModal } from './components/PreviewModal';
import { SettingsDialog } from './components/SettingsDialog';
import { Sidebar } from './components/Sidebar';
import { StatsBar } from './components/StatsBar';
import { Toasts } from './components/Toasts';
import { Toolbar } from './components/Toolbar';
import { TransferPanel } from './components/TransferPanel';
import { useShortcuts } from './hooks/use-shortcuts';
import { useAppStore } from './stores/app-store';
import { unwrap } from './utils/ipc';
import type { ConnectionProfile } from '../shared/types';

export const App = (): JSX.Element => {
  const loadInitial = useAppStore((state) => state.loadInitial);
  const updateTransfer = useAppStore((state) => state.updateTransfer);
  const toast = useAppStore((state) => state.toast);
  const chooseUploadFiles = useAppStore((state) => state.chooseUploadFiles);
  const downloadSelected = useAppStore((state) => state.downloadSelected);
  const selectedIncludesFolder = useAppStore((state) => state.selectedIncludesFolder);
  const refresh = useAppStore((state) => state.refresh);
  const deleteSelected = useAppStore((state) => state.deleteSelected);
  const removeProfile = useAppStore((state) => state.removeProfile);
  const uploadFiles = useAppStore((state) => state.uploadFiles);
  const bucket = useAppStore((state) => state.bucket);
  const prefix = useAppStore((state) => state.prefix);
  const autoRefreshSeconds = useAppStore((state) => state.settings.autoRefreshSeconds);
  const theme = useAppStore((state) => state.settings.theme);
  const [connectionOpen, setConnectionOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ConnectionProfile>();
  const [deleteProfileId, setDeleteProfileId] = useState<string>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [transfersOpen, setTransfersOpen] = useState(true);
  const [confirmDownloadOpen, setConfirmDownloadOpen] = useState(false);
  const openConnection = useCallback(() => {
    setEditingProfile(undefined);
    setConnectionOpen(true);
  }, []);
  const toggleTransfers = useCallback(() => setTransfersOpen((value) => !value), []);
  const requestDownload = useCallback(() => {
    if (selectedIncludesFolder()) {
      setConfirmDownloadOpen(true);
      return;
    }
    void downloadSelected();
  }, [downloadSelected, selectedIncludesFolder]);
  useShortcuts(openConnection, toggleTransfers, requestDownload);

  const editConnection = useCallback(
    async (id: string) => {
      try {
        setEditingProfile(await unwrap(window.s3Browser.profiles.revealSecret(id)));
        setConnectionOpen(true);
      } catch (error) {
        toast('error', error instanceof Error ? error.message : String(error));
      }
    },
    [toast]
  );

  const confirmDeleteConnection = useCallback(async () => {
    if (!deleteProfileId) {
      return;
    }
    try {
      await removeProfile(deleteProfileId);
      setDeleteProfileId(undefined);
      toast('success', 'Connection removed.');
    } catch (error) {
      toast('error', error instanceof Error ? error.message : String(error));
    }
  }, [deleteProfileId, removeProfile, toast]);

  useEffect(() => {
    void loadInitial().catch((error) => toast('error', error instanceof Error ? error.message : String(error)));
    return window.s3Browser.events.onTransfer((item) => updateTransfer(item));
  }, [loadInitial, toast, updateTransfer]);

  useEffect(() => {
    return window.s3Browser.events.onMenuCommand((command) => {
      if (command === 'new-connection') {
        setConnectionOpen(true);
      }
      if (command === 'upload-files') {
        void chooseUploadFiles();
      }
      if (command === 'download-selected') {
        requestDownload();
      }
      if (command === 'refresh') {
        void refresh();
      }
      if (command === 'delete-selected') {
        void deleteSelected();
      }
      if (command === 'toggle-transfers') {
        toggleTransfers();
      }
      if (command === 'focus-search') {
        document.querySelector<HTMLInputElement>('input[placeholder="Search current listing"]')?.focus();
      }
    });
  }, [chooseUploadFiles, deleteSelected, refresh, requestDownload, toggleTransfers]);

  useEffect(() => {
    const root = document.documentElement;
    const wantsDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    root.classList.toggle('dark', wantsDark);
  }, [theme]);

  useEffect(() => {
    if (!autoRefreshSeconds || !bucket) {
      return undefined;
    }
    const id = window.setInterval(() => void refresh(), autoRefreshSeconds * 1000);
    return () => window.clearInterval(id);
  }, [autoRefreshSeconds, bucket, prefix, refresh]);

  const dropHandlers = useMemo(
    () => ({
      onDragOver: (event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      },
      onDrop: (event: React.DragEvent) => {
        event.preventDefault();
        const paths = Array.from(event.dataTransfer.files)
          .map((file) => (file as File & { path?: string }).path)
          .filter((item): item is string => Boolean(item));
        void uploadFiles(paths);
      }
    }),
    [uploadFiles]
  );

  return (
    <div className="flex h-screen overflow-hidden bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100" {...dropHandlers}>
      <Sidebar onNewConnection={openConnection} onEditConnection={(id) => void editConnection(id)} onDeleteConnection={setDeleteProfileId} />
      <main className="flex min-w-0 flex-1 flex-col">
        <Toolbar onSettings={() => setSettingsOpen(true)} onDownload={requestDownload} />
        <StatsBar />
        <FileTable />
        {transfersOpen && <TransferPanel />}
      </main>
      <ConnectionDialog
        open={connectionOpen}
        profile={editingProfile}
        onClose={() => {
          setConnectionOpen(false);
          setEditingProfile(undefined);
        }}
      />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ConfirmDialog
        open={confirmDownloadOpen}
        title="Download Folder"
        message="The selected items include a folder. Downloading it will recursively download every object inside that folder."
        confirmLabel="Download Folder"
        onCancel={() => setConfirmDownloadOpen(false)}
        onConfirm={() => {
          setConfirmDownloadOpen(false);
          void downloadSelected({ confirmFolders: true });
        }}
      />
      <ConfirmDialog
        open={Boolean(deleteProfileId)}
        title="Delete Connection"
        message="This removes the saved connection profile from this app. Objects and buckets in S3 are not deleted."
        confirmLabel="Delete Connection"
        onCancel={() => setDeleteProfileId(undefined)}
        onConfirm={() => void confirmDeleteConnection()}
      />
      <PreviewModal />
      <Toasts />
    </div>
  );
};
