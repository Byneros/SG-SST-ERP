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
  CreateUnplannedFindingDto,
  CreateUnplannedInspectionDto,
  UpdateUnplannedFindingDto,
  UpdateUnplannedInspectionDto,
} from './dto/unplanned-inspection.dto';
import { UnplannedInspectionsService } from './unplanned-inspections.service';

@ApiTags('unplanned-inspections')
@ApiBearerAuth()
@Controller('unplanned-inspections')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UnplannedInspectionsController {
  constructor(private readonly service: UnplannedInspectionsService) {}

  @Get()
  @Roles('ADMIN', 'SST', 'AUDITOR', 'EMPLOYEE')
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('siteId') siteId?: string,
  ) {
    return this.service.findAll(user, siteId);
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
    @Body() dto: CreateUnplannedInspectionDto,
  ) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SST')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUnplannedInspectionDto,
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

  /** Hallazgo con opcion de generar riesgo GTC-45 (riskLevel). */
  @Post(':id/findings')
  @Roles('ADMIN', 'SST', 'AUDITOR')
  addFinding(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateUnplannedFindingDto,
  ) {
    return this.service.addFinding(user, id, dto);
  }

  @Patch('findings/:findingId')
  @Roles('ADMIN', 'SST', 'AUDITOR')
  updateFinding(
    @CurrentUser() user: AuthenticatedUser,
    @Param('findingId', ParseUUIDPipe) findingId: string,
    @Body() dto: UpdateUnplannedFindingDto,
  ) {
    return this.service.updateFinding(user, findingId, dto);
  }

  /** Accion correctiva desde hallazgo. */
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
