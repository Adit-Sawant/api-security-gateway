import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';

import { RateLimiterService } from './rate-limiter.service';
import { CACHE_SERVICE } from '../infrastructure/redis/redis.constants';
import { MetricsService } from '../modules/metrics/metrics.service';
import { SubscriptionPlan } from '../common/enums/subscription-plan.enum';

describe('RateLimiterService', () => {
  let service: RateLimiterService;

  const mockCacheService = {
    incrementWithExpiry: jest.fn(),
    consumeSlidingWindow: jest.fn(),
  };

  const mockConfigService = {
    getOrThrow: jest.fn(),
  };

  const mockAllowedMetricIncrement = jest.fn();
  const mockBlockedMetricIncrement = jest.fn();

  const mockMetricsService = {
    rateLimitAllowed: {
      labels: jest.fn().mockReturnValue({
        inc: mockAllowedMetricIncrement,
      }),
    },
    rateLimitBlocked: {
      labels: jest.fn().mockReturnValue({
        inc: mockBlockedMetricIncrement,
      }),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimiterService,
        {
          provide: CACHE_SERVICE,
          useValue: mockCacheService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: MetricsService,
          useValue: mockMetricsService,
        },
      ],
    }).compile();

    service = module.get<RateLimiterService>(RateLimiterService);
  });

  describe('Service initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });

  describe('Fixed-window user rate limiting', () => {
    it('should allow a request within the FREE plan limit', async () => {
      mockCacheService.incrementWithExpiry.mockResolvedValue({
        count: 1,
        ttl: 60,
      });

      const result = await service.consume('user-123', SubscriptionPlan.FREE);

      expect(result).toEqual({
        allowed: true,
        limit: 10,
        remaining: 9,
        resetAfterSeconds: 60,
        retryAfterSeconds: 0,
      });
    });

    it('should block a request when the FREE plan limit is exceeded', async () => {
      mockCacheService.incrementWithExpiry.mockResolvedValue({
        count: 11,
        ttl: 45,
      });

      const result = await service.consume('user-123', SubscriptionPlan.FREE);

      expect(result).toEqual({
        allowed: false,
        limit: 10,
        remaining: 0,
        resetAfterSeconds: 45,
        retryAfterSeconds: 45,
      });
    });

    it('should allow requests within the PRO plan limit', async () => {
      mockCacheService.incrementWithExpiry.mockResolvedValue({
        count: 500,
        ttl: 30,
      });

      const result = await service.consume('user-456', SubscriptionPlan.PRO);

      expect(result).toEqual({
        allowed: true,
        limit: 600,
        remaining: 100,
        resetAfterSeconds: 30,
        retryAfterSeconds: 0,
      });
    });

    it('should allow requests within the ENTERPRISE plan limit', async () => {
      mockCacheService.incrementWithExpiry.mockResolvedValue({
        count: 2500,
        ttl: 20,
      });

      const result = await service.consume(
        'user-789',
        SubscriptionPlan.ENTERPRISE,
      );

      expect(result).toEqual({
        allowed: true,
        limit: 3000,
        remaining: 500,
        resetAfterSeconds: 20,
        retryAfterSeconds: 0,
      });
    });

    it('should return zero remaining requests when the limit is reached', async () => {
      mockCacheService.incrementWithExpiry.mockResolvedValue({
        count: 10,
        ttl: 15,
      });

      const result = await service.consume('user-123', SubscriptionPlan.FREE);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0);
      expect(result.retryAfterSeconds).toBe(0);
    });

    it('should never return negative remaining requests', async () => {
      mockCacheService.incrementWithExpiry.mockResolvedValue({
        count: 15,
        ttl: 30,
      });

      const result = await service.consume('user-123', SubscriptionPlan.FREE);

      expect(result.remaining).toBe(0);
    });

    it('should return zero reset time when Redis TTL is negative', async () => {
      mockCacheService.incrementWithExpiry.mockResolvedValue({
        count: 1,
        ttl: -1,
      });

      const result = await service.consume('user-123', SubscriptionPlan.FREE);

      expect(result.resetAfterSeconds).toBe(0);
    });

    it('should use the correct Redis key and window for a user', async () => {
      mockCacheService.incrementWithExpiry.mockResolvedValue({
        count: 1,
        ttl: 60,
      });

      await service.consume('user-123', SubscriptionPlan.FREE);

      expect(mockCacheService.incrementWithExpiry).toHaveBeenCalledWith(
        'rate-limit:v1:user:user-123',
        60,
      );
    });

    it('should propagate Redis errors', async () => {
      mockCacheService.incrementWithExpiry.mockRejectedValue(
        new Error('Redis connection failed'),
      );

      await expect(
        service.consume('user-123', SubscriptionPlan.FREE),
      ).rejects.toThrow('Redis connection failed');
    });
  });

  describe('Fixed-window IP rate limiting', () => {
    it('should allow an IP request within its limit', async () => {
      mockCacheService.incrementWithExpiry.mockResolvedValue({
        count: 1,
        ttl: 60,
      });

      const result = await service.consumeByIp('192.168.1.10', 'login', 5);

      expect(result).toEqual({
        allowed: true,
        limit: 5,
        remaining: 4,
        resetAfterSeconds: 60,
        retryAfterSeconds: 0,
      });
    });

    it('should block an IP request when its limit is exceeded', async () => {
      mockCacheService.incrementWithExpiry.mockResolvedValue({
        count: 6,
        ttl: 40,
      });

      const result = await service.consumeByIp('192.168.1.10', 'login', 5);

      expect(result).toEqual({
        allowed: false,
        limit: 5,
        remaining: 0,
        resetAfterSeconds: 40,
        retryAfterSeconds: 40,
      });
    });

    it('should hash IP addresses before using them in Redis keys', async () => {
      const { createHash } = await import('node:crypto');

      mockCacheService.incrementWithExpiry.mockResolvedValue({
        count: 1,
        ttl: 60,
      });

      const ip = '192.168.1.10';
      const expectedHash = createHash('sha256').update(ip).digest('hex');

      await service.consumeByIp(ip, 'login', 5);

      expect(mockCacheService.incrementWithExpiry).toHaveBeenCalledWith(
        `rate-limit:v1:ip:login:${expectedHash}`,
        60,
      );
    });

    it('should use different Redis keys for different IP scopes', async () => {
      mockCacheService.incrementWithExpiry.mockResolvedValue({
        count: 1,
        ttl: 60,
      });

      await service.consumeByIp('192.168.1.10', 'login', 5);
      await service.consumeByIp('192.168.1.10', 'register', 5);

      const firstKey = mockCacheService.incrementWithExpiry.mock.calls[0][0];
      const secondKey = mockCacheService.incrementWithExpiry.mock.calls[1][0];

      expect(firstKey).not.toBe(secondKey);
    });

    it('should use a custom IP rate-limit window', async () => {
      mockCacheService.incrementWithExpiry.mockResolvedValue({
        count: 1,
        ttl: 120,
      });

      await service.consumeByIp('192.168.1.10', 'login', 5, 120);

      expect(mockCacheService.incrementWithExpiry).toHaveBeenCalledWith(
        expect.stringContaining('rate-limit:v1:ip:login:'),
        120,
      );
    });
  });

  describe('Sliding-window user rate limiting', () => {
    beforeEach(() => {
      mockConfigService.getOrThrow.mockImplementation((key: string) => {
        const config: Record<string, number> = {
          'rateLimit.plans.FREE': 10,
          'rateLimit.plans.PRO': 600,
          'rateLimit.plans.ENTERPRISE': 3000,
          'rateLimit.windowSeconds': 60,
        };

        return config[key];
      });
    });

    it('should allow a request within the sliding-window limit', async () => {
      mockCacheService.consumeSlidingWindow.mockResolvedValue({
        allowed: true,
        remaining: 9,
        resetAfterSeconds: 60,
        retryAfterSeconds: 0,
      });

      const result = await service.consumeSlidingWindow(
        'user-123',
        SubscriptionPlan.FREE,
      );

      expect(result).toEqual({
        allowed: true,
        limit: 10,
        remaining: 9,
        resetAfterSeconds: 60,
        retryAfterSeconds: 0,
      });

      expect(mockCacheService.consumeSlidingWindow).toHaveBeenCalledWith(
        expect.stringMatching(/^rate-limit:v2:user:user-123$/),
        expect.any(Number),
        60000,
        10,
        expect.any(String),
      );
    });

    it('should block a request when the sliding-window limit is exceeded', async () => {
      mockCacheService.consumeSlidingWindow.mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetAfterSeconds: 35,
        retryAfterSeconds: 35,
      });

      const result = await service.consumeSlidingWindow(
        'user-123',
        SubscriptionPlan.FREE,
      );

      expect(result).toEqual({
        allowed: false,
        limit: 10,
        remaining: 0,
        resetAfterSeconds: 35,
        retryAfterSeconds: 35,
      });
    });

    it('should use the PRO plan configuration', async () => {
      mockCacheService.consumeSlidingWindow.mockResolvedValue({
        allowed: true,
        remaining: 599,
        resetAfterSeconds: 60,
        retryAfterSeconds: 0,
      });

      const result = await service.consumeSlidingWindow(
        'user-456',
        SubscriptionPlan.PRO,
      );

      expect(result.limit).toBe(600);

      expect(mockConfigService.getOrThrow).toHaveBeenCalledWith(
        'rateLimit.plans.PRO',
      );
    });

    it('should use the ENTERPRISE plan configuration', async () => {
      mockCacheService.consumeSlidingWindow.mockResolvedValue({
        allowed: true,
        remaining: 2999,
        resetAfterSeconds: 60,
        retryAfterSeconds: 0,
      });

      const result = await service.consumeSlidingWindow(
        'user-789',
        SubscriptionPlan.ENTERPRISE,
      );

      expect(result.limit).toBe(3000);

      expect(mockConfigService.getOrThrow).toHaveBeenCalledWith(
        'rateLimit.plans.ENTERPRISE',
      );
    });

    it('should record an allowed user rate-limit metric', async () => {
      mockCacheService.consumeSlidingWindow.mockResolvedValue({
        allowed: true,
        remaining: 9,
        resetAfterSeconds: 60,
        retryAfterSeconds: 0,
      });

      await service.consumeSlidingWindow('user-123', SubscriptionPlan.FREE);

      expect(mockMetricsService.rateLimitAllowed.labels).toHaveBeenCalledWith(
        'user',
        SubscriptionPlan.FREE,
      );

      expect(mockAllowedMetricIncrement).toHaveBeenCalled();
    });

    it('should record a blocked user rate-limit metric', async () => {
      mockCacheService.consumeSlidingWindow.mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetAfterSeconds: 30,
        retryAfterSeconds: 30,
      });

      await service.consumeSlidingWindow('user-123', SubscriptionPlan.FREE);

      expect(mockMetricsService.rateLimitBlocked.labels).toHaveBeenCalledWith(
        'user',
        SubscriptionPlan.FREE,
      );

      expect(mockBlockedMetricIncrement).toHaveBeenCalled();
    });

    it('should propagate sliding-window Redis errors', async () => {
      mockCacheService.consumeSlidingWindow.mockRejectedValue(
        new Error('Redis connection failed'),
      );

      await expect(
        service.consumeSlidingWindow('user-123', SubscriptionPlan.FREE),
      ).rejects.toThrow('Redis connection failed');
    });
  });

  describe('Sliding-window IP rate limiting', () => {
    it('should allow an IP request within the sliding-window limit', async () => {
      mockCacheService.consumeSlidingWindow.mockResolvedValue({
        allowed: true,
        remaining: 4,
        resetAfterSeconds: 60,
        retryAfterSeconds: 0,
      });

      const result = await service.consumeByIpSlidingWindow(
        '192.168.1.10',
        'login',
        5,
        60,
      );

      expect(result).toEqual({
        allowed: true,
        limit: 5,
        remaining: 4,
        resetAfterSeconds: 60,
        retryAfterSeconds: 0,
      });
    });

    it('should block an IP request when the sliding-window limit is exceeded', async () => {
      mockCacheService.consumeSlidingWindow.mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetAfterSeconds: 25,
        retryAfterSeconds: 25,
      });

      const result = await service.consumeByIpSlidingWindow(
        '192.168.1.10',
        'login',
        5,
        60,
      );

      expect(result).toEqual({
        allowed: false,
        limit: 5,
        remaining: 0,
        resetAfterSeconds: 25,
        retryAfterSeconds: 25,
      });
    });

    it('should record an allowed IP rate-limit metric', async () => {
      mockCacheService.consumeSlidingWindow.mockResolvedValue({
        allowed: true,
        remaining: 4,
        resetAfterSeconds: 60,
        retryAfterSeconds: 0,
      });

      await service.consumeByIpSlidingWindow('192.168.1.10', 'login', 5);

      expect(mockMetricsService.rateLimitAllowed.labels).toHaveBeenCalledWith(
        'ip',
        'UNKNOWN',
      );

      expect(mockAllowedMetricIncrement).toHaveBeenCalled();
    });

    it('should record a blocked IP rate-limit metric', async () => {
      mockCacheService.consumeSlidingWindow.mockResolvedValue({
        allowed: false,
        remaining: 0,
        resetAfterSeconds: 30,
        retryAfterSeconds: 30,
      });

      await service.consumeByIpSlidingWindow('192.168.1.10', 'login', 5);

      expect(mockMetricsService.rateLimitBlocked.labels).toHaveBeenCalledWith(
        'ip',
        'UNKNOWN',
      );

      expect(mockBlockedMetricIncrement).toHaveBeenCalled();
    });

    it('should hash IP addresses before using them in sliding-window Redis keys', async () => {
      const { createHash } = await import('node:crypto');

      mockCacheService.consumeSlidingWindow.mockResolvedValue({
        allowed: true,
        remaining: 4,
        resetAfterSeconds: 60,
        retryAfterSeconds: 0,
      });

      const ip = '192.168.1.10';
      const expectedHash = createHash('sha256').update(ip).digest('hex');

      await service.consumeByIpSlidingWindow(ip, 'login', 5);

      expect(mockCacheService.consumeSlidingWindow).toHaveBeenCalledWith(
        `rate-limit:v2:ip:login:${expectedHash}`,
        expect.any(Number),
        60000,
        5,
        expect.any(String),
      );
    });

    it('should propagate sliding-window IP Redis errors', async () => {
      mockCacheService.consumeSlidingWindow.mockRejectedValue(
        new Error('Redis connection failed'),
      );

      await expect(
        service.consumeByIpSlidingWindow('192.168.1.10', 'login', 5),
      ).rejects.toThrow('Redis connection failed');
    });
  });
});
