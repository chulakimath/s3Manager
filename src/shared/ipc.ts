import type {
  AppSettings,
  BucketStats,
  BucketSummary,
  ConnectionProfile,
  ConnectionProfileInput,
  DeleteRequest,
  DownloadRequest,
  FilePreview,
  FolderSyncRequest,
  IpcResponse,
  ListObjectsRequest,
  ListObjectsResponse,
  ObjectEntry,
  PresignRequest,
  PreviewRequest,
  RenameRequest,
  SafeConnectionProfile,
  TransferItem,
  UploadRequest
} from './types.js';

export interface ElectronApi {
  profiles: {
    list: () => Promise<IpcResponse<SafeConnectionProfile[]>>;
    save: (input: ConnectionProfileInput & { id?: string }) => Promise<IpcResponse<SafeConnectionProfile>>;
    remove: (id: string) => Promise<IpcResponse<boolean>>;
    revealSecret: (id: string) => Promise<IpcResponse<ConnectionProfile>>;
    import: (filePath: string) => Promise<IpcResponse<SafeConnectionProfile[]>>;
    export: (filePath: string) => Promise<IpcResponse<boolean>>;
  };
  s3: {
    test: (profileId: string) => Promise<IpcResponse<boolean>>;
    listBuckets: (profileId: string) => Promise<IpcResponse<BucketSummary[]>>;
    listObjects: (request: ListObjectsRequest) => Promise<IpcResponse<ListObjectsResponse>>;
    createFolder: (profileId: string, bucket: string, key: string) => Promise<IpcResponse<ObjectEntry>>;
    rename: (request: RenameRequest) => Promise<IpcResponse<boolean>>;
    delete: (request: DeleteRequest) => Promise<IpcResponse<boolean>>;
    metadata: (profileId: string, bucket: string, key: string) => Promise<IpcResponse<Record<string, string>>>;
    presign: (request: PresignRequest) => Promise<IpcResponse<string>>;
    preview: (request: PreviewRequest) => Promise<IpcResponse<FilePreview>>;
    stats: (profileId: string, bucket: string, prefix: string) => Promise<IpcResponse<BucketStats>>;
    copyUrl: (profileId: string, bucket: string, key: string) => Promise<IpcResponse<string>>;
  };
  transfers: {
    upload: (request: UploadRequest) => Promise<IpcResponse<TransferItem[]>>;
    download: (request: DownloadRequest) => Promise<IpcResponse<TransferItem[]>>;
    sync: (request: FolderSyncRequest) => Promise<IpcResponse<TransferItem[]>>;
    list: () => Promise<IpcResponse<TransferItem[]>>;
    abort: (id: string) => Promise<IpcResponse<boolean>>;
    chooseFiles: () => Promise<IpcResponse<string[]>>;
    chooseDirectory: () => Promise<IpcResponse<string | undefined>>;
  };
  settings: {
    get: () => Promise<IpcResponse<AppSettings>>;
    set: (settings: AppSettings) => Promise<IpcResponse<AppSettings>>;
  };
  app: {
    getVersion: () => Promise<IpcResponse<string>>;
    openExternal: (url: string) => Promise<IpcResponse<boolean>>;
  };
  events: {
    onTransfer: (handler: (item: TransferItem) => void) => () => void;
    onMenuCommand: (handler: (command: string) => void) => () => void;
  };
}

declare global {
  interface Window {
    s3Browser: ElectronApi;
  }
}
