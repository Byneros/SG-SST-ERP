import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { CreateIndicatorDto } from './dto/create-indicator.dto';
import { IndicatorListQueryDto } from './dto/indicator-list-query.dto';
import {
  AddIndicatorMeasurementsDto,
  SetIndicatorTargetsDto,
} from './dto/indicator-targets.dto';
import { UpdateIndicatorDto } from './dto/update-indicator.dto';
import { IndicatorsService } from './indicators.service';

@ApiTags('indicators')
@ApiBearerAuth()
@Controller('indicators')
@UseGuards(JwtAuthGuard, RolesGuard)
export class IndicatorsController {
  constructor(private readonly service: IndicatorsService) {}

  @Get()
  @Roles('ADMIN', 'SST', 'AUDITOR', 'EMPLOYEE')
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: IndicatorListQueryDto,
    @Query('companyId') companyId?: string,
  ) {
    return this.service.findAll(user, query, companyId);
  }

  @Get(':id')
  @Roles('ADMIN', 'SST', 'AUDITOR', 'EMPLOYEE')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findOne(user, id);
  }

  @Post()
  @Roles('ADMIN', 'SST')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateIndicatorDto,
  ) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SST')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateIndicatorDto,
  ) {
    return this.service.update(user, id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'SST')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.remove(user, id);
  }

  @Put(':id/targets')
  @Roles('ADMIN', 'SST')
  setTargets(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetIndicatorTargetsDto,
  ) {
    return this.service.setTargets(user, id, dto);
  }

  @Post(':id/measurements')
  @Roles('ADMIN', 'SST', 'AUDITOR')
  addMeasurements(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddIndicatorMeasurementsDto,
  ) {
    return this.service.addMeasurements(user, id, dto);
  }
}
