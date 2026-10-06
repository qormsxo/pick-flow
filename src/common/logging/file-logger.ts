import { ConsoleLogger, LogLevel } from '@nestjs/common';
import { appendFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { isJsonValue, isString } from '../utils/json-value';

const LEVELS: LogLevel[] = ['error', 'warn', 'log', 'debug', 'verbose', 'fatal'];

/**
 * 콘솔 출력은 Nest 기본 로거 그대로 두고, 같은 줄을 logs/pick-flow.log 에 남긴다.
 * 에러 스택도 파일에 같이 들어간다.
 */
export class FileLogger extends ConsoleLogger {
  private readonly filePath = join(process.cwd(), 'logs', 'pick-flow.log');

  constructor() {
    super({ logLevels: LEVELS });
    mkdirSync(join(process.cwd(), 'logs'), { recursive: true });
    this.append(`${new Date().toISOString()}     LOG [FileLogger] log file ${this.filePath}`);
  }

  protected printMessages(
    messages: unknown[],
    context?: string,
    logLevel?: LogLevel,
    writeStreamType?: 'stdout' | 'stderr',
    errorStack?: string,
  ): void {
    super.printMessages(messages, context, logLevel, writeStreamType, errorStack);
    const level = (logLevel ?? 'log').toUpperCase().padStart(7, ' ');
    const ctx = context ? `[${context}] ` : '';

    for (const message of messages) {
      const text = isString(message) ? message : isJsonValue(message) ? JSON.stringify(message) : String(message);
      this.append(`${new Date().toISOString()} ${level} ${ctx}${text}`);
    }
  }

  protected printStackTrace(stack: string): void {
    super.printStackTrace(stack);

    if (stack) this.append(stack);
  }

  private append(line: string): void {
    appendFileSync(this.filePath, `${line}\n`);
  }
}

