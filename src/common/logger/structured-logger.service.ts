import { Injectable } from '@nestjs/common';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

@Injectable()
export class StructuredLoggerService {
  private writeLog(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
  ): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...context,
    };

    const output = JSON.stringify(logEntry);

    if (level === 'error') {
      process.stderr.write(`${output}\n`);
      return;
    }

    process.stdout.write(`${output}\n`);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.writeLog('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.writeLog('warn', message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.writeLog('error', message, context);
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.writeLog('debug', message, context);
  }
}
