import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Request } from 'express';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { RequestContext } from '../context/request-context';
import { AuthUser } from '../interfaces/auth-user.interface';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const started = Date.now();
    const requestId = RequestContext.current()?.requestId ?? '-';
    const userId = request.user?.userId ?? '-';

    const write = (outcome: 'ok' | 'error') => {
      this.logger.log(
        `${request.method} ${request.originalUrl} ${outcome} ${Date.now() - started}ms user=${userId} rid=${requestId}`,
      );
    };

    return next.handle().pipe(
      tap(() => write('ok')),
      catchError((error) => {
        write('error');

        return throwError(() => error);
      }),
    );
  }
}
