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
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { CreateTrainingDto } from './dto/create-training.dto';
import { UpdateTrainingDto } from './dto/update-training.dto';
import {
  CreateTrainingAttendeeDto,
  UpdateTrainingAttendeeDto,
} from './dto/training-attendee.dto';
import { TrainingsService } from './trainings.service';

@Controller('trainings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TrainingsController {
  constructor(private readonly trainingsService: TrainingsService) {}

  @Get()
  @Roles('ADMIN', 'SST', 'EMPLOYEE', 'AUDITOR')
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('companyId') companyId?: string,
    @Query('siteId') siteId?: string,
  ) {
    return this.trainingsService.findAll(user, companyId, siteId);
  }

  /** Dashboard de vencimientos de certificados (#58).
   *  IMPORTANTE: declarado antes de @Get(':id') para que Nest no lo capture. */
  @Get('expirations')
  @Roles('ADMIN', 'SST', 'AUDITOR')
  expirations(
    @CurrentUser() user: AuthenticatedUser,
    @Query('days') days?: string,
  ) {
    const windowDays = Math.min(Math.max(Number(days) || 30, 1), 365);
    return this.trainingsService.expirations(user, windowDays);
  }

  @Get(':id')
  @Roles('ADMIN', 'SST', 'EMPLOYEE', 'AUDITOR')
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.trainingsService.findOne(user, id);
  }

  @Post()
  @Roles('ADMIN', 'SST')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTrainingDto,
  ) {
    return this.trainingsService.create(user, dto);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SST')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTrainingDto,
  ) {
    return this.trainingsService.update(user, id, dto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'SST')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.trainingsService.remove(user, id);
  }

  //----- asistentes (#58) -----------------------------------------------------
  /** Alta de asistente con evaluación, evidencia y vencimiento. */
  @Post(':id/attendees')
  @Roles('ADMIN', 'SST')
  createAttendee(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTrainingAttendeeDto,
  ) {
    return this.trainingsService.createAttendee(user, id, dto);
  }

  /** Evaluación/evidencia/vencimiento por asistente. */
  @Patch('attendees/:attendeeId')
  @Roles('ADMIN', 'SST')
  updateAttendee(
    @CurrentUser() user: AuthenticatedUser,
    @Param('attendeeId', ParseUUIDPipe) attendeeId: string,
    @Body() dto: UpdateTrainingAttendeeDto,
  ) {
    return this.trainingsService.updateAttendee(user, attendeeId, dto);
  }

  /** Baja de asistente (el historial del trabajador queda fuera del training). */
  @Delete('attendees/:attendeeId')
  @Roles('ADMIN', 'SST')
  removeAttendee(
    @CurrentUser() user: AuthenticatedUser,
    @Param('attendeeId', ParseUUIDPipe) attendeeId: string,
  ) {
    return this.trainingsService.removeAttendee(user, attendeeId);
  }
}
