import {
  Controller,
  Get,
  Inject,
  InternalServerErrorException,
} from '@nestjs/common';

import { CACHE_SERVICE } from './infrastructure/redis/redis.constants';

import type { ICacheService } from './infrastructure/redis/interfaces/cache.interface';

@Controller()
export class AppController {
  constructor(
    @Inject(CACHE_SERVICE)
    private readonly cacheService: ICacheService,
  ) {}

  @Get()
  getHello(): string {
    return 'API Security Gateway is running!';
  }

  @Get('redis-health')
  async checkRedis() {
    const result = await this.cacheService.ping();

    return {
      status: 'success',
      message: 'Redis connection established',
      redisResponse: result,
    };
  }
}
