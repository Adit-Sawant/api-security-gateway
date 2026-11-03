import { Injectable } from '@nestjs/common';
import {
  Registry,
  Counter,
  Histogram,
  Gauge,
  collectDefaultMetrics,
} from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly registry: Registry;

  public readonly totalRequests: Counter;
  public readonly requestDuration: Histogram;
  public readonly activeRequests: Gauge;
  public readonly rateLimitAllowed: Counter;
  public readonly rateLimitBlocked: Counter;

  constructor() {
    this.registry = new Registry();

    // Collect Node.js runtime metrics
    collectDefaultMetrics({
      register: this.registry,
    });

    // Total HTTP requests
    this.totalRequests = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    // HTTP request duration
    this.requestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route'],
      buckets: [0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [this.registry],
    });

    // Currently active requests
    this.activeRequests = new Gauge({
      name: 'http_active_requests',
      help: 'Number of currently active HTTP requests',
      labelNames: ['method'],
      registers: [this.registry],
    });

    this.rateLimitAllowed = new Counter({
      name: 'rate_limit_allowed_total',
      help: 'Total number of requests allowed by rate limiting',
      labelNames: ['type', 'plan'],
      registers: [this.registry],
    });

    this.rateLimitBlocked = new Counter({
      name: 'rate_limit_blocked_total',
      help: 'Total number of requests blocked by rate limiting',
      labelNames: ['type', 'plan'],
      registers: [this.registry],
    });
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  getContentType(): string {
    return this.registry.contentType;
  }
}
