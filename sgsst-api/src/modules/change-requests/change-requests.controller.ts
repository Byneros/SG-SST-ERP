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
import { ChangeRequestsService } from './change-requests.service';
import {
  AdvanceChangeRequestDto,
  ChangeRequestListQueryDto,
  CreateChangeRequestDto,
  UpdateChangeRequestDto,
} from './dto/change-request.dto';

/**
 * Gestion del cambio (S14). Lectura para los roles del SG-SST; mutaciones y
 * workflow para ADMIN/SST. AUDITOR consulta el workflow pero no lo mueve.
 */
@ApiTags('change-requests')
@ApiBearerAuth()
@Controller('change-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ChangeRequestsController {
  constructor(private readonly service: ChangeRequestsService) {}

  @Get()
  @Roles('ADMIN', 'SST', 'AUDITOR')
  findMany(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ChangeRequestListQueryDto,
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
    @Body() dto: CreateChangeRequestDto,
  ) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SST')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateChangeRequestDto,
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

  /** S14.2: avanza el workflow (solo a la etapa siguiente, con guardas). */
  @Post(':id/advance')
  @Roles('ADMIN', 'SST')
  advance(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdvanceChangeRequestDto,
  ) {
    return this.service.advance(user, id, dto);
  }
}
