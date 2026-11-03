import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type { ICacheService } from '../../infrastructure/redis/interfaces/cache.interface';
import { CACHE_SERVICE } from '../../infrastructure/redis/redis.constants';
import { Inject } from '@nestjs/common';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,

    @Inject(CACHE_SERVICE)
    private readonly cache: ICacheService,
  ) {}

  async checkReadiness() {
    const checks = {
      database: false,
      redis: false,
    };

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      checks.database = true;
    } catch {
      checks.database = false;
    }

    try {
      await this.cache.ping();
      checks.redis = true;
    } catch {
      checks.redis = false;
    }

    const isReady = checks.database && checks.redis;

    return {
      status: isReady ? 'ready' : 'not_ready',
      checks,
      timestamp: new Date().toISOString(),
    };
  }
}
