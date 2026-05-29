import { contextBridge, ipcRenderer } from 'electron';
import type { ElectronApi } from '../shared/ipc.js';

const invoke = async <T,>(channel: string, ...args: unknown[]): Promise<T> => await ipcRenderer.invoke(channel, ...args);

const api: ElectronApi = {
  profiles: {
    list: async () => await invoke('profiles:list'),
    save: async (input) => await invoke('profiles:save', input),
    remove: async (id) => await invoke('profiles:remove', id),
    revealSecret: async (id) => await invoke('profiles:reveal', id),
    import: async (filePath) => await invoke('profiles:import', filePath),
    export: async (filePath) => await invoke('profiles:export', filePath)
  },
  s3: {
    test: async (profileId) => await invoke('s3:test', profileId),
    listBuckets: async (profileId) => await invoke('s3:listBuckets', profileId),
    listObjects: async (request) => await invoke('s3:listObjects', request),
    createFolder: async (profileId, bucket, key) => await invoke('s3:createFolder', profileId, bucket, key),
    rename: async (request) => await invoke('s3:rename', request),
    delete: async (request) => await invoke('s3:delete', request),
    metadata: async (profileId, bucket, key) => await invoke('s3:metadata', profileId, bucket, key),
    presign: async (request) => await invoke('s3:presign', request),
    preview: async (request) => await invoke('s3:preview', request),
    stats: async (profileId, bucket, prefix) => await invoke('s3:stats', profileId, bucket, prefix),
    copyUrl: async (profileId, bucket, key) => await invoke('s3:copyUrl', profileId, bucket, key)
  },
  transfers: {
    upload: async (request) => await invoke('transfers:upload', request),
    download: async (request) => await invoke('transfers:download', request),
    sync: async (request) => await invoke('transfers:sync', request),
    list: async () => await invoke('transfers:list'),
    abort: async (id) => await invoke('transfers:abort', id),
    chooseFiles: async () => await invoke('transfers:chooseFiles'),
    chooseDirectory: async () => await invoke('transfers:chooseDirectory')
  },
  settings: {
    get: async () => await invoke('settings:get'),
    set: async (settings) => await invoke('settings:set', settings)
  },
  app: {
    getVersion: async () => await invoke('app:version'),
    openExternal: async (url) => await invoke('app:openExternal', url)
  },
  events: {
    onTransfer: (handler) => {
      const listener = (_event: Electron.IpcRendererEvent, item: Parameters<typeof handler>[0]) => handler(item);
      ipcRenderer.on('transfer:update', listener);
      return () => ipcRenderer.off('transfer:update', listener);
    },
    onMenuCommand: (handler) => {
      const listener = (_event: Electron.IpcRendererEvent, command: string) => handler(command);
      ipcRenderer.on('menu:command', listener);
      return () => ipcRenderer.off('menu:command', listener);
    }
  }
};

contextBridge.exposeInMainWorld('s3Browser', api);
