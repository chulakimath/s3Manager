import {
  CompleteMultipartUploadCommand,
  CopyObjectCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListBucketsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
  AbortMultipartUploadCommand,
  type CompletedPart
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { createReadStream, createWriteStream } from 'node:fs';
import { open, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable, Transform } from 'node:stream';
import mime from 'mime';
import type {
  BucketStats,
  BucketSummary,
  ConnectionProfile,
  FilePreview,
  ListObjectsRequest,
  ListObjectsResponse,
  ObjectEntry
} from '../../shared/types.js';
import { textPreviewExtensions } from '../../shared/types.js';
import { AppError } from '../utils/errors.js';
import { fileNameFromKey, normalizePrefix, safeJoin, sanitizeObjectKey } from '../utils/path-security.js';

export interface TransferProgress {
  transferred: number;
  total: number;
}

const multipartThreshold = 1024 * 1024;
const partSize = 8 * 1024 * 1024;

export class S3Service {
  public createClient(profile: ConnectionProfile): S3Client {
    return new S3Client({
      region: profile.region,
      endpoint: profile.endpoint,
      forcePathStyle: profile.forcePathStyle,
      requestHandler: new NodeHttpHandler({
        connectionTimeout: 15_000,
        socketTimeout: 600_000
      }),
      // Upload retries are handled below with a newly opened file stream.
      maxAttempts: 1,
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
      credentials: {
        accessKeyId: profile.accessKeyId,
        secretAccessKey: profile.secretAccessKey
      }
    });
  }

  public async testConnection(profile: ConnectionProfile): Promise<boolean> {
    const client = this.createClient(profile);
    if (profile.bucket) {
      await client.send(new ListObjectsV2Command({ Bucket: profile.bucket, MaxKeys: 1 }));
      return true;
    }
    await client.send(new ListBucketsCommand({}));
    return true;
  }

  public async listBuckets(profile: ConnectionProfile): Promise<BucketSummary[]> {
    const client = this.createClient(profile);
    const response = await client.send(new ListBucketsCommand({}));
    return (response.Buckets ?? []).map((bucket) => ({
      name: bucket.Name ?? '',
      creationDate: bucket.CreationDate?.toISOString()
    }));
  }

  public async listObjects(profile: ConnectionProfile, request: ListObjectsRequest): Promise<ListObjectsResponse> {
    const client = this.createClient(profile);
    const prefix = normalizePrefix(request.prefix);
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: request.bucket,
        Prefix: prefix,
        Delimiter: '/',
        ContinuationToken: request.continuationToken,
        MaxKeys: request.maxKeys ?? 1000
      })
    );
    const prefixes: ObjectEntry[] = (response.CommonPrefixes ?? []).map((item) => {
      const key = item.Prefix ?? '';
      return {
        key,
        name: key.replace(prefix, '').replace(/\/$/, ''),
        prefix,
        isFolder: true,
        size: 0
      };
    });
    const objects: ObjectEntry[] = (response.Contents ?? [])
      .filter((item) => item.Key && item.Key !== prefix)
      .map((item) => this.toEntry(item.Key ?? '', prefix, false, item.Size ?? 0, item.LastModified, item.StorageClass, item.ETag));
    return {
      objects,
      prefixes,
      nextContinuationToken: response.NextContinuationToken,
      isTruncated: Boolean(response.IsTruncated)
    };
  }

  public async createFolder(profile: ConnectionProfile, bucket: string, key: string): Promise<ObjectEntry> {
    const client = this.createClient(profile);
    const folderKey = sanitizeObjectKey(key, true).replace(/\/?$/, '/');
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: folderKey, Body: '' }));
    return this.toEntry(folderKey, path.posix.dirname(folderKey).replace('.', ''), true, 0);
  }

  public async deleteObjects(profile: ConnectionProfile, bucket: string, keys: string[]): Promise<void> {
    const client = this.createClient(profile);
    for (const rawKey of keys) {
      const key = sanitizeObjectKey(rawKey, true);
      if (key.endsWith('/')) {
        await this.deletePrefix(client, bucket, key);
      } else {
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      }
    }
  }

  public async rename(profile: ConnectionProfile, bucket: string, sourceKey: string, destinationKey: string, isFolder: boolean): Promise<void> {
    const client = this.createClient(profile);
    const source = sanitizeObjectKey(sourceKey, true);
    const destination = sanitizeObjectKey(destinationKey, true);
    if (isFolder) {
      const folderSource = source.endsWith('/') ? source : `${source}/`;
      const folderDestination = destination.endsWith('/') ? destination : `${destination}/`;
      let token: string | undefined;
      do {
        const page = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: folderSource, ContinuationToken: token }));
        for (const object of page.Contents ?? []) {
          if (!object.Key) {
            continue;
          }
          const nextKey = `${folderDestination}${object.Key.slice(folderSource.length)}`;
          await this.copyThenDelete(client, bucket, object.Key, nextKey);
        }
        token = page.NextContinuationToken;
      } while (token);
    } else {
      await this.copyThenDelete(client, bucket, source, destination);
    }
  }

  public async head(profile: ConnectionProfile, bucket: string, key: string): Promise<Record<string, string>> {
    const client = this.createClient(profile);
    const response = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: sanitizeObjectKey(key) }));
    return {
      contentType: response.ContentType ?? '',
      contentLength: String(response.ContentLength ?? 0),
      etag: response.ETag ?? '',
      lastModified: response.LastModified?.toISOString() ?? '',
      storageClass: response.StorageClass ?? '',
      metadata: JSON.stringify(response.Metadata ?? {})
    };
  }

  public async presign(profile: ConnectionProfile, bucket: string, key: string, expiresInSeconds: number): Promise<string> {
    const client = this.createClient(profile);
    return await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: bucket, Key: sanitizeObjectKey(key) }),
      { expiresIn: Math.max(60, Math.min(604800, expiresInSeconds)) }
    );
  }

  public objectUrl(profile: ConnectionProfile, bucket: string, key: string): string {
    const encodedKey = sanitizeObjectKey(key)
      .split('/')
      .map((part) => encodeURIComponent(part))
      .join('/');
    if (profile.endpoint) {
      const endpoint = profile.endpoint.replace(/\/$/, '');
      return profile.forcePathStyle ? `${endpoint}/${bucket}/${encodedKey}` : `${endpoint.replace('://', `://${bucket}.`)}/${encodedKey}`;
    }
    return `https://${bucket}.s3.${profile.region}.amazonaws.com/${encodedKey}`;
  }

  public async preview(profile: ConnectionProfile, bucket: string, key: string): Promise<FilePreview> {
    const metadata = await this.head(profile, bucket, key);
    const contentType = metadata.contentType || mime.getType(key) || undefined;
    const client = this.createClient(profile);
    const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: sanitizeObjectKey(key) }));
    const body = await response.Body?.transformToByteArray();
    if (!body) {
      throw new AppError('Object response did not contain a readable body.', 'EMPTY_BODY');
    }
    const extension = path.extname(key).toLowerCase();
    const buffer = Buffer.from(body);
    if (contentType?.startsWith('image/')) {
      return { key, kind: 'image', contentType, dataUrl: `data:${contentType};base64,${buffer.toString('base64')}`, metadata };
    }
    if (contentType === 'application/pdf' || extension === '.pdf') {
      return { key, kind: 'pdf', contentType: 'application/pdf', dataUrl: `data:application/pdf;base64,${buffer.toString('base64')}`, metadata };
    }
    if (contentType === 'application/json' || extension === '.json') {
      return { key, kind: 'json', contentType, text: JSON.stringify(JSON.parse(buffer.toString('utf8')), null, 2), metadata };
    }
    if (contentType?.startsWith('text/') || textPreviewExtensions.has(extension)) {
      return { key, kind: 'text', contentType, text: buffer.toString('utf8'), metadata };
    }
    return { key, kind: 'unsupported', contentType, metadata };
  }

  public async stats(profile: ConnectionProfile, bucket: string, prefix: string): Promise<BucketStats> {
    const client = this.createClient(profile);
    let token: string | undefined;
    let objectCount = 0;
    let folderCount = 0;
    let totalBytes = 0;
    let pages = 0;
    do {
      const response = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: normalizePrefix(prefix), ContinuationToken: token }));
      for (const item of response.Contents ?? []) {
        if (item.Key?.endsWith('/')) {
          folderCount += 1;
        } else {
          objectCount += 1;
          totalBytes += item.Size ?? 0;
        }
      }
      token = response.NextContinuationToken;
      pages += 1;
    } while (token && pages < 50);
    return { objectCount, folderCount, totalBytes, sampled: Boolean(token) };
  }

  public async uploadFile(
    profile: ConnectionProfile,
    bucket: string,
    localPath: string,
    key: string,
    signal: AbortSignal,
    onProgress: (progress: TransferProgress) => Promise<void>
  ): Promise<void> {
    const fileStat = await stat(localPath);
    const safeKey = sanitizeObjectKey(key);
    if (fileStat.size >= multipartThreshold) {
      await this.multipartUpload(profile, bucket, localPath, safeKey, fileStat.size, signal, onProgress);
      return;
    }
    const client = this.createClient(profile);
    let transferred = 0;
    await this.retry(async () => {
      transferred = 0;
      const stream = createReadStream(localPath);
      stream.on('data', (chunk: string | Buffer) => {
        transferred += Buffer.byteLength(chunk);
        void onProgress({ transferred, total: fileStat.size });
      });
      signal.addEventListener('abort', () => stream.destroy(new AppError('Upload aborted.', 'ABORTED')), { once: true });
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: safeKey,
          Body: stream,
          ContentType: mime.getType(localPath) ?? undefined,
          ContentLength: fileStat.size
        }),
        { abortSignal: signal }
      );
    });
    await onProgress({ transferred: fileStat.size, total: fileStat.size });
  }

  public async downloadFile(
    profile: ConnectionProfile,
    bucket: string,
    key: string,
    destinationDirectory: string,
    signal: AbortSignal,
    onProgress: (progress: TransferProgress) => Promise<void>
  ): Promise<string> {
    const client = this.createClient(profile);
    const safeKey = sanitizeObjectKey(key);
    const metadata = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: safeKey }), { abortSignal: signal });
    const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: safeKey }), { abortSignal: signal });
    if (!response.Body || !(response.Body instanceof Readable)) {
      throw new AppError('Download response did not provide a Node stream.', 'STREAM_UNAVAILABLE');
    }
    const body = response.Body;
    const target = safeJoin(destinationDirectory, fileNameFromKey(safeKey));
    let transferred = 0;
    const progress = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        transferred += chunk.length;
        void onProgress({ transferred, total: metadata.ContentLength ?? 0 });
        callback(null, chunk);
      }
    });
    const output = createWriteStream(target);
    signal.addEventListener(
      'abort',
      () => {
        body.destroy(new AppError('Download aborted.', 'ABORTED'));
        output.destroy(new AppError('Download aborted.', 'ABORTED'));
      },
      { once: true }
    );
    try {
      await pipeline(body, progress, output, { signal });
    } catch (error) {
      if (signal.aborted) {
        await unlink(target).catch(() => undefined);
        throw new AppError('Download aborted.', 'ABORTED');
      }
      throw error;
    }
    await onProgress({ transferred: metadata.ContentLength ?? transferred, total: metadata.ContentLength ?? transferred });
    return target;
  }

  private async multipartUpload(
    profile: ConnectionProfile,
    bucket: string,
    localPath: string,
    key: string,
    size: number,
    signal: AbortSignal,
    onProgress: (progress: TransferProgress) => Promise<void>
  ): Promise<void> {
    const client = this.createClient(profile);
    const created = await client.send(
      new CreateMultipartUploadCommand({ Bucket: bucket, Key: key, ContentType: mime.getType(localPath) ?? undefined }),
      { abortSignal: signal }
    );
    if (!created.UploadId) {
      throw new AppError('S3 did not return a multipart upload id.', 'MULTIPART_FAILED');
    }
    const uploadId = created.UploadId;
    const parts: CompletedPart[] = [];
    let transferred = 0;
    const totalParts = Math.ceil(size / partSize);
    const handle = await open(localPath, 'r');
    try {
      for (let partNumber = 1; partNumber <= totalParts; partNumber += 1) {
        if (signal.aborted) {
          throw new AppError('Upload aborted.', 'ABORTED');
        }
        const start = (partNumber - 1) * partSize;
        const length = Math.min(partSize, size - start);
        const partBody = Buffer.allocUnsafe(length);
        await handle.read(partBody, 0, length, start);
        const response = await this.retry(async () => {
          if (signal.aborted) {
            throw new AppError('Upload aborted.', 'ABORTED');
          }
          return await client.send(
            new UploadPartCommand({
              Bucket: bucket,
              Key: key,
              UploadId: uploadId,
              PartNumber: partNumber,
              Body: partBody,
              ContentLength: length
            }),
            { abortSignal: signal }
          );
        });
        parts.push({ PartNumber: partNumber, ETag: response.ETag });
        transferred += length;
        await onProgress({ transferred, total: size });
      }
      await client.send(
        new CompleteMultipartUploadCommand({
          Bucket: bucket,
          Key: key,
          UploadId: uploadId,
          MultipartUpload: { Parts: parts }
        }),
        { abortSignal: signal }
      );
    } catch (error) {
      await client
        .send(new AbortMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId: uploadId }))
        .catch(() => undefined);
      throw error;
    } finally {
      await handle.close();
    }
  }

  private async deletePrefix(client: S3Client, bucket: string, prefix: string): Promise<void> {
    let token: string | undefined;
    do {
      const page = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }));
      for (const object of page.Contents ?? []) {
        if (object.Key) {
          await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: object.Key }));
        }
      }
      token = page.NextContinuationToken;
    } while (token);
  }

  private async copyThenDelete(client: S3Client, bucket: string, sourceKey: string, destinationKey: string): Promise<void> {
    await client.send(
      new CopyObjectCommand({
        Bucket: bucket,
        Key: destinationKey,
        CopySource: `${encodeURIComponent(bucket)}/${sourceKey.split('/').map(encodeURIComponent).join('/')}`
      })
    );
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: sourceKey }));
  }

  private toEntry(
    key: string,
    prefix: string,
    isFolder: boolean,
    size: number,
    lastModified?: Date,
    storageClass?: string,
    etag?: string
  ): ObjectEntry {
    return {
      key,
      name: key.replace(prefix, '').replace(/\/$/, ''),
      prefix,
      isFolder,
      size,
      lastModified: lastModified?.toISOString(),
      storageClass,
      etag,
      contentType: isFolder ? undefined : mime.getType(key) ?? undefined
    };
  }

  private async retry<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        await new Promise((resolve) => setTimeout(resolve, attempt * 500));
      }
    }
    throw lastError;
  }
}
