import { create } from 'zustand';
import type {
  AppSettings,
  BucketStats,
  BucketSummary,
  ConnectionProfileInput,
  FilePreview,
  ListObjectsResponse,
  ObjectEntry,
  SafeConnectionProfile,
  TransferItem
} from '../../shared/types';
import { unwrap } from '../utils/ipc';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface AppState {
  profiles: SafeConnectionProfile[];
  selectedProfileId?: string;
  buckets: BucketSummary[];
  bucket?: string;
  prefix: string;
  objects: ObjectEntry[];
  folders: ObjectEntry[];
  selectedKeys: string[];
  continuationToken?: string;
  loading: boolean;
  search: string;
  transfers: TransferItem[];
  preview?: FilePreview;
  stats?: BucketStats;
  settings: AppSettings;
  toasts: Toast[];
  loadInitial: () => Promise<void>;
  saveProfile: (input: ConnectionProfileInput & { id?: string }) => Promise<void>;
  removeProfile: (id: string) => Promise<void>;
  selectProfile: (id: string) => Promise<void>;
  selectBucket: (bucket: string) => Promise<void>;
  openPrefix: (prefix: string) => Promise<void>;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  selectKey: (key: string, multi: boolean) => void;
  clearSelection: () => void;
  createFolder: (name: string) => Promise<void>;
  renameSelected: (nextName: string) => Promise<void>;
  deleteSelected: () => Promise<void>;
  uploadFiles: (paths: string[]) => Promise<void>;
  chooseUploadFiles: () => Promise<void>;
  chooseUploadFolder: () => Promise<void>;
  selectedIncludesFolder: () => boolean;
  downloadSelected: (options?: { confirmFolders?: boolean }) => Promise<boolean>;
  previewObject: (key: string) => Promise<void>;
  closePreview: () => void;
  presignSelected: () => Promise<string | undefined>;
  copyUrlSelected: () => Promise<string | undefined>;
  setSearch: (search: string) => void;
  updateTransfer: (item: TransferItem) => void;
  abortTransfer: (id: string) => Promise<void>;
  saveSettings: (settings: AppSettings) => Promise<void>;
  toast: (type: Toast['type'], message: string) => void;
  dismissToast: (id: string) => void;
}

const defaultSettings: AppSettings = { theme: 'system', autoRefreshSeconds: 30, parallelTransfers: 4 };
const makeToastId = (): string => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const mergeTransfers = (incoming: TransferItem[], current: TransferItem[]): TransferItem[] => {
  const byId = new Map<string, TransferItem>();
  for (const item of [...current, ...incoming]) {
    byId.set(item.id, item);
  }
  return [...byId.values()].sort((a, b) => (b.startedAt ?? b.id).localeCompare(a.startedAt ?? a.id));
};

