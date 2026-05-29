import { app, safeStorage } from 'electron';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { v4 as uuid } from 'uuid';
import type { ConnectionProfile, ConnectionProfileInput, SafeConnectionProfile } from '../../shared/types.js';
import { AppError } from '../utils/errors.js';

interface StoredVault {
  version: 1;
  encrypted: string;
}

const emptyVault: ConnectionProfile[] = [];

export class ProfileStore {
  private readonly filePath = path.join(app.getPath('userData'), 'profiles.vault.json');

  public async list(): Promise<SafeConnectionProfile[]> {
    return (await this.read()).map(this.safe);
  }

  public async reveal(id: string): Promise<ConnectionProfile> {
    const profile = (await this.read()).find((item) => item.id === id);
    if (!profile) {
      throw new AppError('Connection profile was not found.', 'PROFILE_NOT_FOUND');
    }
    return profile;
  }

  public async save(input: ConnectionProfileInput & { id?: string }): Promise<SafeConnectionProfile> {
    this.validate(input);
    const profiles = await this.read();
    const now = new Date().toISOString();
    const existingIndex = input.id ? profiles.findIndex((item) => item.id === input.id) : -1;
    const profile: ConnectionProfile = {
      id: input.id ?? uuid(),
      name: input.name.trim(),
      provider: input.provider,
      accessKeyId: input.accessKeyId.trim(),
      secretAccessKey: input.secretAccessKey,
      region: input.region.trim(),
      endpoint: input.endpoint?.trim() || undefined,
      bucket: input.bucket?.trim() || undefined,
      forcePathStyle: input.forcePathStyle,
      createdAt: existingIndex >= 0 ? profiles[existingIndex].createdAt : now,
      updatedAt: now,
      lastUsedAt: existingIndex >= 0 ? profiles[existingIndex].lastUsedAt : undefined
    };
    if (existingIndex >= 0) {
      profiles[existingIndex] = profile;
    } else {
      profiles.push(profile);
    }
    await this.write(profiles);
    return this.safe(profile);
  }

  public async touch(id: string): Promise<void> {
    const profiles = await this.read();
    const profile = profiles.find((item) => item.id === id);
    if (profile) {
      profile.lastUsedAt = new Date().toISOString();
      await this.write(profiles);
    }
  }

  public async remove(id: string): Promise<boolean> {
    const profiles = await this.read();
    const next = profiles.filter((item) => item.id !== id);
    await this.write(next);
    return next.length !== profiles.length;
  }

  public async importFrom(filePath: string): Promise<SafeConnectionProfile[]> {
    const raw = await readFile(filePath, 'utf8');
    const imported = JSON.parse(raw) as ConnectionProfileInput[];
    if (!Array.isArray(imported)) {
      throw new AppError('Imported profile file must contain an array.', 'INVALID_IMPORT');
    }
    const saved: SafeConnectionProfile[] = [];
    for (const item of imported) {
      saved.push(await this.save(item));
    }
    return saved;
  }

  public async exportTo(filePath: string): Promise<boolean> {
    const profiles = await this.read();
    await writeFile(filePath, JSON.stringify(profiles, null, 2), 'utf8');
    return true;
  }

  private safe(profile: ConnectionProfile): SafeConnectionProfile {
    return { ...profile, secretAccessKey: '********' };
  }

  private validate(input: ConnectionProfileInput): void {
    if (!input.name.trim()) {
      throw new AppError('Connection name is required.', 'VALIDATION');
    }
    if (!input.accessKeyId.trim()) {
      throw new AppError('Access key is required.', 'VALIDATION');
    }
    if (!input.secretAccessKey) {
      throw new AppError('Secret key is required.', 'VALIDATION');
    }
    if (!input.region.trim()) {
      throw new AppError('Region is required.', 'VALIDATION');
    }
    if (input.endpoint && !/^https?:\/\/.+/i.test(input.endpoint)) {
      throw new AppError('Endpoint URL must start with http:// or https://.', 'VALIDATION');
    }
  }

  private async read(): Promise<ConnectionProfile[]> {
    try {
      const raw = await readFile(this.filePath, 'utf8');
      const vault = JSON.parse(raw) as StoredVault;
      const decrypted = safeStorage.decryptString(Buffer.from(vault.encrypted, 'base64'));
      return JSON.parse(decrypted) as ConnectionProfile[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return emptyVault;
      }
      throw error;
    }
  }

  private async write(profiles: ConnectionProfile[]): Promise<void> {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new AppError('OS credential encryption is not available for this user session.', 'ENCRYPTION_UNAVAILABLE');
    }
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const encrypted = safeStorage.encryptString(JSON.stringify(profiles));
    await writeFile(this.filePath, JSON.stringify({ version: 1, encrypted: encrypted.toString('base64') }), 'utf8');
  }
}
