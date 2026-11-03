import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import Redis from 'ioredis';

import { RedisCacheService } from './redis-cache.service';

import { CACHE_SERVICE, REDIS_CLIENT } from './redis.constants';

@Module({
  imports: [ConfigModule],

  providers: [
    {
      provide: REDIS_CLIENT,

      inject: [ConfigService],

      useFactory: (configService: ConfigService) => {
        return new Redis({
          host: configService.get<string>('REDIS_HOST', 'localhost'),

          port: configService.get<number>('REDIS_PORT', 6379),

          password: configService.get<string>('REDIS_PASSWORD') || undefined,

          db: configService.get<number>('REDIS_DB', 0),

          lazyConnect: true,

          enableReadyCheck: true,

          maxRetriesPerRequest: 3,
        });
      },
    },

    RedisCacheService,

    {
      provide: CACHE_SERVICE,
      useExisting: RedisCacheService,
    },
  ],

  exports: [CACHE_SERVICE, RedisCacheService],
})
export class RedisModule {}
