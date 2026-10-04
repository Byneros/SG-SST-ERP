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
import { CommitteesService } from './committees.service';
import {
  CommitteeListQueryDto,
  CreateCommitteeCommitmentDto,
  CreateCommitteeDto,
  CreateCommitteeMeetingDto,
  CreateCommitteeMemberDto,
  UpdateCommitteeCommitmentDto,
  UpdateCommitteeDto,
  UpdateCommitteeMeetingDto,
  UpdateCommitteeMemberDto,
} from './dto/committee.dto';

/**
 * S11: comites del SG-SST (COPASST y Comite de Convivencia).
 * Lectura ADMIN/SST/AUDITOR/EMPLOYEE; gestion ADMIN/SST (mismo criterio que
 * contratistas). SUPER_ADMIN pasa por el guard.
 */
@ApiTags('committees')
@ApiBearerAuth()
@Controller('committees')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CommitteesController {
  constructor(private readonly service: CommitteesService) {}

  // --- Comites ---------------------------------------------------------------

  @Get()
  @Roles('ADMIN', 'SST', 'AUDITOR', 'EMPLOYEE')
  findMany(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: CommitteeListQueryDto,
  ) {
    return this.service.findMany(user, query);
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
    @Body() dto: CreateCommitteeDto,
  ) {
    return this.service.create(user, dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SST')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCommitteeDto,
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

  // --- Integrantes -----------------------------------------------------------

  @Get(':id/members')
  @Roles('ADMIN', 'SST', 'AUDITOR', 'EMPLOYEE')
  findMembers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findMembers(user, id);
  }

  @Post(':id/members')
  @Roles('ADMIN', 'SST')
  createMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCommitteeMemberDto,
  ) {
    return this.service.createMember(user, id, dto);
  }

  @Patch(':id/members/:memberId')
  @Roles('ADMIN', 'SST')
  updateMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body() dto: UpdateCommitteeMemberDto,
  ) {
    return this.service.updateMember(user, id, memberId, dto);
  }

  @Delete(':id/members/:memberId')
  @Roles('ADMIN', 'SST')
  removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    return this.service.removeMember(user, id, memberId);
  }

  // --- Reuniones / actas -------------------------------------------------------

  @Get(':id/meetings')
  @Roles('ADMIN', 'SST', 'AUDITOR', 'EMPLOYEE')
  findMeetings(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.findMeetings(user, id);
  }

  @Post(':id/meetings')
  @Roles('ADMIN', 'SST')
  createMeeting(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateCommitteeMeetingDto,
  ) {
    return this.service.createMeeting(user, id, dto);
  }

  @Patch(':id/meetings/:meetingId')
  @Roles('ADMIN', 'SST')
  updateMeeting(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
    @Body() dto: UpdateCommitteeMeetingDto,
  ) {
    return this.service.updateMeeting(user, id, meetingId, dto);
  }

  @Delete(':id/meetings/:meetingId')
  @Roles('ADMIN', 'SST')
  removeMeeting(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
  ) {
    return this.service.removeMeeting(user, id, meetingId);
  }

  // --- Compromisos ------------------------------------------------------------

  @Post('meetings/:meetingId/commitments')
  @Roles('ADMIN', 'SST')
  createCommitment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
    @Body() dto: CreateCommitteeCommitmentDto,
  ) {
    return this.service.createCommitment(user, meetingId, dto);
  }

  @Patch('meetings/:meetingId/commitments/:commitmentId')
  @Roles('ADMIN', 'SST')
  updateCommitment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
    @Param('commitmentId', ParseUUIDPipe) commitmentId: string,
    @Body() dto: UpdateCommitteeCommitmentDto,
  ) {
    return this.service.updateCommitment(user, meetingId, commitmentId, dto);
  }

  @Delete('meetings/:meetingId/commitments/:commitmentId')
  @Roles('ADMIN', 'SST')
  removeCommitment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('meetingId', ParseUUIDPipe) meetingId: string,
    @Param('commitmentId', ParseUUIDPipe) commitmentId: string,
  ) {
    return this.service.removeCommitment(user, meetingId, commitmentId);
  }

  // --- Seguimiento ------------------------------------------------------------

  /** Compromisos pendientes/vencidos del comite (seguimiento de acuerdos). */
  @Get(':id/follow-up')
  @Roles('ADMIN', 'SST', 'AUDITOR')
  getFollowUp(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.getFollowUp(user, id);
  }
}
