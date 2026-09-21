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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { CreateCorrectiveActionDto } from './dto/create-corrective-action.dto';
import { CreateFindingDto } from './dto/create-finding.dto';
import { CreateSgsstAuditDto } from './dto/create-sgsst-audit.dto';
import { CreateAuditProgramDto } from './dto/create-audit-program.dto';
import { ReplaceAuditChecklistDto } from './dto/replace-audit-checklist.dto';
import { UpdateAuditChecklistItemDto } from './dto/update-audit-checklist-item.dto';
import { UpdateAuditProgramDto } from './dto/update-audit-program.dto';
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

  // ----- FASE 7.1: programas de auditoría -----------------------------------

  @Get('programs')
  @Roles('ADMIN', 'SST', 'AUDITOR', 'EMPLOYEE')
  findPrograms(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListQueryDto,
    @Query('companyId') companyId?: string,
  ) {
    return this.service.findPrograms(user, query, companyId);
  }

  @Get('programs/:id')
  @Roles('ADMIN', 'SST', 'AUDITOR', 'EMPLOYEE')
  findProgramById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findProgramById(user, id);
  }

  @Post('programs')
  @Roles('ADMIN', 'SST', 'AUDITOR')
  createProgram(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAuditProgramDto,
  ) {
    return this.service.createProgram(user, dto);
  }

  @Patch('programs/:id')
  @Roles('ADMIN', 'SST', 'AUDITOR')
  updateProgram(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAuditProgramDto,
  ) {
    return this.service.updateProgram(user, id, dto);
  }

  @Delete('programs/:id')
  @Roles('ADMIN', 'SST')
  removeProgram(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.removeProgram(user, id);
  }

  // ----- FASE 7.1: checklist de auditoría -----------------------------------

  @Get(':id/checklist')
  @Roles('ADMIN', 'SST', 'AUDITOR', 'EMPLOYEE')
  findChecklist(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findChecklist(user, id);
  }

  @Put(':id/checklist')
  @Roles('ADMIN', 'SST', 'AUDITOR')
  replaceChecklist(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReplaceAuditChecklistDto,
  ) {
    return this.service.replaceChecklist(user, id, dto);
  }

  @Patch('checklist/:id')
  @Roles('ADMIN', 'SST', 'AUDITOR')
  updateChecklistItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAuditChecklistItemDto,
  ) {
    return this.service.updateChecklistItem(user, id, dto);
  }
}
