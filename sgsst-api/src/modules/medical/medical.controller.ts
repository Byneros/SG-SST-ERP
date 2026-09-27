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
  CreateMedicalExamDto,
  CreateMedicalProfileDto,
  CreateMedicalRestrictionDto,
  LiftMedicalRestrictionDto,
  UpdateMedicalExamDto,
} from './dto/medical.dto';
import { MedicalService } from './medical.service';

/**
 * Medicina laboral: datos sensibles de salud ocupacional. Doble barrera RBAC:
 * @Roles excluye a EMPLOYEE en el guard y assertMedicalRole revalida en el
 * servicio (404 para no revelar la existencia de los recursos).
 */
@ApiTags('medical')
@ApiBearerAuth()
@Controller('medical')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MedicalController {
  constructor(private readonly service: MedicalService) {}

  // --- Profesiograma --------------------------------------------------------

  @Get('profiles')
  @Roles('ADMIN', 'SST', 'AUDITOR')
  findProfiles(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findProfiles(user);
  }

  @Post('profiles')
  @Roles('ADMIN', 'SST')
  createProfile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMedicalProfileDto,
  ) {
    return this.service.createProfile(user, dto);
  }

  // --- Examenes ocupacionales ----------------------------------------------

  @Get('exams')
  @Roles('ADMIN', 'SST', 'AUDITOR')
  findExams(
    @CurrentUser() user: AuthenticatedUser,
    // Query opcional: sin ParseUUIDPipe (patron del codebase); el servicio
    // valida scope del empleado cuando viene.
    @Query('employeeId') employeeId?: string,
  ) {
    return this.service.findExams(user, employeeId);
  }

  @Post('exams')
  @Roles('ADMIN', 'SST')
  createExam(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMedicalExamDto,
  ) {
    return this.service.createExam(user, dto);
  }

  @Patch('exams/:id')
  @Roles('ADMIN', 'SST')
  updateExam(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMedicalExamDto,
  ) {
    return this.service.updateExam(user, id, dto);
  }

  @Delete('exams/:id')
  @Roles('ADMIN', 'SST')
  removeExam(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.removeExam(user, id);
  }

  // --- Restricciones --------------------------------------------------------

  @Get('restrictions')
  @Roles('ADMIN', 'SST', 'AUDITOR')
  findRestrictions(
    @CurrentUser() user: AuthenticatedUser,
    // Query opcional: sin ParseUUIDPipe (patron del codebase).
    @Query('employeeId') employeeId?: string,
  ) {
    return this.service.findRestrictions(user, employeeId);
  }

  @Post('restrictions')
  @Roles('ADMIN', 'SST')
  createRestriction(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMedicalRestrictionDto,
  ) {
    return this.service.createRestriction(user, dto);
  }

  /** Levantamiento de restriccion con responsable trazado. */
  @Patch('restrictions/:id/lift')
  @Roles('ADMIN', 'SST')
  liftRestriction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LiftMedicalRestrictionDto,
  ) {
    return this.service.liftRestriction(user, id, dto);
  }
}
