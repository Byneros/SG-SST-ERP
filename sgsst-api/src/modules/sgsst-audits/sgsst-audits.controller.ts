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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { CreateCorrectiveActionDto } from './dto/create-corrective-action.dto';
import { CreateFindingDto } from './dto/create-finding.dto';
import { CreateSgsstAuditDto } from './dto/create-sgsst-audit.dto';
import { UpdateCorrectiveActionDto } from './dto/update-corrective-action.dto';
import { UpdateFindingDto } from './dto/update-finding.dto';
import { UpdateSgsstAuditDto } from './dto/update-sgsst-audit.dto';
import { SgsstAuditsService } from './SgsstAuditsService';

@Controller('sgsst-audits')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SgsstAuditsController {
  constructor(private readonly service: SgsstAuditsService) {}

  @Get()
  @Roles('ADMIN', 'SST', 'AUDITOR', 'EMPLOYEE')
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListQueryDto,
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
  @Roles('ADMIN', 'SST', 'AUDITOR')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSgsstAuditDto,
  ) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SST', 'AUDITOR')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSgsstAuditDto,
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
  createFinding(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateFindingDto,
  ) {
    return this.service.createFinding(user, id, dto);
  }

  @Patch('findings/:id')
  @Roles('ADMIN', 'SST', 'AUDITOR')
  updateFinding(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFindingDto,
  ) {
    return this.service.updateFinding(user, id, dto);
  }

  @Post('findings/:id/actions')
  @Roles('ADMIN', 'SST', 'AUDITOR')
  createAction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCorrectiveActionDto,
  ) {
    return this.service.createAction(user, id, dto);
  }

  @Patch('actions/:id')
  @Roles('ADMIN', 'SST', 'AUDITOR')
  updateAction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCorrectiveActionDto,
  ) {
    return this.service.updateAction(user, id, dto);
  }
}
