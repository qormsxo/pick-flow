import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { RequestContext } from '../context/request-context';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.header('x-request-id');
    const requestId = incoming && incoming.length <= 64 ? incoming : randomUUID();
    res.setHeader('x-request-id', requestId);
    RequestContext.run({ requestId, startedAt: Date.now() }, () => next());
  }
}
