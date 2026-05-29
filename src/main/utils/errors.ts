import type { IpcFailure, IpcResponse } from '../../shared/types.js';

export class AppError extends Error {
  public readonly code?: string;

  public constructor(message: string, code?: string) {
    super(message);
    this.name = 'AppError';
    this.code = code;
  }
}

export const toError = (error: unknown): AppError => {
  if (error instanceof AppError) {
    return error;
  }
  if (error instanceof Error) {
    const wrapped = new AppError(error.message, (error as { code?: string }).code);
    wrapped.stack = error.stack;
    return wrapped;
  }
  return new AppError(String(error));
};

export const ok = async <T>(value: T): Promise<IpcResponse<T>> => ({ ok: true, data: value });

export const fail = async (error: unknown): Promise<IpcFailure> => {
  const normalized = toError(error);
  return {
    ok: false,
    error: {
      name: normalized.name,
      message: normalized.message,
      code: normalized.code
    }
  };
};

export const wrapIpc = async <T>(fn: () => Promise<T>): Promise<IpcResponse<T>> => {
  try {
    return await ok(await fn());
  } catch (error) {
    return await fail(error);
  }
};
