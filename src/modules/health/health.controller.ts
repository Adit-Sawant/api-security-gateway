import { Controller, Get, Res } from '@nestjs/common';

import type { Response } from 'express';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  // Liveness: Is the application running?
  @Get('live')
  checkLiveness() {
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
    };
  }

  // Readiness: Are dependencies available?
  @Get('ready')
  async checkReadiness(@Res() response: Response) {
    const result = await this.healthService.checkReadiness();

    return response.status(result.status === 'ready' ? 200 : 503).json(result);
  }
}
