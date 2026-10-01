import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { RequestContext } from '../context/request-context';
import { ApiEnvelope } from '../interfaces/api-envelope';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiEnvelope<unknown>> {
    if (context.getType() !== 'http') return next.handle() as Observable<ApiEnvelope<unknown>>;

    const requestId = RequestContext.current()?.requestId ?? 'unknown';
    return next.handle().pipe(
      map((data: unknown) => ({
        success: true as const,
        data,
        requestId,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
