import { Test, TestingModule } from '@nestjs/testing';

import { AppController } from './app.controller';
import { CACHE_SERVICE } from './infrastructure/redis/redis.constants';

describe('AppController', () => {
  let appController: AppController;

  const mockCacheService = {
    ping: jest.fn(),
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: CACHE_SERVICE,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('root', () => {
    it('should return the gateway running message', () => {
      expect(appController.getHello()).toBe('API Security Gateway is running!');
    });
  });

  describe('redis-health', () => {
    it('should return successful Redis health response', async () => {
      mockCacheService.ping.mockResolvedValue('PONG');

      await expect(appController.checkRedis()).resolves.toEqual({
        status: 'success',
        message: 'Redis connection established',
        redisResponse: 'PONG',
      });

      expect(mockCacheService.ping).toHaveBeenCalledTimes(1);
    });
  });
});
