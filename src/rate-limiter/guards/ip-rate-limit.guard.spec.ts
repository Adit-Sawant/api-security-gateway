import { ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';

import { IpRateLimitGuard } from './ip-rate-limit.guard';
import { RateLimiterService } from '../rate-limiter.service';
import { IP_RATE_LIMIT_KEY } from '../decorators/ip-rate-limit.decorator';

describe('IpRateLimitGuard', () => {
  let guard: IpRateLimitGuard;

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  const mockRateLimiter = {
    consumeByIpSlidingWindow: jest.fn(),
  };

  const mockConfigService = {
    getOrThrow: jest.fn(),
  };

  const mockResponse = {
    setHeader: jest.fn(),
  };

  const mockRequest = {
    ip: '192.168.1.10',
    socket: {
      remoteAddress: '127.0.0.1',
    },
  };

  const mockExecutionContext = {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: jest.fn(() => ({
      getRequest: jest.fn(() => mockRequest),
      getResponse: jest.fn(() => mockResponse),
    })),
  } as unknown as ExecutionContext;

  const allowedResult = {
    allowed: true,
    limit: 10,
    remaining: 9,
    resetAfterSeconds: 60,
    retryAfterSeconds: 0,
  };

  const blockedResult = {
    allowed: false,
    limit: 10,
    remaining: 0,
    resetAfterSeconds: 45,
    retryAfterSeconds: 45,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    guard = new IpRateLimitGuard(
      mockReflector as unknown as Reflector,
      mockRateLimiter as unknown as RateLimiterService,
      mockConfigService as unknown as ConfigService,
    );

    mockConfigService.getOrThrow.mockImplementation((key: string) => {
      const config: Record<string, number> = {
        'rateLimit.authentication.login': 10,
        'rateLimit.authentication.register': 5,
        'rateLimit.windowSeconds': 60,
      };

      return config[key];
    });

    mockRateLimiter.consumeByIpSlidingWindow.mockResolvedValue(allowedResult);

    mockReflector.getAllAndOverride.mockReturnValue({
      scope: 'login',
    });
  });

  describe('Initialization', () => {
    it('should be defined', () => {
      expect(guard).toBeDefined();
    });
  });

  describe('Metadata handling', () => {
    it('should allow requests without rate-limit metadata', async () => {
      mockReflector.getAllAndOverride.mockReturnValue(undefined);

      const result = await guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
      expect(mockRateLimiter.consumeByIpSlidingWindow).not.toHaveBeenCalled();
    });

    it('should retrieve rate-limit metadata from handler and class', async () => {
      await guard.canActivate(mockExecutionContext);

      expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(
        IP_RATE_LIMIT_KEY,
        [mockExecutionContext.getHandler(), mockExecutionContext.getClass()],
      );
    });
  });

  describe('Client IP identification', () => {
    it('should use request.ip when available', async () => {
      await guard.canActivate(mockExecutionContext);

      expect(mockRateLimiter.consumeByIpSlidingWindow).toHaveBeenCalledWith(
        '192.168.1.10',
        'login',
        10,
        60,
      );
    });

    it('should use socket.remoteAddress when request.ip is unavailable', async () => {
      const context = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn(() => ({
          getRequest: jest.fn(() => ({
            socket: {
              remoteAddress: '127.0.0.1',
            },
          })),
          getResponse: jest.fn(() => mockResponse),
        })),
      } as unknown as ExecutionContext;

      await guard.canActivate(context);

      expect(mockRateLimiter.consumeByIpSlidingWindow).toHaveBeenCalledWith(
        '127.0.0.1',
        'login',
        10,
        60,
      );
    });

    it('should throw HTTP 400 when client IP cannot be identified', async () => {
      const context = {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: jest.fn(() => ({
          getRequest: jest.fn(() => ({})),
          getResponse: jest.fn(() => mockResponse),
        })),
      } as unknown as ExecutionContext;

      await expect(guard.canActivate(context)).rejects.toMatchObject({
        status: HttpStatus.BAD_REQUEST,
        response: 'Unable to identify client IP',
      });

      expect(mockRateLimiter.consumeByIpSlidingWindow).not.toHaveBeenCalled();
    });
  });

  describe('Configuration and rate limiting', () => {
    it('should use login-specific rate-limit configuration', async () => {
      mockReflector.getAllAndOverride.mockReturnValue({
        scope: 'login',
      });

      await guard.canActivate(mockExecutionContext);

      expect(mockConfigService.getOrThrow).toHaveBeenCalledWith(
        'rateLimit.authentication.login',
      );

      expect(mockRateLimiter.consumeByIpSlidingWindow).toHaveBeenCalledWith(
        '192.168.1.10',
        'login',
        10,
        60,
      );
    });

    it('should use registration-specific rate-limit configuration', async () => {
      mockReflector.getAllAndOverride.mockReturnValue({
        scope: 'register',
      });

      await guard.canActivate(mockExecutionContext);

      expect(mockConfigService.getOrThrow).toHaveBeenCalledWith(
        'rateLimit.authentication.register',
      );

      expect(mockRateLimiter.consumeByIpSlidingWindow).toHaveBeenCalledWith(
        '192.168.1.10',
        'register',
        5,
        60,
      );
    });

    it('should use the configured rate-limit window', async () => {
      mockConfigService.getOrThrow.mockImplementation((key: string) => {
        const config: Record<string, number> = {
          'rateLimit.authentication.login': 10,
          'rateLimit.authentication.register': 5,
          'rateLimit.windowSeconds': 120,
        };

        return config[key];
      });

      await guard.canActivate(mockExecutionContext);

      expect(mockRateLimiter.consumeByIpSlidingWindow).toHaveBeenCalledWith(
        '192.168.1.10',
        'login',
        10,
        120,
      );
    });

    it('should propagate configuration errors', async () => {
      mockConfigService.getOrThrow.mockImplementation(() => {
        throw new Error('Configuration missing');
      });

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        'Configuration missing',
      );
    });
  });

  describe('Allowed requests', () => {
    it('should allow requests within the rate limit', async () => {
      const result = await guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
    });

    it('should set rate-limit response headers', async () => {
      await guard.canActivate(mockExecutionContext);

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Limit',
        10,
      );

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Remaining',
        9,
      );

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Reset-After',
        60,
      );
    });
  });

  describe('Blocked requests', () => {
    beforeEach(() => {
      mockRateLimiter.consumeByIpSlidingWindow.mockResolvedValue(blockedResult);
    });

    it('should throw HTTP 429 when the rate limit is exceeded', async () => {
      await expect(
        guard.canActivate(mockExecutionContext),
      ).rejects.toMatchObject({
        status: HttpStatus.TOO_MANY_REQUESTS,
      });
    });

    it('should include rate-limit details in the exception response', async () => {
      try {
        await guard.canActivate(mockExecutionContext);
        fail('Expected HTTP exception');
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);

        expect((error as HttpException).getResponse()).toEqual({
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many requests from this IP address.',
          limit: 10,
          remaining: 0,
          retryAfterSeconds: 45,
        });
      }
    });

    it('should set Retry-After response header', async () => {
      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        HttpException,
      );

      expect(mockResponse.setHeader).toHaveBeenCalledWith('Retry-After', 45);
    });

    it('should set minimum Retry-After value to one second', async () => {
      mockRateLimiter.consumeByIpSlidingWindow.mockResolvedValue({
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
        10,
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
      mockRateLimiter.consumeByIpSlidingWindow.mockRejectedValue(
        new Error('Redis connection failed'),
      );

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        'Redis connection failed',
      );
    });
  });
});
