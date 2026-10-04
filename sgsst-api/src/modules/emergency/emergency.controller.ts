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
import { EmergencyService } from './emergency.service';
import {
  CreateEmergencyBrigadeDto,
  CreateEmergencyBrigadeMemberDto,
  CreateEmergencyDrillDto,
  CreateEmergencyDrillFindingDto,
  CreateEmergencyPlanDto,
  CreateEmergencyResourceDto,
  CreateEmergencyThreatDto,
  EmergencyBrigadeListQueryDto,
  EmergencyDrillListQueryDto,
  EmergencyPlanListQueryDto,
  UpdateEmergencyBrigadeDto,
  UpdateEmergencyBrigadeMemberDto,
  UpdateEmergencyDrillDto,
  UpdateEmergencyDrillFindingDto,
  UpdateEmergencyPlanDto,
  UpdateEmergencyResourceDto,
  UpdateEmergencyThreatDto,
} from './dto/emergency.dto';

/**
 * S12: emergencias. Brigadas por sede (#31), planes por sede (#32) y
 * simulacros con hallazgos/acciones (#33). Lectura ADMIN/SST/AUDITOR/EMPLOYEE
 * (la informacion de evacuacion es de interes del trabajador); gestion
 * ADMIN/SST. SUPER_ADMIN pasa por el guard.
 */
const READ_ROLES = ['ADMIN', 'SST', 'AUDITOR', 'EMPLOYEE'] as const;
const MANAGE_ROLES = ['ADMIN', 'SST'] as const;

@ApiTags('emergency-brigades')
@ApiBearerAuth()
@Controller('emergency-brigades')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmergencyBrigadesController {
  constructor(private readonly service: EmergencyService) {}

  @Get()
  @Roles(...READ_ROLES)
  findMany(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: EmergencyBrigadeListQueryDto,
  ) {
    return this.service.findBrigades(user, query);
  }

  @Get(':id')
  @Roles(...READ_ROLES)
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findOneBrigade(user, id);
  }

  @Post()
  @Roles(...MANAGE_ROLES)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateEmergencyBrigadeDto,
  ) {
    return this.service.createBrigade(user, dto);
  }

  @Patch(':id')
  @Roles(...MANAGE_ROLES)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmergencyBrigadeDto,
  ) {
    return this.service.updateBrigade(user, id, dto);
  }

  @Delete(':id')
  @Roles(...MANAGE_ROLES)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.removeBrigade(user, id);
  }

  @Get(':id/members')
  @Roles(...READ_ROLES)
  findMembers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findBrigadeMembers(user, id);
  }

  @Post(':id/members')
  @Roles(...MANAGE_ROLES)
  createMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateEmergencyBrigadeMemberDto,
  ) {
    return this.service.createBrigadeMember(user, id, dto);
  }

  @Patch(':id/members/:memberId')
  @Roles(...MANAGE_ROLES)
  updateMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: UpdateEmergencyBrigadeMemberDto,
  ) {
    return this.service.updateBrigadeMember(user, id, memberId, dto);
  }

  @Delete(':id/members/:memberId')
  @Roles(...MANAGE_ROLES)
  removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    return this.service.removeBrigadeMember(user, id, memberId);
  }
}

@ApiTags('emergency-plans')
@ApiBearerAuth()
@Controller('emergency-plans')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmergencyPlansController {
  constructor(private readonly service: EmergencyService) {}

  @Get()
  @Roles(...READ_ROLES)
  findMany(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: EmergencyPlanListQueryDto,
  ) {
    return this.service.findPlans(user, query);
  }

  @Get(':id')
  @Roles(...READ_ROLES)
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findOnePlan(user, id);
  }

  @Post()
  @Roles(...MANAGE_ROLES)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateEmergencyPlanDto,
  ) {
    return this.service.createPlan(user, dto);
  }

  @Patch(':id')
  @Roles(...MANAGE_ROLES)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmergencyPlanDto,
  ) {
    return this.service.updatePlan(user, id, dto);
  }

  @Delete(':id')
  @Roles(...MANAGE_ROLES)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.removePlan(user, id);
  }

  // --- Amenazas ----------------------------------------------------------------

  @Post(':id/threats')
  @Roles(...MANAGE_ROLES)
  createThreat(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateEmergencyThreatDto,
  ) {
    return this.service.createThreat(user, id, dto);
  }

  @Patch(':id/threats/:threatId')
  @Roles(...MANAGE_ROLES)
  updateThreat(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('threatId', ParseUUIDPipe) threatId: string,
    @Body() dto: UpdateEmergencyThreatDto,
  ) {
    return this.service.updateThreat(user, id, threatId, dto);
  }

  @Delete(':id/threats/:threatId')
  @Roles(...MANAGE_ROLES)
  removeThreat(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('threatId', ParseUUIDPipe) threatId: string,
  ) {
    return this.service.removeThreat(user, id, threatId);
  }

  // --- Recursos ------------------------------------------------------------------

  @Post(':id/resources')
  @Roles(...MANAGE_ROLES)
  createResource(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateEmergencyResourceDto,
  ) {
    return this.service.createResource(user, id, dto);
  }

  @Patch(':id/resources/:resourceId')
  @Roles(...MANAGE_ROLES)
  updateResource(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('resourceId', ParseUUIDPipe) resourceId: string,
    @Body() dto: UpdateEmergencyResourceDto,
  ) {
    return this.service.updateResource(user, id, resourceId, dto);
  }

  @Delete(':id/resources/:resourceId')
  @Roles(...MANAGE_ROLES)
  removeResource(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('resourceId', ParseUUIDPipe) resourceId: string,
  ) {
    return this.service.removeResource(user, id, resourceId);
  }
}

@ApiTags('emergency-drills')
@ApiBearerAuth()
@Controller('emergency-drills')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmergencyDrillsController {
  constructor(private readonly service: EmergencyService) {}

  @Get()
  @Roles(...READ_ROLES)
  findMany(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: EmergencyDrillListQueryDto,
  ) {
    return this.service.findDrills(user, query);
  }

  @Get(':id')
  @Roles(...READ_ROLES)
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findOneDrill(user, id);
  }

  @Post()
  @Roles(...MANAGE_ROLES)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateEmergencyDrillDto,
  ) {
    return this.service.createDrill(user, dto);
  }

  @Patch(':id')
  @Roles(...MANAGE_ROLES)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmergencyDrillDto,
  ) {
    return this.service.updateDrill(user, id, dto);
  }

  @Delete(':id')
  @Roles(...MANAGE_ROLES)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.removeDrill(user, id);
  }

  @Post(':id/findings')
  @Roles(...MANAGE_ROLES)
  createFinding(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateEmergencyDrillFindingDto,
  ) {
    return this.service.createFinding(user, id, dto);
  }

  @Patch(':id/findings/:findingId')
  @Roles(...MANAGE_ROLES)
  updateFinding(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('findingId', ParseUUIDPipe) findingId: string,
    @Body() dto: UpdateEmergencyDrillFindingDto,
  ) {
    return this.service.updateFinding(user, id, findingId, dto);
  }

  @Delete(':id/findings/:findingId')
  @Roles(...MANAGE_ROLES)
  removeFinding(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('findingId', ParseUUIDPipe) findingId: string,
  ) {
    return this.service.removeFinding(user, id, findingId);
  }
}
