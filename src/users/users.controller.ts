import { Controller, Get, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { RateLimitGuard } from '../rate-limiter/rate-limit.guard';

@Controller('access')
@UseGuards(JwtAuthGuard, RolesGuard, RateLimitGuard)
export class UsersController {
  @Get('user')
  @Roles(Role.USER, Role.ADMIN)
  getUserAccess() {
    return {
      message: 'You have USER-level access',
    };
  }

  @Get('developer')
  @Roles(Role.DEVELOPER, Role.ADMIN)
  getDeveloperAccess() {
    return {
      message: 'You have DEVELOPER-level access',
    };
  }

  @Get('admin')
  @Roles(Role.ADMIN)
  getAdminAccess() {
    return {
      message: 'You have ADMIN-level access',
    };
  }
}
