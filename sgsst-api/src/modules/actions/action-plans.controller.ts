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
import { ActionPlansService } from './action-plans.service';
import {
  ActionsListQueryDto,
  AdvanceActionPlanDto,
  CreateActionPlanDto,
  UpdateActionPlanDto,
  VerifyActionPlanDto,
} from './dto/action-plan.dto';

/**
 * Plan de accion unificado (S15.2). Lectura para ADMIN/SST/AUDITOR; gestion
 * (CRUD, avance y verificacion) para ADMIN/SST.
 */
@ApiTags('actions')
@ApiBearerAuth()
@Controller('actions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ActionPlansController {
  constructor(private readonly service: ActionPlansService) {}

  @Get()
  @Roles('ADMIN', 'SST', 'AUDITOR')
  findMany(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ActionsListQueryDto,
  ) {
    return this.service.findMany(user, query);
  }

  @Get(':id')
  @Roles('ADMIN', 'SST', 'AUDITOR')
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
    @Body() dto: CreateActionPlanDto,
  ) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SST')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateActionPlanDto,
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

  /** S15.2: avanza el workflow (OPEN -> IN_PROGRESS -> DONE) con guardas. */
  @Post(':id/advance')
  @Roles('ADMIN', 'SST')
  advance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdvanceActionPlanDto,
  ) {
    return this.service.advance(user, id, dto);
  }

  /** S15.2: verificacion de eficacia (DONE -> VERIFIED) con sello y guardas. */
  @Post(':id/verify')
  @Roles('ADMIN', 'SST')
  verify(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VerifyActionPlanDto,
  ) {
    return this.service.verify(user, id, dto);
  }
}
