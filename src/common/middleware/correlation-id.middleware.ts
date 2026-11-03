import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { StructuredLoggerService } from '../logger/structured-logger.service';
import { MetricsService } from '../../modules/metrics/metrics.service';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  constructor(
    private readonly logger: StructuredLoggerService,
    private readonly metricsService: MetricsService,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const incomingId = req.headers['x-request-id'];

    const isValidId =
      typeof incomingId === 'string' &&
      incomingId.length <= 64 &&
      /^[a-zA-Z0-9._-]+$/.test(incomingId);

    const correlationId = isValidId ? incomingId : randomUUID();

    req.headers['x-request-id'] = correlationId;
    res.setHeader('X-Request-ID', correlationId);

    const startTime = process.hrtime.bigint();

    const method = req.method;
    let completed = false;

    this.logger.info('Incoming request', {
      requestId: correlationId,
      method,
      path: req.originalUrl,
      ip: req.ip,
    });

    this.metricsService.activeRequests.labels(method).inc();

    const finalizeRequest = (aborted: boolean): void => {
      // Prevent double decrement if multiple events fire.
      if (completed) {
        return;
      }

      completed = true;

      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1_000_000;

      const route = req.route?.path
        ? `${req.baseUrl}${req.route.path}`
        : 'unmatched';

      if (!aborted) {
        this.metricsService.totalRequests
          .labels(method, route, String(res.statusCode))
          .inc();
      }

      this.metricsService.requestDuration
        .labels(method, route)
        .observe(durationMs / 1000);

      this.metricsService.activeRequests.labels(method).dec();

      this.logger.info(aborted ? 'Request aborted' : 'Request completed', {
        requestId: correlationId,
        method,
        path: req.originalUrl,
        statusCode: aborted ? undefined : res.statusCode,
        durationMs: Number(durationMs.toFixed(2)),
      });
    };

    res.on('finish', () => {
      finalizeRequest(false);
    });

    res.on('close', () => {
      if (!res.writableFinished) {
        finalizeRequest(true);
      }
    });

    next();
  }
}
