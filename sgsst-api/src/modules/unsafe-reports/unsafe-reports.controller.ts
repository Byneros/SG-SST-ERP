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
import {
  CreateCorrectiveActionDto,
  CreateUnsafeFindingDto,
  CreateUnsafeReportDto,
  UpdateUnsafeReportDto,
} from './dto/unsafe-report.dto';
import { UnsafeReportsService } from './unsafe-reports.service';

@ApiTags('unsafe-reports')
@ApiBearerAuth()
@Controller('unsafe-reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UnsafeReportsController {
  constructor(private readonly service: UnsafeReportsService) {}

  @Get()
  @Roles('ADMIN', 'SST', 'AUDITOR', 'EMPLOYEE')
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('kind') kind?: string,
    @Query('status') status?: string,
  ) {
    return this.service.findAll(user, kind, status);
  }

  @Get(':id')
  @Roles('ADMIN', 'SST', 'AUDITOR', 'EMPLOYEE')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findOne(user, id);
  }

  /** Reporte directo: cualquier rol puede reportar (canal de participacion). */
  @Post()
  @Roles('ADMIN', 'SST', 'AUDITOR', 'EMPLOYEE')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateUnsafeReportDto,
  ) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SST')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUnsafeReportDto,
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

  @Post(':id/findings')
  @Roles('ADMIN', 'SST', 'AUDITOR')
  addFinding(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateUnsafeFindingDto,
  ) {
    return this.service.addFinding(user, id, dto);
  }

  /** Accion correctiva/educativa desde hallazgo del reporte. */
  @Post('findings/:findingId/actions')
  @Roles('ADMIN', 'SST')
  addCorrectiveAction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('findingId', ParseUUIDPipe) findingId: string,
    @Body() dto: CreateCorrectiveActionDto,
  ) {
    return this.service.addCorrectiveAction(user, findingId, dto);
  }
}
