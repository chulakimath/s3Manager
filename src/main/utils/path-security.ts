import { AppError } from './errors.js';
import path from 'node:path';

const invalidKeyFragments = ['\\', '\0'];

export const normalizePrefix = (prefix: string): string => {
  const cleaned = prefix.replaceAll('\\', '/').replace(/^\/+/, '');
  const parts = cleaned.split('/').filter((part) => part.length > 0 && part !== '.');
  if (parts.some((part) => part === '..')) {
    throw new AppError('Object keys cannot contain parent traversal segments.', 'INVALID_KEY');
  }
  return parts.length === 0 ? '' : `${parts.join('/')}/`;
};

export const sanitizeObjectKey = (key: string, allowFolder = false): string => {
  if (invalidKeyFragments.some((fragment) => key.includes(fragment))) {
    throw new AppError('Object key contains invalid characters.', 'INVALID_KEY');
  }
  const cleaned = key.replace(/^\/+/, '');
  const parts = cleaned.split('/').filter((part) => part !== '' && part !== '.');
  if (parts.some((part) => part === '..')) {
    throw new AppError('Object key cannot traverse parent folders.', 'INVALID_KEY');
  }
  const joined = parts.join('/');
  if (!joined && !allowFolder) {
    throw new AppError('Object key is required.', 'INVALID_KEY');
  }
  return allowFolder && key.endsWith('/') && joined ? `${joined}/` : joined;
};

export const safeJoin = (baseDirectory: string, relativePath: string): string => {
  const destination = path.resolve(baseDirectory, relativePath);
  const base = path.resolve(baseDirectory);
  if (destination !== base && !destination.startsWith(`${base}${path.sep}`)) {
    throw new AppError('Resolved path leaves the selected directory.', 'PATH_TRAVERSAL');
  }
  return destination;
};

export const fileNameFromKey = (key: string): string => {
  const clean = sanitizeObjectKey(key);
  return path.basename(clean);
};
