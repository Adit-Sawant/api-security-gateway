import { randomUUID, createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { CACHE_SERVICE } from '../infrastructure/redis/redis.constants';
import type { ICacheService } from '../infrastructure/redis/interfaces/cache.interface';
import { SubscriptionPlan } from '../common/enums/subscription-plan.enum';
import type { RateLimitResult } from './domain/rate-limit-result.interface';
import { ConfigService } from '@nestjs/config';
import { MetricsService } from '../modules/metrics/metrics.service';

@Injectable()
export class RateLimiterService {
  private readonly windowSeconds = 60;

  private readonly planLimits: Record<SubscriptionPlan, number> = {
    [SubscriptionPlan.FREE]: 10,
    [SubscriptionPlan.PRO]: 600,
    [SubscriptionPlan.ENTERPRISE]: 3000,
  };

  constructor(
    @Inject(CACHE_SERVICE)
    private readonly cache: ICacheService,
    private readonly configService: ConfigService,
    private readonly metricsService: MetricsService,
  ) {}

  private recordRateLimit(
    type: 'user' | 'ip',
    plan: SubscriptionPlan | 'UNKNOWN',
    allowed: boolean,
  ): void {
    const counter = allowed
      ? this.metricsService.rateLimitAllowed
      : this.metricsService.rateLimitBlocked;

    counter.labels(type, plan).inc();
  }

  async consume(
    userId: string,
    plan: SubscriptionPlan = SubscriptionPlan.FREE,
  ): Promise<RateLimitResult> {
    const limit = this.planLimits[plan];

    const key = `rate-limit:v1:user:${userId}`;

    return this.consumeKey(key, limit, this.windowSeconds);
  }

  async consumeByIp(
    ip: string,
    scope: string,
    limit: number,
    windowSeconds = 60,
  ): Promise<RateLimitResult> {
    const ipHash = createHash('sha256').update(ip).digest('hex');

    const key = `rate-limit:v1:ip:${scope}:${ipHash}`;

    return this.consumeKey(key, limit, windowSeconds);
  }

  private async consumeKey(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitResult> {
    const result = await this.cache.incrementWithExpiry(key, windowSeconds);

    const allowed = result.count <= limit;

    const remaining = Math.max(0, limit - result.count);

    const resetAfterSeconds = Math.max(0, result.ttl);

    return {
      allowed,
      limit,
      remaining,
      resetAfterSeconds,
      retryAfterSeconds: allowed ? 0 : resetAfterSeconds,
    };
  }
  async consumeSlidingWindow(
    userId: string,
    plan: SubscriptionPlan,
  ): Promise<RateLimitResult> {
    const limits: Record<SubscriptionPlan, number> = {
      [SubscriptionPlan.FREE]: this.configService.getOrThrow<number>(
        'rateLimit.plans.FREE',
      ),

      [SubscriptionPlan.PRO]: this.configService.getOrThrow<number>(
        'rateLimit.plans.PRO',
      ),

      [SubscriptionPlan.ENTERPRISE]: this.configService.getOrThrow<number>(
        'rateLimit.plans.ENTERPRISE',
      ),
    };

    const limit = limits[plan];

    const windowSeconds = this.configService.getOrThrow<number>(
      'rateLimit.windowSeconds',
    );

    const result = await this.consumeSlidingWindowKey(
      `rate-limit:v2:user:${userId}`,
      limit,
      windowSeconds,
    );

    this.recordRateLimit('user', plan, result.allowed);

    return result;
  }

  async consumeByIpSlidingWindow(
    ip: string,
    scope: string,
    limit: number,
    windowSeconds = 60,
  ): Promise<RateLimitResult> {
    const ipHash = createHash('sha256').update(ip).digest('hex');

    const result = await this.consumeSlidingWindowKey(
      `rate-limit:v2:ip:${scope}:${ipHash}`,
      limit,
      windowSeconds,
    );

    this.recordRateLimit('ip', 'UNKNOWN', result.allowed);

    return result;
  }

  private async consumeSlidingWindowKey(
    key: string,
    limit: number,
    windowSeconds: number,
  ): Promise<RateLimitResult> {
    const result = await this.cache.consumeSlidingWindow(
      key,
      Date.now(),
      windowSeconds * 1000,
      limit,
      randomUUID(),
    );

    return {
      allowed: result.allowed,
      limit,
      remaining: result.remaining,
      resetAfterSeconds: result.resetAfterSeconds,
      retryAfterSeconds: result.retryAfterSeconds,
    };
  }
}
