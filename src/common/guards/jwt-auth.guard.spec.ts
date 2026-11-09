import { ExecutionContext } from '@nestjs/common';

const mockCanActivate = jest.fn();

jest.mock('@nestjs/passport', () => ({
  AuthGuard: jest.fn(() => {
    return class MockPassportAuthGuard {
      canActivate(...args: any[]) {
        return mockCanActivate(...args);
      }
    };
  }),
}));

import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  const mockContext = {} as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
    guard = new JwtAuthGuard();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow access when Passport returns true', () => {
    mockCanActivate.mockReturnValue(true);

    expect(guard.canActivate(mockContext)).toBe(true);
  });

  it('should deny access when Passport returns false', () => {
    mockCanActivate.mockReturnValue(false);

    expect(guard.canActivate(mockContext)).toBe(false);
  });

  it('should propagate Passport authentication errors', () => {
    mockCanActivate.mockImplementation(() => {
      throw new Error('Unauthorized');
    });

    expect(() => guard.canActivate(mockContext)).toThrow('Unauthorized');
  });

  it('should delegate authentication to the Passport guard', () => {
    mockCanActivate.mockReturnValue(true);

    guard.canActivate(mockContext);

    expect(mockCanActivate).toHaveBeenCalledWith(mockContext);
    expect(mockCanActivate).toHaveBeenCalledTimes(1);
  });
});
