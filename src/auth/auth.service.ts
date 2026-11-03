import {
  Injectable,
  Inject,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';

import { JwtService } from '@nestjs/jwt';
import { USER_REPOSITORY } from '../users/users.constants';
import { Role } from '../common/enums/role.enum';
import type {
  IUserRepository,
  CreateUserData,
} from '../users/domain/user.repository.interface';

import { PASSWORD_HASHER } from './auth.constants';

import type { IPasswordHasher } from './domain/password-hasher.interface';

import type { RegisterDto } from './dto/register.dto';
import type { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly users: IUserRepository,

    @Inject(PASSWORD_HASHER)
    private readonly hasher: IPasswordHasher,

    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.users.findByEmail(dto.email);

    if (existing) {
      throw new ConflictException('Email already exists');
    }

    const passwordHash = await this.hasher.hash(dto.password);

    const user = await this.users.create({
      name: dto.name,
      email: dto.email,
      passwordHash,
      roles: [Role.USER],
    });

    return {
      id: user.id,
      name: user.name,
      email: user.email,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.users.findByEmail(dto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await this.hasher.compare(dto.password, user.passwordHash);

    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      email: user.email,
      roles: user.roles,
      subscriptionPlan: user.subscriptionPlan,
    });

    return {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        roles: user.roles,
      },
    };
  }
}
