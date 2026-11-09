import {
  ExecutionContext,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';

import { RateLimitGuard } from './rate-limit.guard';
import { RateLimiterService } from './rate-limiter.service';
import { SubscriptionPlan } from '../common/enums/subscription-plan.enum';

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard;

  const mockRateLimiter = {
    consumeSlidingWindow: jest.fn(),
  };

  const mockResponse = {
    setHeader: jest.fn(),
  };

  const mockRequest = {
    user: {
      id: 'user-123',
      email: 'test@example.com',
      roles: ['USER'],
      subscriptionPlan: SubscriptionPlan.FREE,
    },
  };

  const mockExecutionContext = {
    switchToHttp: jest.fn(() => ({
      getRequest: jest.fn(() => mockRequest),
      getResponse: jest.fn(() => mockResponse),
    })),
  } as unknown as ExecutionContext;

  const allowedResult = {
    allowed: true,
    limit: 60,
    remaining: 59,
    resetAfterSeconds: 60,
    retryAfterSeconds: 0,
  };

  const blockedResult = {
    allowed: false,
    limit: 60,
    remaining: 0,
    resetAfterSeconds: 45,
    retryAfterSeconds: 45,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockRequest.user = {
      id: 'user-123',
      email: 'test@example.com',
      roles: ['USER'],
      subscriptionPlan: SubscriptionPlan.FREE,
    };

    mockRateLimiter.consumeSlidingWindow.mockResolvedValue(allowedResult);

    guard = new RateLimitGuard(
      mockRateLimiter as unknown as RateLimiterService,
    );
  });

  describe('Initialization', () => {
    it('should be defined', () => {
      expect(guard).toBeDefined();
    });
  });

  describe('Authentication', () => {
    it('should throw UnauthorizedException when user is missing', async () => {
      mockRequest.user = undefined as any;

      await expect(
        guard.canActivate(mockExecutionContext),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(mockRateLimiter.consumeSlidingWindow).not.toHaveBeenCalled();
    });
  });

  describe('Subscription plan handling', () => {
    it('should apply FREE plan limits', async () => {
      mockRequest.user.subscriptionPlan = SubscriptionPlan.FREE;

      await guard.canActivate(mockExecutionContext);

      expect(mockRateLimiter.consumeSlidingWindow).toHaveBeenCalledWith(
        'user-123',
        SubscriptionPlan.FREE,
      );
    });

    it('should apply PRO plan limits', async () => {
      mockRequest.user.subscriptionPlan = SubscriptionPlan.PRO;

      await guard.canActivate(mockExecutionContext);

      expect(mockRateLimiter.consumeSlidingWindow).toHaveBeenCalledWith(
        'user-123',
        SubscriptionPlan.PRO,
      );
    });

    it('should apply ENTERPRISE plan limits', async () => {
      mockRequest.user.subscriptionPlan = SubscriptionPlan.ENTERPRISE;

      await guard.canActivate(mockExecutionContext);

      expect(mockRateLimiter.consumeSlidingWindow).toHaveBeenCalledWith(
        'user-123',
        SubscriptionPlan.ENTERPRISE,
      );
    });

    it('should fall back to FREE for an unknown subscription plan', async () => {
      mockRequest.user.subscriptionPlan = 'GOLD';

      await guard.canActivate(mockExecutionContext);

      expect(mockRateLimiter.consumeSlidingWindow).toHaveBeenCalledWith(
        'user-123',
        SubscriptionPlan.FREE,
      );
    });

    it('should fall back to FREE when subscription plan is missing', async () => {
      mockRequest.user.subscriptionPlan = undefined;

      await guard.canActivate(mockExecutionContext);

      expect(mockRateLimiter.consumeSlidingWindow).toHaveBeenCalledWith(
        'user-123',
        SubscriptionPlan.FREE,
      );
    });
  });

  describe('Allowed requests', () => {
    it('should allow requests within the rate limit', async () => {
      const result = await guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
    });

    it('should set the rate-limit response headers', async () => {
      await guard.canActivate(mockExecutionContext);

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Limit',
        60,
      );

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Remaining',
        59,
      );

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Reset-After',
        60,
      );
    });
  });

  describe('Blocked requests', () => {
    beforeEach(() => {
      mockRateLimiter.consumeSlidingWindow.mockResolvedValue(blockedResult);
    });

    it('should throw HTTP 429 when the rate limit is exceeded', async () => {
      await expect(
        guard.canActivate(mockExecutionContext),
      ).rejects.toMatchObject({
        status: HttpStatus.TOO_MANY_REQUESTS,
      });
    });

    it('should return the correct rate-limit error details', async () => {
      try {
        await guard.canActivate(mockExecutionContext);
        fail('Expected HTTP exception');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);

        expect((error as HttpException).getResponse()).toEqual({
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Rate limit exceeded. Please try again later.',
          limit: 60,
          remaining: 0,
          retryAfterSeconds: 45,
        });
      }
    });

    it('should set the Retry-After header', async () => {
      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        HttpException,
      );

      expect(mockResponse.setHeader).toHaveBeenCalledWith('Retry-After', 45);
    });

    it('should enforce a minimum Retry-After value of one second', async () => {
      mockRateLimiter.consumeSlidingWindow.mockResolvedValue({
        ...blockedResult,
        retryAfterSeconds: 0,
      });

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        HttpException,
      );

      expect(mockResponse.setHeader).toHaveBeenCalledWith('Retry-After', 1);
    });

    it('should set rate-limit headers even when the request is blocked', async () => {
      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        HttpException,
      );

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Limit',
        60,
      );

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Remaining',
        0,
      );

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Reset-After',
        45,
      );
    });
  });

  describe('Rate limiter errors', () => {
    it('should propagate rate limiter service errors', async () => {
      mockRateLimiter.consumeSlidingWindow.mockRejectedValue(
        new Error('Redis connection failed'),
      );

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        'Redis connection failed',
      );
    });
  });
});
