import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConflictException, UnauthorizedException } from '@nestjs/common';

import { AuthService } from './auth.service';
import { USER_REPOSITORY } from '../users/users.constants';
import { PASSWORD_HASHER } from './auth.constants';
import { Role } from '../common/enums/role.enum';

describe('AuthService', () => {
  let service: AuthService;

  const mockUserRepository = {
    findByEmail: jest.fn(),
    create: jest.fn(),
  };

  const mockPasswordHasher = {
    hash: jest.fn(),
    compare: jest.fn(),
  };

  const mockJwtService = {
    signAsync: jest.fn(),
  };

  const mockUser = {
    id: 'user-123',
    name: 'Test User',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    roles: [Role.USER],
    subscriptionPlan: 'FREE',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: USER_REPOSITORY,
          useValue: mockUserRepository,
        },
        {
          provide: PASSWORD_HASHER,
          useValue: mockPasswordHasher,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('Service initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });

  describe('Registration', () => {
    const registerDto = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'Password@123',
    };

    it('should register a new user successfully', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);

      mockPasswordHasher.hash.mockResolvedValue('hashed-password');

      mockUserRepository.create.mockResolvedValue(mockUser);

      const result = await service.register(registerDto);

      expect(result).toEqual({
        id: 'user-123',
        name: 'Test User',
        email: 'test@example.com',
      });
    });

    it('should check whether the email already exists', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);

      mockPasswordHasher.hash.mockResolvedValue('hashed-password');

      mockUserRepository.create.mockResolvedValue(mockUser);

      await service.register(registerDto);

      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(
        'test@example.com',
      );
    });

    it('should hash the password before creating the user', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);

      mockPasswordHasher.hash.mockResolvedValue('hashed-password');

      mockUserRepository.create.mockResolvedValue(mockUser);

      await service.register(registerDto);

      expect(mockPasswordHasher.hash).toHaveBeenCalledWith('Password@123');

      expect(mockUserRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          passwordHash: 'hashed-password',
        }),
      );
    });

    it('should assign the USER role to a newly registered user', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);

      mockPasswordHasher.hash.mockResolvedValue('hashed-password');

      mockUserRepository.create.mockResolvedValue(mockUser);

      await service.register(registerDto);

      expect(mockUserRepository.create).toHaveBeenCalledWith({
        name: 'Test User',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        roles: [Role.USER],
      });
    });

    it('should throw ConflictException if email already exists', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );

      expect(mockPasswordHasher.hash).not.toHaveBeenCalled();

      expect(mockUserRepository.create).not.toHaveBeenCalled();
    });

    it('should propagate password hashing errors during registration', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);

      mockPasswordHasher.hash.mockRejectedValue(
        new Error('Password hashing failed'),
      );

      await expect(service.register(registerDto)).rejects.toThrow(
        'Password hashing failed',
      );

      expect(mockUserRepository.create).not.toHaveBeenCalled();
    });

    it('should propagate repository errors during registration', async () => {
      mockUserRepository.findByEmail.mockRejectedValue(
        new Error('Database connection failed'),
      );

      await expect(service.register(registerDto)).rejects.toThrow(
        'Database connection failed',
      );
    });
  });

  describe('Login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'Password@123',
    };

    it('should login successfully with valid credentials', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);

      mockPasswordHasher.compare.mockResolvedValue(true);

      mockJwtService.signAsync.mockResolvedValue('mock-access-token');

      const result = await service.login(loginDto);

      expect(result).toEqual({
        accessToken: 'mock-access-token',
        user: {
          id: 'user-123',
          name: 'Test User',
          email: 'test@example.com',
          roles: [Role.USER],
        },
      });
    });

    it('should throw UnauthorizedException if user does not exist', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(mockPasswordHasher.compare).not.toHaveBeenCalled();

      expect(mockJwtService.signAsync).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for an incorrect password', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);

      mockPasswordHasher.compare.mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(mockJwtService.signAsync).not.toHaveBeenCalled();
    });

    it('should verify the password using the stored password hash', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);

      mockPasswordHasher.compare.mockResolvedValue(true);

      mockJwtService.signAsync.mockResolvedValue('mock-access-token');

      await service.login(loginDto);

      expect(mockPasswordHasher.compare).toHaveBeenCalledWith(
        'Password@123',
        'hashed-password',
      );
    });

    it('should generate JWT with the correct user payload', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);

      mockPasswordHasher.compare.mockResolvedValue(true);

      mockJwtService.signAsync.mockResolvedValue('mock-access-token');

      await service.login(loginDto);

      expect(mockJwtService.signAsync).toHaveBeenCalledWith({
        sub: 'user-123',
        email: 'test@example.com',
        roles: [Role.USER],
        subscriptionPlan: 'FREE',
      });
    });

    it('should propagate JWT generation errors', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);

      mockPasswordHasher.compare.mockResolvedValue(true);

      mockJwtService.signAsync.mockRejectedValue(
        new Error('JWT generation failed'),
      );

      await expect(service.login(loginDto)).rejects.toThrow(
        'JWT generation failed',
      );
    });
  });
});
