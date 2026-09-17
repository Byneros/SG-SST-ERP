import { Controller, Get } from '@nestjs/common';
import {
  AppService,
  type HealthResponse,
  type ReadinessResponse,
} from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHealth(): HealthResponse {
    return this.appService.getHealth();
  }

  @Get('health')
  getDetailedHealth(): HealthResponse {
    return this.appService.getHealth();
  }

  @Get('ready')
  getReadiness(): Promise<ReadinessResponse> {
    return this.appService.getReadiness();
  }
}