export const useAppStore = create<AppState>((set, get) => ({
  profiles: [],
  buckets: [],
  prefix: '',
  objects: [],
  folders: [],
  selectedKeys: [],
  loading: false,
  search: '',
  transfers: [],
  settings: defaultSettings,
  toasts: [],
  loadInitial: async () => {
    const [profiles, settings, transfers] = await Promise.all([
      unwrap(window.s3Browser.profiles.list()),
      unwrap(window.s3Browser.settings.get()),
      unwrap(window.s3Browser.transfers.list())
    ]);
    set({ profiles, settings, transfers, selectedProfileId: profiles[0]?.id });
    if (profiles[0]) {
      await get().selectProfile(profiles[0].id);
    }
  },
  saveProfile: async (input) => {
    const profile = await unwrap(window.s3Browser.profiles.save(input));
    const profiles = await unwrap(window.s3Browser.profiles.list());
    set({ profiles, selectedProfileId: profile.id });
    get().toast('success', 'Connection profile saved.');
    await get().selectProfile(profile.id);
  },
  removeProfile: async (id) => {
    await unwrap(window.s3Browser.profiles.remove(id));
    const profiles = await unwrap(window.s3Browser.profiles.list());
    set({ profiles, selectedProfileId: profiles[0]?.id, buckets: [], bucket: undefined, objects: [], folders: [] });
  },
  selectProfile: async (id) => {
    set({ selectedProfileId: id, loading: true, bucket: undefined, objects: [], folders: [], selectedKeys: [] });
    try {
      const profile = get().profiles.find((item) => item.id === id);
      let buckets: BucketSummary[] = [];
      try {
        buckets = await unwrap(window.s3Browser.s3.listBuckets(id));
      } catch (error) {
        if (!profile?.bucket) {
          throw error;
        }
        buckets = [{ name: profile.bucket }];
        get().toast('info', 'This connection cannot list all buckets, so the saved bucket was opened directly.');
      }
      const savedBucket = profile?.bucket;
      set({ buckets, bucket: savedBucket && buckets.some((b) => b.name === savedBucket) ? savedBucket : undefined });
      if (savedBucket) {
        await get().selectBucket(savedBucket);
      }
    } finally {
      set({ loading: false });
    }
  },
  selectBucket: async (bucket) => {
    set({ bucket, prefix: '', continuationToken: undefined, selectedKeys: [] });
    await get().refresh();
  },
  openPrefix: async (prefix) => {
    set({ prefix, continuationToken: undefined, selectedKeys: [] });
    await get().refresh();
  },
  refresh: async () => {
    const { selectedProfileId, bucket, prefix } = get();
    if (!selectedProfileId || !bucket) {
      return;
    }
    set({ loading: true });
    try {
      const response = await unwrap(window.s3Browser.s3.listObjects({ profileId: selectedProfileId, bucket, prefix, maxKeys: 1000 }));
      const stats = await unwrap(window.s3Browser.s3.stats(selectedProfileId, bucket, prefix));
      set({
        folders: response.prefixes,
        objects: response.objects,
        continuationToken: response.nextContinuationToken,
        stats,
        selectedKeys: []
      });
    } finally {
      set({ loading: false });
    }
  },
  loadMore: async () => {
    const { selectedProfileId, bucket, prefix, continuationToken, objects, folders } = get();
    if (!selectedProfileId || !bucket || !continuationToken) {
      return;
    }
    const response: ListObjectsResponse = await unwrap(
      window.s3Browser.s3.listObjects({ profileId: selectedProfileId, bucket, prefix, continuationToken, maxKeys: 1000 })
    );
    set({
      folders: [...folders, ...response.prefixes],
      objects: [...objects, ...response.objects],
      continuationToken: response.nextContinuationToken
    });
  },
  selectKey: (key, multi) => {
    const selected = get().selectedKeys;
    set({ selectedKeys: multi ? (selected.includes(key) ? selected.filter((item) => item !== key) : [...selected, key]) : [key] });
  },
  clearSelection: () => set({ selectedKeys: [] }),
  createFolder: async (name) => {
    const { selectedProfileId, bucket, prefix } = get();
    if (!selectedProfileId || !bucket || !name.trim()) {
      return;
    }
    await unwrap(window.s3Browser.s3.createFolder(selectedProfileId, bucket, `${prefix}${name.trim()}/`));
    get().toast('success', 'Folder created.');
    await get().refresh();
  },
  renameSelected: async (nextName) => {
    const { selectedProfileId, bucket, prefix, selectedKeys, folders } = get();
    if (!selectedProfileId || !bucket || selectedKeys.length !== 1 || !nextName.trim()) {
      return;
    }
    const sourceKey = selectedKeys[0];
    const isFolder = folders.some((item) => item.key === sourceKey);
    await unwrap(
      window.s3Browser.s3.rename({
        profileId: selectedProfileId,
        bucket,
        sourceKey,
        destinationKey: `${prefix}${nextName.trim()}${isFolder ? '/' : ''}`,
        isFolder
      })
    );
    get().toast('success', 'Item renamed.');
    await get().refresh();
  },
  deleteSelected: async () => {
    const { selectedProfileId, bucket, selectedKeys } = get();
    if (!selectedProfileId || !bucket || selectedKeys.length === 0) {
      return;
    }
    await unwrap(window.s3Browser.s3.delete({ profileId: selectedProfileId, bucket, keys: selectedKeys }));
    get().toast('success', `${selectedKeys.length} item(s) deleted.`);
    await get().refresh();
  },
  uploadFiles: async (paths) => {
    const { selectedProfileId, bucket, prefix } = get();
    if (!selectedProfileId || !bucket || paths.length === 0) {
      return;
    }
    const transfers = await unwrap(window.s3Browser.transfers.upload({ profileId: selectedProfileId, bucket, localPaths: paths, destinationPrefix: prefix }));
    set({ transfers: mergeTransfers(transfers, get().transfers) });
    get().toast('info', `${transfers.length} upload(s) queued.`);
  },
  chooseUploadFiles: async () => {
    const paths = await unwrap(window.s3Browser.transfers.chooseFiles());
    await get().uploadFiles(paths);
  },
  chooseUploadFolder: async () => {
    const directory = await unwrap(window.s3Browser.transfers.chooseDirectory());
    if (directory) {
      await get().uploadFiles([directory]);
    }
  },
  selectedIncludesFolder: () => {
    const { folders, selectedKeys } = get();
    return folders.some((folder) => selectedKeys.includes(folder.key));
  },
  downloadSelected: async (options = {}) => {
    const { selectedProfileId, bucket, selectedKeys } = get();
    if (!selectedProfileId || !bucket || selectedKeys.length === 0) {
      return false;
    }
    if (get().selectedIncludesFolder() && !options.confirmFolders) {
      return false;
    }
    const directory = await unwrap(window.s3Browser.transfers.chooseDirectory());
    if (!directory) {
      return false;
    }
    const transfers = await unwrap(window.s3Browser.transfers.download({ profileId: selectedProfileId, bucket, keys: selectedKeys, destinationDirectory: directory }));
    set({ transfers: mergeTransfers(transfers, get().transfers) });
    return true;
  },
  previewObject: async (key) => {
    const { selectedProfileId, bucket } = get();
    if (!selectedProfileId || !bucket) {
      return;
    }
    set({ preview: await unwrap(window.s3Browser.s3.preview({ profileId: selectedProfileId, bucket, key })) });
  },
  closePreview: () => set({ preview: undefined }),
  presignSelected: async () => {
    const { selectedProfileId, bucket, selectedKeys } = get();
    if (!selectedProfileId || !bucket || selectedKeys.length !== 1) {
      return undefined;
    }
    const url = await unwrap(window.s3Browser.s3.presign({ profileId: selectedProfileId, bucket, key: selectedKeys[0], expiresInSeconds: 3600 }));
    await navigator.clipboard.writeText(url);
    get().toast('success', 'Pre-signed URL copied.');
    return url;
  },
  copyUrlSelected: async () => {
    const { selectedProfileId, bucket, selectedKeys } = get();
    if (!selectedProfileId || !bucket || selectedKeys.length !== 1) {
      return undefined;
    }
    const url = await unwrap(window.s3Browser.s3.copyUrl(selectedProfileId, bucket, selectedKeys[0]));
    await navigator.clipboard.writeText(url);
    get().toast('success', 'Object URL copied.');
    return url;
  },
  setSearch: (search) => set({ search }),
  updateTransfer: (item) => {
    set({ transfers: mergeTransfers([item], get().transfers) });
    if (item.status === 'failed' && item.error) {
      get().toast('error', item.error);
    }
  },
  abortTransfer: async (id) => {
    await unwrap(window.s3Browser.transfers.abort(id));
  },
  saveSettings: async (settings) => {
    set({ settings: await unwrap(window.s3Browser.settings.set(settings)) });
  },
  toast: (type, message) => {
    const id = makeToastId();
    set({ toasts: [...get().toasts, { id, type, message }] });
    window.setTimeout(() => get().dismissToast(id), 4500);
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((toast) => toast.id !== id) })
}));
