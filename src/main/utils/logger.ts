import { app } from 'electron';
import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const priorities: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
};

export class Logger {
  private readonly logFile: string;
  private readonly level: LogLevel;

  public constructor() {
    this.level = (process.env.S3_BROWSER_LOG_LEVEL as LogLevel | undefined) ?? 'info';
    this.logFile = path.join(app.getPath('userData'), 'logs', 's3-browser.log');
  }

  public async debug(message: string, meta?: unknown): Promise<void> {
    await this.write('debug', message, meta);
  }

  public async info(message: string, meta?: unknown): Promise<void> {
    await this.write('info', message, meta);
  }

  public async warn(message: string, meta?: unknown): Promise<void> {
    await this.write('warn', message, meta);
  }

  public async error(message: string, meta?: unknown): Promise<void> {
    await this.write('error', message, meta);
  }

  private async write(level: LogLevel, message: string, meta?: unknown): Promise<void> {
    if (priorities[level] < priorities[this.level]) {
      return;
    }
    const line = JSON.stringify({
      time: new Date().toISOString(),
      level,
      message,
      meta: this.redact(meta)
    });
    await mkdir(path.dirname(this.logFile), { recursive: true });
    await appendFile(this.logFile, `${line}\n`, 'utf8');
  }

  private redact(value: unknown): unknown {
    if (!value || typeof value !== 'object') {
      return value;
    }
    return JSON.parse(
      JSON.stringify(value, (key, nested) => {
        if (key.toLowerCase().includes('secret') || key.toLowerCase().includes('accesskey')) {
          return '[redacted]';
        }
        return nested;
      })
    );
  }
}

export const logger = new Logger();
