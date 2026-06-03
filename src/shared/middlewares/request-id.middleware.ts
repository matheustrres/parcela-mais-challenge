import { randomUUID } from 'node:crypto';

import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const REQUEST_ID_HEADER = 'x-request-id';
const REQUEST_ID_MAX_LENGTH = 128;

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
	use(req: Request & { id?: string }, res: Response, next: NextFunction): void {
		const incomingId = req.headers[REQUEST_ID_HEADER];
		const clientId =
			typeof incomingId === 'string' &&
			incomingId.trim().length > 0 &&
			incomingId.trim().length <= REQUEST_ID_MAX_LENGTH
				? incomingId.trim()
				: undefined;

		const requestId = clientId ?? randomUUID();

		req.id = requestId;
		res.setHeader('X-Request-Id', requestId);

		next();
	}
}
