# S3 Desktop Browser

A desktop S3 Browser built with Electron, Node.js, Express, React, Vite, TypeScript, TailwindCSS, Zustand, and AWS SDK v3.

## Features

- Multiple encrypted S3 connection profiles for AWS S3, Cloudflare R2, MinIO, Wasabi, DigitalOcean Spaces, and custom S3-compatible endpoints.
- Bucket navigation, folder browsing, breadcrumbs, searchable sortable file table, multi-select, context menus, dark/light/system theme.
- Upload files, upload folders recursively, drag-and-drop upload, multipart upload, upload queue, progress updates, retry for multipart parts, abort support.
- Download files and folders recursively with progress and parallel transfer queue.
- Create folders, rename files/folders, delete files/folders, copy object URLs, generate one-hour pre-signed URLs.
- Preview images, text, JSON, and PDFs.
- Bucket statistics dashboard, pagination for large buckets, auto-refresh, recent connection state, import/export profiles, connection testing.
- Secure Electron configuration with context isolation, disabled renderer Node integration, sandboxing, and a typed preload bridge.

## Install

```bash
npm install
```

## Development

```bash
npm run dev
```

The command starts Vite, compiles the Electron main/preload TypeScript, and launches Electron once both are ready.

## Production Build

```bash
npm run build
```

## Desktop Packaging

```bash
npm run dist:win
npm run dist:linux
npm run dist:mac
npm run dist:all
```

`npm run dist` remains an alias for the Windows build. Windows packaging produces NSIS and portable executables. Linux packaging produces AppImage, DEB, RPM, and tar.gz artifacts. macOS packaging produces DMG and ZIP artifacts and should be run on macOS for final distributable builds, signing, and notarization. All artifacts are written to `release/`.

## AWS S3 Setup

1. Create or choose an S3 bucket in AWS.
2. Create an IAM user or role with the S3 actions needed by your workflow:
   `s3:ListAllMyBuckets`, `s3:ListBucket`, `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject`, `s3:AbortMultipartUpload`, `s3:CreateMultipartUpload`, and `s3:ListMultipartUploadParts`.
3. Create an access key for the IAM user.
4. In the app, choose provider `AWS S3`, enter the access key, secret key, region, and optionally the default bucket.

## Cloudflare R2 Setup

1. In Cloudflare, create an R2 bucket.
2. Create an R2 API token with object read/write permissions.
3. Use region `auto`.
4. Use endpoint `https://<account-id>.r2.cloudflarestorage.com`.
5. Enable path-style requests in the profile.

## MinIO Setup

1. Start MinIO and create a bucket.
2. Use endpoint such as `http://127.0.0.1:9000`.
3. Use region `us-east-1` unless your deployment specifies another region.
4. Enable path-style requests.

## Security Notes

Credentials are encrypted with Electron `safeStorage` and stored under the app user-data directory. Secret keys are never exposed through the renderer profile list and are redacted from logs.

## Mockup

See [docs/mockup.svg](docs/mockup.svg).
