import { Module } from '@nestjs/common';
import { PrismaModule } from '../infrastructure/database/prisma.module';
import { PrismaUserRepository } from './infrastructure/prisma-user.repository';
import { UsersController } from './users.controller';
import { USER_REPOSITORY } from './users.constants';
import { RateLimitingModule } from '../rate-limiter/rate-limiter.module';

@Module({
  imports: [PrismaModule, RateLimitingModule],

  controllers: [UsersController],

  providers: [
    {
      provide: USER_REPOSITORY,
      useClass: PrismaUserRepository,
    },
  ],

  exports: [USER_REPOSITORY],
})
export class UsersModule {}
