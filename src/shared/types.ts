export type S3Provider = 'aws' | 'cloudflare-r2' | 'minio' | 'wasabi' | 'digitalocean-spaces' | 'custom';

export interface ConnectionProfileInput {
  name: string;
  provider: S3Provider;
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
  endpoint?: string;
  bucket?: string;
  forcePathStyle: boolean;
}

export interface ConnectionProfile extends ConnectionProfileInput {
  id: string;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
}

export interface SafeConnectionProfile extends Omit<ConnectionProfile, 'secretAccessKey'> {
  secretAccessKey: '********';
}

export interface BucketSummary {
  name: string;
  creationDate?: string;
}

export interface ObjectEntry {
  key: string;
  name: string;
  prefix: string;
  isFolder: boolean;
  size: number;
  lastModified?: string;
  storageClass?: string;
  etag?: string;
  contentType?: string;
}

export interface ListObjectsRequest {
  profileId: string;
  bucket: string;
  prefix: string;
  continuationToken?: string;
  maxKeys?: number;
}

export interface ListObjectsResponse {
  objects: ObjectEntry[];
  prefixes: ObjectEntry[];
  nextContinuationToken?: string;
  isTruncated: boolean;
}

export interface BucketStats {
  objectCount: number;
  totalBytes: number;
  folderCount: number;
  sampled: boolean;
}

export type TransferDirection = 'upload' | 'download' | 'sync';
export type TransferStatus = 'queued' | 'running' | 'completed' | 'failed' | 'aborted';

export interface TransferItem {
  id: string;
  profileId: string;
  bucket: string;
  direction: TransferDirection;
  source: string;
  destination: string;
  key: string;
  bytesTotal: number;
  bytesTransferred: number;
  status: TransferStatus;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface UploadRequest {
  profileId: string;
  bucket: string;
  localPaths: string[];
  destinationPrefix: string;
}

export interface DownloadRequest {
  profileId: string;
  bucket: string;
  keys: string[];
  destinationDirectory: string;
}

export interface RenameRequest {
  profileId: string;
  bucket: string;
  sourceKey: string;
  destinationKey: string;
  isFolder: boolean;
}

export interface DeleteRequest {
  profileId: string;
  bucket: string;
  keys: string[];
}

export interface PresignRequest {
  profileId: string;
  bucket: string;
  key: string;
  expiresInSeconds: number;
}

export interface PreviewRequest {
  profileId: string;
  bucket: string;
  key: string;
}

export interface FilePreview {
  key: string;
  kind: 'image' | 'text' | 'json' | 'pdf' | 'unsupported';
  contentType?: string;
  dataUrl?: string;
  text?: string;
  metadata: Record<string, string>;
}

export interface FolderSyncRequest {
  profileId: string;
  bucket: string;
  localDirectory: string;
  remotePrefix: string;
  deleteRemoteExtraneous: boolean;
}

export interface AppSettings {
  theme: 'dark' | 'light' | 'system';
  autoRefreshSeconds: number;
  parallelTransfers: number;
}

export interface IpcResult<T> {
  ok: true;
  data: T;
}

export interface IpcFailure {
  ok: false;
  error: {
    name: string;
    message: string;
    code?: string;
  };
}

export type IpcResponse<T> = IpcResult<T> | IpcFailure;

export const providerDefaults: Record<S3Provider, Pick<ConnectionProfileInput, 'region' | 'endpoint' | 'forcePathStyle'>> = {
  aws: { region: 'us-east-1', endpoint: undefined, forcePathStyle: false },
  'cloudflare-r2': { region: 'auto', endpoint: 'https://<account-id>.r2.cloudflarestorage.com', forcePathStyle: true },
  minio: { region: 'us-east-1', endpoint: 'http://127.0.0.1:9000', forcePathStyle: true },
  wasabi: { region: 'us-east-1', endpoint: 'https://s3.wasabisys.com', forcePathStyle: false },
  'digitalocean-spaces': { region: 'nyc3', endpoint: 'https://nyc3.digitaloceanspaces.com', forcePathStyle: false },
  custom: { region: 'us-east-1', endpoint: undefined, forcePathStyle: true }
};

export const textPreviewExtensions = new Set([
  '.txt',
  '.md',
  '.csv',
  '.log',
  '.xml',
  '.html',
  '.css',
  '.js',
  '.ts',
  '.tsx',
  '.jsx',
  '.yaml',
  '.yml',
  '.ini',
  '.conf'
]);
