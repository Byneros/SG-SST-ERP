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
import {
  CreateHazardControlDto,
  CreateLinkedRiskDto,
  CreateRiskActivityDto,
  CreateRiskHazardDto,
  CreateRiskProcessDto,
  UpdateHazardControlDto,
  UpdateRiskActivityDto,
  UpdateRiskHazardDto,
  UpdateRiskProcessDto,
  UpsertValoracionDto,
} from './dto/risk-matrix.dto';
import { RiskMatrixService } from './risk-matrix.service';

/** Matriz de riesgos GTC-45 estructurada (#57):
 *  Proceso → Actividad → Peligro → Valoración → Controles → Risk (resultado). */
@ApiTags('risk-matrix')
@ApiBearerAuth()
@Controller('risk-matrix')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RiskMatrixController {
  constructor(private readonly service: RiskMatrixService) {}

  /** Árbol completo del tenant (ADMIN/SST/AUDITOR/EMPLOYEE). */
  @Get()
  @Roles('ADMIN', 'SST', 'AUDITOR', 'EMPLOYEE')
  tree(
    @CurrentUser() user: AuthenticatedUser,
    @Query('companyId') companyId?: string,
  ) {
    return this.service.tree(user, companyId);
  }

  //----- procesos ------------------------------------------------------------
  @Post('processes')
  @Roles('ADMIN', 'SST')
  createProcess(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRiskProcessDto,
  ) {
    return this.service.createProcess(user, dto);
  }

  @Patch('processes/:id')
  @Roles('ADMIN', 'SST')
  updateProcess(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRiskProcessDto,
  ) {
    return this.service.updateProcess(user, id, dto);
  }

  @Delete('processes/:id')
  @Roles('ADMIN', 'SST')
  deleteProcess(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.deleteProcess(user, id);
  }

  //----- actividades -----------------------------------------------------------
  @Post('processes/:processId/activities')
  @Roles('ADMIN', 'SST')
  createActivity(
    @CurrentUser() user: AuthenticatedUser,
    @Param('processId', ParseUUIDPipe) processId: string,
    @Body() dto: CreateRiskActivityDto,
  ) {
    return this.service.createActivity(user, processId, dto);
  }

  @Patch('activities/:id')
  @Roles('ADMIN', 'SST')
  updateActivity(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRiskActivityDto,
  ) {
    return this.service.updateActivity(user, id, dto);
  }

  @Delete('activities/:id')
  @Roles('ADMIN', 'SST')
  deleteActivity(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.deleteActivity(user, id);
  }

  //----- peligros -------------------------------------------------------------
  @Post('activities/:activityId/hazards')
  @Roles('ADMIN', 'SST')
  createHazard(
    @CurrentUser() user: AuthenticatedUser,
    @Param('activityId', ParseUUIDPipe) activityId: string,
    @Body() dto: CreateRiskHazardDto,
  ) {
    return this.service.createHazard(user, activityId, dto);
  }

  @Patch('hazards/:id')
  @Roles('ADMIN', 'SST')
  updateHazard(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRiskHazardDto,
  ) {
    return this.service.updateHazard(user, id, dto);
  }

  @Delete('hazards/:id')
  @Roles('ADMIN', 'SST')
  deleteHazard(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.deleteHazard(user, id);
  }

  //----- valoración (1:1, nivel derivado) -------------------------------------
  @Put('hazards/:hazardId/valoracion')
  @Roles('ADMIN', 'SST')
  upsertValoracion(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hazardId', ParseUUIDPipe) hazardId: string,
    @Body() dto: UpsertValoracionDto,
  ) {
    return this.service.upsertValoracion(user, hazardId, dto);
  }

  //----- controles --------------------------------------------------------------
  @Post('hazards/:hazardId/controls')
  @Roles('ADMIN', 'SST')
  createControl(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hazardId', ParseUUIDPipe) hazardId: string,
    @Body() dto: CreateHazardControlDto,
  ) {
    return this.service.createControl(user, hazardId, dto);
  }

  @Patch('controls/:id')
  @Roles('ADMIN', 'SST')
  updateControl(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateHazardControlDto,
  ) {
    return this.service.updateControl(user, id, dto);
  }

  @Delete('controls/:id')
  @Roles('ADMIN', 'SST')
  deleteControl(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.deleteControl(user, id);
  }

  //----- riesgo vinculado (resultado final) -----------------------------------
  @Post('hazards/:hazardId/risk')
  @Roles('ADMIN', 'SST')
  createLinkedRisk(
    @CurrentUser() user: AuthenticatedUser,
    @Param('hazardId', ParseUUIDPipe) hazardId: string,
    @Body() dto: CreateLinkedRiskDto,
  ) {
    return this.service.createLinkedRisk(user, hazardId, dto);
  }
}
