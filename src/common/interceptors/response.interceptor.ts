import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { map } from 'rxjs';
import { RequestContext } from '../context/request-context';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    if (context.getType() !== 'http') return next.handle();

    const requestId = RequestContext.current()?.requestId ?? 'unknown';

    return next.handle().pipe(
      map((data) => ({
        success: true as const,
        data,
        requestId,
        timestamp: new Date().toISOString(),
      })),
    );
  }
}
