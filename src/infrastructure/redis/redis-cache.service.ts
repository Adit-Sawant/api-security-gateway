import {
  Injectable,
  Inject,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';

import Redis from 'ioredis';

import { ICacheService } from './interfaces/cache.interface';
import { REDIS_CLIENT } from './redis.constants';

const INCREMENT_WITH_EXPIRY_SCRIPT = `
  local count = redis.call('INCR', KEYS[1])

  if count == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
  end

  local ttl = redis.call('TTL', KEYS[1])

  return { count, ttl }
`;

@Injectable()
export class RedisCacheService
  implements ICacheService, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(RedisCacheService.name);

  constructor(
    @Inject(REDIS_CLIENT)
    private readonly redis: Redis,
  ) {
    this.redis.on('error', (error) => {
      this.logger.error(`Redis error: ${error.message}`);
    });

    this.redis.on('connect', () => {
      this.logger.log('Redis connected');
    });

    this.redis.on('ready', () => {
      this.logger.log('Redis ready');
    });
  }

  async onModuleInit(): Promise<void> {
    if (this.redis.status === 'wait') {
      await this.redis.connect();
    }

    await this.ping();

    this.logger.log('Redis infrastructure initialized');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis.status !== 'end') {
      await this.redis.quit();
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const value = await this.redis.get(key);

    if (value === null) {
      return null;
    }

    return JSON.parse(value) as T;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const serializedValue = JSON.stringify(value);

    if (ttlSeconds !== undefined) {
      if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
        throw new Error('TTL must be a positive integer');
      }

      await this.redis.set(key, serializedValue, 'EX', ttlSeconds);

      return;
    }

    await this.redis.set(key, serializedValue);
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async incrementWithExpiry(
    key: string,
    ttlSeconds: number,
  ): Promise<{ count: number; ttl: number }> {
    if (!Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
      throw new Error('TTL must be a positive integer');
    }

    const result = (await this.redis.eval(
      INCREMENT_WITH_EXPIRY_SCRIPT,
      1,
      key,
      ttlSeconds,
    )) as [number, number];

    return {
      count: Number(result[0]),
      ttl: Number(result[1]),
    };
  }

  async consumeSlidingWindow(
    key: string,
    nowMs: number,
    windowMs: number,
    limit: number,
    requestId: string,
  ): Promise<{
    allowed: boolean;
    total: number;
    remaining: number;
    resetAfterSeconds: number;
    retryAfterSeconds: number;
  }> {
    const script = `
    local key = KEYS[1]

    local now = tonumber(ARGV[1])
    local window = tonumber(ARGV[2])
    local limit = tonumber(ARGV[3])
    local requestId = ARGV[4]

    local windowStart = now - window

    -- Remove requests outside the rolling window
    redis.call(
      'ZREMRANGEBYSCORE',
      key,
      '-inf',
      windowStart
    )

    -- Count requests still inside the window
    local count = redis.call('ZCARD', key)

    -- Find the oldest request
    local oldest = redis.call(
      'ZRANGE',
      key,
      0,
      0,
      'WITHSCORES'
    )

    local resetAfter = 0

    if count > 0 then
      resetAfter = math.max(
        0,
        math.ceil(
          (tonumber(oldest[2]) + window - now) / 1000
        )
      )
    end

    -- Reject if limit has already been reached
    if count >= limit then
      return {
        0,
        count,
        0,
        resetAfter,
        resetAfter
      }
    end

    -- Record this request
    redis.call('ZADD', key, now, requestId)

    -- Automatically clean up unused keys
    redis.call('PEXPIRE', key, window)

    count = count + 1

    if count == 1 then
      resetAfter = math.ceil(window / 1000)
    end

    return {
      1,
      count,
      limit - count,
      resetAfter,
      0
    }
  `;

    const result = (await this.redis.eval(
      script,
      1,
      key,
      nowMs,
      windowMs,
      limit,
      requestId,
    )) as number[];

    return {
      allowed: result[0] === 1,
      total: result[1],
      remaining: result[2],
      resetAfterSeconds: result[3],
      retryAfterSeconds: result[4],
    };
  }

  async ping(): Promise<string> {
    return this.redis.ping();
  }
}
