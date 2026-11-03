import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';

import { RateLimiterService } from './rate-limiter.service';
import { SubscriptionPlan } from '../common/enums/subscription-plan.enum';

interface AuthenticatedRequest {
  user?: {
    id: string;
    email: string;
    roles: string[];
    subscriptionPlan?: string;
  };
}

interface HttpResponse {
  setHeader(name: string, value: string | number): void;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private readonly rateLimiter: RateLimiterService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const response = context.switchToHttp().getResponse<HttpResponse>();

    const user = request.user;

    if (!user) {
      throw new UnauthorizedException();
    }

    const requestedPlan = user.subscriptionPlan;

    const plan = Object.values(SubscriptionPlan).includes(
      requestedPlan as SubscriptionPlan,
    )
      ? (requestedPlan as SubscriptionPlan)
      : SubscriptionPlan.FREE;

    const result = await this.rateLimiter.consumeSlidingWindow(user.id, plan);

    response.setHeader('X-RateLimit-Limit', result.limit);
    response.setHeader('X-RateLimit-Remaining', result.remaining);
    response.setHeader('X-RateLimit-Reset-After', result.resetAfterSeconds);

    if (!result.allowed) {
      response.setHeader('Retry-After', Math.max(1, result.retryAfterSeconds));

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Rate limit exceeded. Please try again later.',
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
