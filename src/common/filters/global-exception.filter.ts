import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { RequestContext } from '../context/request-context';

interface ErrorBody {
  success: false;
  statusCode: number;
  message: string | string[];
  details?: Record<string, unknown>;
  path: string;
  requestId: string;
  timestamp: string;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly config: ConfigService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();
    const parsed = this.parse(exception);

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

  private parse(exception: unknown): {
    status: number;
    message: string | string[];
    details?: Record<string, unknown>;
  } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const raw = exception.getResponse();
      if (typeof raw === 'string') return { status, message: raw };
      if (typeof raw === 'object' && raw && 'message' in raw) {
        const record = raw as Record<string, unknown>;
        const message = record.message;
        const details = { ...record };
        delete details.message;
        delete details.error;
        delete details.statusCode;
        const extra = Object.keys(details).length > 0 ? details : undefined;
        if (typeof message === 'string' || Array.isArray(message)) {
          return { status, message, details: extra };
        }
      }
      return { status, message: exception.message };
    }

    const isDev = this.config.get<string>('app.env') !== 'production';
    const message = isDev && exception instanceof Error ? exception.message : 'Internal server error';
    return { status: HttpStatus.INTERNAL_SERVER_ERROR, message };
  }
}
