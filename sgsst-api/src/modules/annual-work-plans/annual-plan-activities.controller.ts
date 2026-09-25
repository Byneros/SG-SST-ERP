import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { CreateAnnualPlanActivityDto } from './dto/annual-plan-activity.dto';
import { UpdateAnnualPlanActivityDto } from './dto/annual-plan-activity.dto';
import { AnnualPlanActivitiesService } from './annual-plan-activities.service';

@ApiTags('annual-work-plans')
@ApiBearerAuth()
@Controller('annual-work-plans/:planId/activities')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnnualPlanActivitiesController {
  constructor(private readonly service: AnnualPlanActivitiesService) {}

  @Get()
  @Roles('ADMIN', 'SST', 'AUDITOR', 'EMPLOYEE')
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Param('planId', ParseUUIDPipe) planId: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.service.findAll(user, planId, companyId);
  }

  @Get(':id')
  @Roles('ADMIN', 'SST', 'AUDITOR', 'EMPLOYEE')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('planId', ParseUUIDPipe) planId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findOne(user, planId, id);
  }

  @Post()
  @Roles('ADMIN', 'SST')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('planId', ParseUUIDPipe) planId: string,
    @Body() dto: CreateAnnualPlanActivityDto,
  ) {
    return this.service.create(user, planId, dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SST')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('planId', ParseUUIDPipe) planId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAnnualPlanActivityDto,
  ) {
    return this.service.update(user, planId, id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'SST')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('planId', ParseUUIDPipe) planId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.remove(user, planId, id);
  }
}
