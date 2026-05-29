import Store from 'electron-store';
import type { AppSettings } from '../../shared/types.js';

const defaults: AppSettings = {
  theme: 'system',
  autoRefreshSeconds: 30,
  parallelTransfers: 4
};

export class SettingsStore {
  private readonly store = new Store<{ settings: AppSettings }>({
    name: 'settings',
    defaults: { settings: defaults }
  });

  public async get(): Promise<AppSettings> {
    return this.store.get('settings', defaults);
  }

  public async set(settings: AppSettings): Promise<AppSettings> {
    const normalized: AppSettings = {
      theme: settings.theme,
      autoRefreshSeconds: Math.max(0, Math.min(3600, settings.autoRefreshSeconds)),
      parallelTransfers: Math.max(1, Math.min(12, settings.parallelTransfers))
    };
    this.store.set('settings', normalized);
    return normalized;
  }
}
