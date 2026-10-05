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
import { FindingsService } from './findings.service';
import {
  CreateFindingCauseDto,
  CreateFindingDto,
  FindingsListQueryDto,
  UpdateFindingDto,
} from './dto/finding.dto';

/**
 * Hallazgos unificados (S15.1). Lectura para ADMIN/SST/AUDITOR; gestion
 * (crear/editar/cerrar/borrar y causas) para ADMIN/SST.
 */
@ApiTags('findings')
@ApiBearerAuth()
@Controller('findings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FindingsController {
  constructor(private readonly service: FindingsService) {}

  @Get()
  @Roles('ADMIN', 'SST', 'AUDITOR')
  findMany(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: FindingsListQueryDto,
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
    @Body() dto: CreateFindingDto,
  ) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SST')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFindingDto,
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

  @Post(':id/causes')
  @Roles('ADMIN', 'SST')
  addCause(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateFindingCauseDto,
  ) {
    return this.service.addCause(user, id, dto);
  }

  @Delete(':id/causes/:causeId')
  @Roles('ADMIN', 'SST')
  removeCause(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('causeId', ParseUUIDPipe) causeId: string,
  ) {
    return this.service.removeCause(user, id, causeId);
  }
}
