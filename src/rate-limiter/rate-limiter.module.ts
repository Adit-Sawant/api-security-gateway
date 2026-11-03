import { Module } from '@nestjs/common';
import { RedisModule } from '../infrastructure/redis/redis.module';
import { RateLimiterService } from './rate-limiter.service';
import { RateLimitGuard } from './rate-limit.guard';
import { IpRateLimitGuard } from './guards/ip-rate-limit.guard';
import { MetricsModule } from '../modules/metrics/metrics.module';

@Module({
  imports: [RedisModule, MetricsModule],
  providers: [RateLimiterService, RateLimitGuard, IpRateLimitGuard],
  exports: [RateLimiterService, RateLimitGuard, IpRateLimitGuard],
})
export class RateLimitingModule {}
