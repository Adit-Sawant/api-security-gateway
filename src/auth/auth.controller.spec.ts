import { Test, TestingModule } from '@nestjs/testing';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { IpRateLimitGuard } from '../rate-limiter/guards/ip-rate-limit.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

describe('AuthController', () => {
  let controller: AuthController;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
  };

  const registerDto = {
    name: 'Test User',
    email: 'test@example.com',
    password: 'Password@123',
  };

  const loginDto = {
    email: 'test@example.com',
    password: 'Password@123',
  };

  const mockUser = {
    id: 'user-123',
    name: 'Test User',
    email: 'test@example.com',
    roles: ['USER'],
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    })
      .overrideGuard(IpRateLimitGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe('Controller initialization', () => {
    it('should be defined', () => {
      expect(controller).toBeDefined();
    });
  });

  describe('register()', () => {
    it('should register a user successfully', async () => {
      const expectedResult = {
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com',
      };

      mockAuthService.register.mockResolvedValue(expectedResult);

      const result = await controller.register(registerDto);

      expect(result).toEqual(expectedResult);
    });

    it('should pass registration DTO to AuthService', async () => {
      mockAuthService.register.mockResolvedValue({});

      await controller.register(registerDto);

      expect(mockAuthService.register).toHaveBeenCalledWith(registerDto);
      expect(mockAuthService.register).toHaveBeenCalledTimes(1);
    });

    it('should propagate registration errors', async () => {
      mockAuthService.register.mockRejectedValue(
        new Error('Registration failed'),
      );

      await expect(controller.register(registerDto)).rejects.toThrow(
        'Registration failed',
      );
    });
  });

  describe('login()', () => {
    it('should login successfully', async () => {
      const expectedResult = {
        accessToken: 'mock-access-token',
        user: mockUser,
      };

      mockAuthService.login.mockResolvedValue(expectedResult);

      const result = await controller.login(loginDto);

      expect(result).toEqual(expectedResult);
    });

    it('should pass login DTO to AuthService', async () => {
      mockAuthService.login.mockResolvedValue({});

      await controller.login(loginDto);

      expect(mockAuthService.login).toHaveBeenCalledWith(loginDto);
      expect(mockAuthService.login).toHaveBeenCalledTimes(1);
    });

    it('should propagate login errors', async () => {
      mockAuthService.login.mockRejectedValue(new Error('Login failed'));

      await expect(controller.login(loginDto)).rejects.toThrow('Login failed');
    });
  });

  describe('profile()', () => {
    it('should return the authenticated user profile', () => {
      const request = {
        user: mockUser,
      };

      const result = controller.profile(request);

      expect(result).toEqual(mockUser);
    });

    it('should return the exact user object from the request', () => {
      const request = {
        user: mockUser,
      };

      const result = controller.profile(request);

      expect(result).toBe(request.user);
    });

    it('should return undefined when request has no user', () => {
      const request = {};

      const result = controller.profile(request);

      expect(result).toBeUndefined();
    });
  });
});
