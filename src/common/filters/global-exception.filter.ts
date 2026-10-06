import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { RequestContext } from '../context/request-context';
import { isJsonObject, isJsonString, isString, isStringList, JsonObject, JsonValue, readJson } from '../utils/json-value';

interface ParsedException {
  status: number;
  message: string | string[];
  details?: JsonObject;
}

interface ErrorBody {
  success: false;
  statusCode: number;
  message: string | string[];
  details?: JsonObject;
  path: string;
  requestId: string;
  timestamp: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly config: ConfigService) {}

  catch(exception: HttpException | Error | string, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();
    const parsed = this.describe(exception);

    if (parsed.status >= 500) {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }

    const body: ErrorBody = {
      success: false,
      statusCode: parsed.status,
      message: parsed.message,
      path: request.originalUrl ?? request.url,
      requestId: RequestContext.current()?.requestId ?? 'unknown',
      timestamp: new Date().toISOString(),
    };

    if (parsed.details) body.details = parsed.details;
    response.status(parsed.status).json(body);
  }

  private describe(exception: HttpException | Error | string): ParsedException {
    if (exception instanceof HttpException) return this.parseHttp(exception);

    if (exception instanceof Error) return this.parseError(exception);

    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' };
  }

  private parseHttp(exception: HttpException): ParsedException {
    const status = exception.getStatus();
    const raw = exception.getResponse();

    if (isString(raw)) return { status, message: raw };

    const body = readJson(JSON.stringify(raw));

    if (!isJsonObject(body)) return { status, message: exception.message };

    const message = readMessage(body.message);

    if (!message) return { status, message: exception.message };

    const details = leftover(body);

    return details ? { status, message, details } : { status, message };
  }

  private parseError(exception: Error): ParsedException {
    const isDev = this.config.get<string>('app.env') !== 'production';
    const message = isDev ? exception.message : 'Internal server error';

    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message };
  }
}

function readMessage(value: JsonValue | undefined): string | string[] | null {
  if (isJsonString(value)) return value;

  if (isStringList(value)) return value;

  return null;
}

function leftover(body: JsonObject): JsonObject | undefined {
  const details: JsonObject = {};

  for (const [key, field] of Object.entries(body)) {
    if (key === 'message' || key === 'error' || key === 'statusCode') continue;
    details[key] = field;
  }

  return Object.keys(details).length > 0 ? details : undefined;
}
