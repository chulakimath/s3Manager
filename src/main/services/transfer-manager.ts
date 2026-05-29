import type { BrowserWindow } from 'electron';
import { mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import pLimit from 'p-limit';
import { v4 as uuid } from 'uuid';
import type { ConnectionProfile } from '../../shared/types.js';
import type { DownloadRequest, FolderSyncRequest, TransferItem, UploadRequest } from '../../shared/types.js';
import { normalizePrefix, sanitizeObjectKey } from '../utils/path-security.js';
import type { ProfileStore } from './profile-store.js';
import type { S3Service } from './s3-service.js';

interface TransferTask {
  item: TransferItem;
  run: (signal: AbortSignal) => Promise<void>;
  controller: AbortController;
}

export class TransferManager {
  private readonly items = new Map<string, TransferItem>();
  private readonly tasks = new Map<string, TransferTask>();
  private limit = pLimit(4);

  public constructor(
    private readonly profiles: ProfileStore,
    private readonly s3: S3Service,
    private readonly getWindow: () => BrowserWindow | undefined
  ) {}

  public setParallelism(count: number): void {
    this.limit = pLimit(Math.max(1, Math.min(12, count)));
  }

  public async list(): Promise<TransferItem[]> {
    return [...this.items.values()].sort((a, b) => b.id.localeCompare(a.id));
  }

  public async upload(request: UploadRequest): Promise<TransferItem[]> {
    const profile = await this.profiles.reveal(request.profileId);
    const files = await this.expandLocalFiles(request.localPaths);
    const created = files.map((file) => {
      const key = `${normalizePrefix(request.destinationPrefix)}${file.relative.split(path.sep).join('/')}`;
      return this.createItem(profile, request.bucket, 'upload', file.absolute, key, key, file.size, async (signal, item) => {
        await this.s3.uploadFile(profile, request.bucket, file.absolute, item.key, signal, async (progress) => {
          this.patch(item.id, { bytesTransferred: progress.transferred, bytesTotal: progress.total });
        });
      });
    });
    this.enqueue(created);
    return created.map((task) => task.item);
  }

  public async download(request: DownloadRequest): Promise<TransferItem[]> {
    const profile = await this.profiles.reveal(request.profileId);
    await mkdir(request.destinationDirectory, { recursive: true });
    const created = request.keys.map((rawKey) => {
      const key = sanitizeObjectKey(rawKey, true);
      return this.createItem(profile, request.bucket, 'download', key, request.destinationDirectory, key, 0, async (signal, item) => {
        if (key.endsWith('/')) {
          await this.downloadPrefix(profile, request.bucket, key, request.destinationDirectory, signal, item.id);
          return;
        }
        await this.s3.downloadFile(profile, request.bucket, key, request.destinationDirectory, signal, async (progress) => {
          this.patch(item.id, { bytesTransferred: progress.transferred, bytesTotal: progress.total });
        });
      });
    });
    this.enqueue(created);
    return created.map((task) => task.item);
  }

  public async sync(request: FolderSyncRequest): Promise<TransferItem[]> {
    const uploads = await this.upload({
      profileId: request.profileId,
      bucket: request.bucket,
      localPaths: [request.localDirectory],
      destinationPrefix: request.remotePrefix
    });
    return uploads.map((item) => ({ ...item, direction: 'sync' }));
  }

  public async abort(id: string): Promise<boolean> {
    const task = this.tasks.get(id);
    if (!task) {
      return false;
    }
    task.controller.abort();
    this.patch(id, { status: 'aborted', completedAt: new Date().toISOString() });
    return true;
  }

  private createItem(
    profile: ConnectionProfile,
    bucket: string,
    direction: TransferItem['direction'],
    source: string,
    destination: string,
    key: string,
    bytesTotal: number,
    run: (signal: AbortSignal, item: TransferItem) => Promise<void>
  ): TransferTask {
    const item: TransferItem = {
      id: uuid(),
      profileId: profile.id,
      bucket,
      direction,
      source,
      destination,
      key,
      bytesTotal,
      bytesTransferred: 0,
      status: 'queued'
    };
    this.items.set(item.id, item);
    const controller = new AbortController();
    return {
      item,
      controller,
      run: async (signal) => await run(signal, item)
    };
  }

  private enqueue(tasks: TransferTask[]): void {
    for (const task of tasks) {
      this.tasks.set(task.item.id, task);
      void this.limit(async () => {
        if (task.controller.signal.aborted) {
          return;
        }
        this.patch(task.item.id, { status: 'running', startedAt: new Date().toISOString() });
        try {
          await task.run(task.controller.signal);
          this.patch(task.item.id, { status: 'completed', completedAt: new Date().toISOString(), bytesTransferred: this.items.get(task.item.id)?.bytesTotal ?? task.item.bytesTotal });
        } catch (error) {
          if (task.controller.signal.aborted) {
            this.patch(task.item.id, { status: 'aborted', completedAt: new Date().toISOString() });
          } else {
            this.patch(task.item.id, { status: 'failed', completedAt: new Date().toISOString(), error: error instanceof Error ? error.message : String(error) });
          }
        }
      });
    }
  }

  private patch(id: string, patch: Partial<TransferItem>): void {
    const current = this.items.get(id);
    if (!current) {
      return;
    }
    const next = { ...current, ...patch };
    this.items.set(id, next);
    this.getWindow()?.webContents.send('transfer:update', next);
  }

  private async expandLocalFiles(paths: string[]): Promise<Array<{ absolute: string; relative: string; size: number }>> {
    const files: Array<{ absolute: string; relative: string; size: number }> = [];
    for (const itemPath of paths) {
      const itemStat = await stat(itemPath);
      if (itemStat.isDirectory()) {
        const base = path.dirname(itemPath);
        await this.walk(itemPath, base, files);
      } else {
        files.push({ absolute: itemPath, relative: path.basename(itemPath), size: itemStat.size });
      }
    }
    return files;
  }

  private async walk(directory: string, base: string, files: Array<{ absolute: string; relative: string; size: number }>): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await this.walk(absolute, base, files);
      } else if (entry.isFile()) {
        const info = await stat(absolute);
        files.push({ absolute, relative: path.relative(base, absolute), size: info.size });
      }
    }
  }

  private async downloadPrefix(
    profile: ConnectionProfile,
    bucket: string,
    prefix: string,
    destinationDirectory: string,
    signal: AbortSignal,
    transferId: string
  ): Promise<void> {
    let token: string | undefined;
    let completedBytes = 0;
    do {
      const page = await this.s3.listObjects(profile, { profileId: profile.id, bucket, prefix, continuationToken: token });
      for (const object of page.objects) {
        if (signal.aborted) {
          return;
        }
        const targetDirectory = path.join(destinationDirectory, path.dirname(object.key.slice(prefix.length)));
        await mkdir(targetDirectory, { recursive: true });
        await this.s3.downloadFile(profile, bucket, object.key, targetDirectory, signal, async (progress) => {
          this.patch(transferId, { bytesTransferred: completedBytes + progress.transferred, bytesTotal: completedBytes + progress.total });
        });
        completedBytes += object.size;
      }
      token = page.nextContinuationToken;
    } while (token);
  }
}
