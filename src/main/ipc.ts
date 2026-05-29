import { app, dialog, ipcMain, shell } from 'electron';
import type { BrowserWindow } from 'electron';
import { wrapIpc } from './utils/errors.js';
import type { ProfileStore } from './services/profile-store.js';
import type { S3Service } from './services/s3-service.js';
import type { TransferManager } from './services/transfer-manager.js';
import type { SettingsStore } from './services/settings-store.js';
import type {
  ConnectionProfileInput,
  DeleteRequest,
  DownloadRequest,
  FolderSyncRequest,
  ListObjectsRequest,
  PresignRequest,
  PreviewRequest,
  RenameRequest,
  UploadRequest
} from '../shared/types.js';

export interface IpcContext {
  profiles: ProfileStore;
  s3: S3Service;
  transfers: TransferManager;
  settings: SettingsStore;
  getWindow: () => BrowserWindow | undefined;
}

export const registerIpc = (context: IpcContext): void => {
  ipcMain.handle('profiles:list', async () => await wrapIpc(async () => await context.profiles.list()));
  ipcMain.handle('profiles:save', async (_event, input: ConnectionProfileInput & { id?: string }) => await wrapIpc(async () => await context.profiles.save(input)));
  ipcMain.handle('profiles:remove', async (_event, id: string) => await wrapIpc(async () => await context.profiles.remove(id)));
  ipcMain.handle('profiles:reveal', async (_event, id: string) => await wrapIpc(async () => await context.profiles.reveal(id)));
  ipcMain.handle('profiles:import', async (_event, filePath?: string) => await wrapIpc(async () => {
    const selected = filePath ?? (await dialog.showOpenDialog(context.getWindow()!, { properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }] })).filePaths[0];
    return selected ? await context.profiles.importFrom(selected) : [];
  }));
  ipcMain.handle('profiles:export', async (_event, filePath?: string) => await wrapIpc(async () => {
    const selected =
      filePath ??
      (await dialog.showSaveDialog(context.getWindow()!, { defaultPath: 's3-profiles.json', filters: [{ name: 'JSON', extensions: ['json'] }] })).filePath;
    return selected ? await context.profiles.exportTo(selected) : false;
  }));

  ipcMain.handle('s3:test', async (_event, profileId: string) => await wrapIpc(async () => await context.s3.testConnection(await context.profiles.reveal(profileId))));
  ipcMain.handle('s3:listBuckets', async (_event, profileId: string) => await wrapIpc(async () => {
    const profile = await context.profiles.reveal(profileId);
    await context.profiles.touch(profileId);
    return await context.s3.listBuckets(profile);
  }));
  ipcMain.handle('s3:listObjects', async (_event, request: ListObjectsRequest) => await wrapIpc(async () => await context.s3.listObjects(await context.profiles.reveal(request.profileId), request)));
  ipcMain.handle('s3:createFolder', async (_event, profileId: string, bucket: string, key: string) => await wrapIpc(async () => await context.s3.createFolder(await context.profiles.reveal(profileId), bucket, key)));
  ipcMain.handle('s3:rename', async (_event, request: RenameRequest) => await wrapIpc(async () => {
    await context.s3.rename(await context.profiles.reveal(request.profileId), request.bucket, request.sourceKey, request.destinationKey, request.isFolder);
    return true;
  }));
  ipcMain.handle('s3:delete', async (_event, request: DeleteRequest) => await wrapIpc(async () => {
    await context.s3.deleteObjects(await context.profiles.reveal(request.profileId), request.bucket, request.keys);
    return true;
  }));
  ipcMain.handle('s3:metadata', async (_event, profileId: string, bucket: string, key: string) => await wrapIpc(async () => await context.s3.head(await context.profiles.reveal(profileId), bucket, key)));
  ipcMain.handle('s3:presign', async (_event, request: PresignRequest) => await wrapIpc(async () => await context.s3.presign(await context.profiles.reveal(request.profileId), request.bucket, request.key, request.expiresInSeconds)));
  ipcMain.handle('s3:preview', async (_event, request: PreviewRequest) => await wrapIpc(async () => await context.s3.preview(await context.profiles.reveal(request.profileId), request.bucket, request.key)));
  ipcMain.handle('s3:stats', async (_event, profileId: string, bucket: string, prefix: string) => await wrapIpc(async () => await context.s3.stats(await context.profiles.reveal(profileId), bucket, prefix)));
  ipcMain.handle('s3:copyUrl', async (_event, profileId: string, bucket: string, key: string) => await wrapIpc(async () => await context.s3.objectUrl(await context.profiles.reveal(profileId), bucket, key)));

  ipcMain.handle('transfers:upload', async (_event, request: UploadRequest) => await wrapIpc(async () => await context.transfers.upload(request)));
  ipcMain.handle('transfers:download', async (_event, request: DownloadRequest) => await wrapIpc(async () => await context.transfers.download(request)));
  ipcMain.handle('transfers:sync', async (_event, request: FolderSyncRequest) => await wrapIpc(async () => await context.transfers.sync(request)));
  ipcMain.handle('transfers:list', async () => await wrapIpc(async () => await context.transfers.list()));
  ipcMain.handle('transfers:abort', async (_event, id: string) => await wrapIpc(async () => await context.transfers.abort(id)));
  ipcMain.handle('transfers:chooseFiles', async () => await wrapIpc(async () => (await dialog.showOpenDialog(context.getWindow()!, { properties: ['openFile', 'multiSelections'] })).filePaths));
  ipcMain.handle('transfers:chooseDirectory', async () => await wrapIpc(async () => (await dialog.showOpenDialog(context.getWindow()!, { properties: ['openDirectory'] })).filePaths[0]));

  ipcMain.handle('settings:get', async () => await wrapIpc(async () => await context.settings.get()));
  ipcMain.handle('settings:set', async (_event, settings) => await wrapIpc(async () => {
    const saved = await context.settings.set(settings);
    context.transfers.setParallelism(saved.parallelTransfers);
    return saved;
  }));
  ipcMain.handle('app:version', async () => await wrapIpc(async () => app.getVersion()));
  ipcMain.handle('app:openExternal', async (_event, url: string) => await wrapIpc(async () => {
    await shell.openExternal(url);
    return true;
  }));
};
