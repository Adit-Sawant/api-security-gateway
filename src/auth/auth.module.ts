import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import type { JwtModuleOptions } from '@nestjs/jwt';
import type { StringValue } from 'ms';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { BcryptPasswordHasher } from './infrastructure/bcrypt-password-hasher';
import { PASSWORD_HASHER } from './auth.constants';
import { RateLimitingModule } from '../rate-limiter/rate-limiter.module';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    RateLimitingModule,

    JwtModule.registerAsync({
      inject: [ConfigService],

      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),

        signOptions: {
          expiresIn: config.getOrThrow<string>('JWT_EXPIRES_IN') as StringValue,
        },
      }),
    }),

    UsersModule,
  ],

  controllers: [AuthController],

  providers: [
    AuthService,
    JwtStrategy,

    {
      provide: PASSWORD_HASHER,
      useClass: BcryptPasswordHasher,
    },
  ],
})
export class AuthModule {}
