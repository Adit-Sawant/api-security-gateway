import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { RateLimiterService } from '../rate-limiter.service';

import { IP_RATE_LIMIT_KEY } from '../decorators/ip-rate-limit.decorator';
import type { IpRateLimitOptions } from '../decorators/ip-rate-limit.decorator';

interface IpRequest {
  ip?: string;
  socket?: {
    remoteAddress?: string;
  };
}

interface HttpResponse {
  setHeader(name: string, value: string | number): void;
}

@Injectable()
export class IpRateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimiter: RateLimiterService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.getAllAndOverride<IpRateLimitOptions>(
      IP_RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!options) {
      return true;
    }

    const request = context.switchToHttp().getRequest<IpRequest>();
    const response = context.switchToHttp().getResponse<HttpResponse>();

    const ip = request.ip ?? request.socket?.remoteAddress;

    if (!ip) {
      throw new HttpException(
        'Unable to identify client IP',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Read endpoint-specific IP limits from centralized configuration.
    const limitKey =
      options.scope === 'login'
        ? 'rateLimit.authentication.login'
        : 'rateLimit.authentication.register';

    const limit = this.configService.getOrThrow<number>(limitKey);

    const windowSeconds = this.configService.getOrThrow<number>(
      'rateLimit.windowSeconds',
    );

    const result = await this.rateLimiter.consumeByIpSlidingWindow(
      ip,
      options.scope,
      limit,
      windowSeconds,
    );

    response.setHeader('X-RateLimit-Limit', result.limit);
    response.setHeader('X-RateLimit-Remaining', result.remaining);
    response.setHeader('X-RateLimit-Reset-After', result.resetAfterSeconds);

    if (!result.allowed) {
      response.setHeader('Retry-After', Math.max(1, result.retryAfterSeconds));

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests from this IP address.',
          limit: result.limit,
          remaining: result.remaining,
          retryAfterSeconds: result.retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
