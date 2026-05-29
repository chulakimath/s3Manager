import type { IpcResponse } from '../../shared/types';

export const unwrap = async <T>(response: Promise<IpcResponse<T>>): Promise<T> => {
  const result = await response;
  if (!result.ok) {
    throw new Error(result.error.message);
  }
  return result.data;
};
