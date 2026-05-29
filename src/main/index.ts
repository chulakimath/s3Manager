import { app, BrowserWindow, Menu, nativeImage, Tray } from 'electron';
app.disableHardwareAcceleration();

app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-dev-shm-usage');
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('in-process-gpu');
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Store from 'electron-store';
import { ApiServer } from './server.js';
import { registerIpc } from './ipc.js';
import { ProfileStore } from './services/profile-store.js';
import { S3Service } from './services/s3-service.js';
import { SettingsStore } from './services/settings-store.js';
import { TransferManager } from './services/transfer-manager.js';
import { logger } from './utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;
const windowStore = new Store<{ bounds?: Electron.Rectangle }>({ name: 'window-state' });

let mainWindow: BrowserWindow | undefined;
let tray: Tray | undefined;
let apiServer: ApiServer | undefined;

const getIconPath = (): string =>
  app.isPackaged ? path.join(process.resourcesPath, 'resources', 'app.png') : path.join(app.getAppPath(), 'resources', 'app.png');

const createWindow = async (): Promise<BrowserWindow> => {
  const savedBounds = windowStore.get('bounds');
  const window = new BrowserWindow({
    width: savedBounds?.width ?? 1320,
    height: savedBounds?.height ?? 860,
    x: savedBounds?.x,
    y: savedBounds?.y,
    minWidth: 980,
    minHeight: 640,
    title: 'S3 Desktop Browser',
    icon: getIconPath(),
    backgroundColor: '#111827',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true
    }
  });
  window.once('ready-to-show', () => window.show());
  window.on('close', () => {
    if (!window.isDestroyed()) {
      windowStore.set('bounds', window.getBounds());
    }
  });
  if (isDev) {
    await window.loadURL('http://127.0.0.1:5173');
    window.webContents.openDevTools({ mode: 'detach' });
  } else {
    await window.loadFile(path.join(__dirname, '..', '..', 'renderer', 'index.html'));
  }
  return window;
};

const createMenu = (): void => {
  const send = (command: string): void => mainWindow?.webContents.send('menu:command', command);
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: 'File',
        submenu: [
          { label: 'New Connection', accelerator: 'CmdOrCtrl+N', click: () => send('new-connection') },
          { label: 'Upload Files', accelerator: 'CmdOrCtrl+U', click: () => send('upload-files') },
          { label: 'Download Selected', accelerator: 'CmdOrCtrl+D', click: () => send('download-selected') },
          { type: 'separator' },
          { role: 'quit' }
        ]
      },
      {
        label: 'Edit',
        submenu: [
          { label: 'Refresh', accelerator: 'F5', click: () => send('refresh') },
          { label: 'Search', accelerator: 'CmdOrCtrl+F', click: () => send('focus-search') },
          { label: 'Delete', accelerator: 'Delete', click: () => send('delete-selected') }
        ]
      },
      {
        label: 'View',
        submenu: [
          { label: 'Toggle Transfers', accelerator: 'CmdOrCtrl+J', click: () => send('toggle-transfers') },
          { role: 'togglefullscreen' },
          { role: 'reload' }
        ]
      }
    ])
  );
};

const createTray = (): void => {
  const icon = nativeImage.createFromPath(getIconPath());
  tray = new Tray(icon);
  tray.setToolTip('S3 Desktop Browser');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Show', click: () => mainWindow?.show() },
      { label: 'Quit', click: () => app.quit() }
    ])
  );
};

void app.whenReady().then(async () => {
  apiServer = new ApiServer();
  await apiServer.start();
  const profiles = new ProfileStore();
  const s3 = new S3Service();
  const settings = new SettingsStore();
  const transfers = new TransferManager(profiles, s3, () => mainWindow);
  transfers.setParallelism((await settings.get()).parallelTransfers);
  registerIpc({ profiles, s3, settings, transfers, getWindow: () => mainWindow });
  createMenu();
  createTray();
  mainWindow = await createWindow();
  await logger.info('Application window created.');
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow().then((window) => {
      mainWindow = window;
    });
  }
});

app.on('before-quit', async () => {
  await apiServer?.stop();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
