import express from 'express';
import type { Server } from 'node:http';
import { logger } from './utils/logger.js';

export class ApiServer {
  private server?: Server;
  private port = 0;

  public async start(): Promise<number> {
    const app = express();
    app.use(express.json({ limit: '1mb' }));
    app.get('/health', (_request, response) => {
      response.json({ ok: true, service: 's3-desktop-browser', time: new Date().toISOString() });
    });
    app.get('/version', (_request, response) => {
      response.json({ version: process.env.npm_package_version ?? '1.0.0' });
    });
    const requestedPort = Number(process.env.S3_BROWSER_API_PORT ?? 0);
    await new Promise<void>((resolve) => {
      this.server = app.listen(Number.isNaN(requestedPort) ? 0 : requestedPort, '127.0.0.1', () => resolve());
    });
    const server = this.server;
    if (!server) {
      throw new Error('Express server failed to start.');
    }
    const address = server.address();
    this.port = typeof address === 'object' && address ? address.port : 0;
    await logger.info('Local Express API started.', { port: this.port });
    return this.port;
  }

  public async stop(): Promise<void> {
    if (!this.server) {
      return;
    }
    await new Promise<void>((resolve, reject) => {
      this.server?.close((error) => (error ? reject(error) : resolve()));
    });
  }
}
