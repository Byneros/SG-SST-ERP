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
  CreateMedicalSurveillanceProgramDto,
  DeriveMedicalRequirementsDto,
  DeriveSurveillanceCohortDto,
  LiftMedicalRestrictionDto,
  ReviewSurveillanceCohortDto,
  UpdateMedicalExamDto,
  UpdateMedicalSurveillanceProgramDto,
  CreatePveCaseDto,
  CreatePveDiagnosisDto,
  ListPveCasesQueryDto,
  UpdatePveCaseDto,
  UpdatePveCaseStatusDto,
  UpdatePveDiagnosisDto,
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

  /** #25.2: deriva requisitos medicos desde los riesgos del cargo. */
  @Post('profiles/:id/derive-requirements')
  @Roles('ADMIN', 'SST')
  deriveRequirements(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DeriveMedicalRequirementsDto,
  ) {
    return this.service.deriveRequirementsFromRisk(user, id, dto);
  }

  // --- Vigilancia epidemiologica (S10.4) -----------------------------------

  @Get('surveillance-programs')
  @Roles('ADMIN', 'SST', 'AUDITOR')
  findSurveillancePrograms(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findSurveillancePrograms(user);
  }

  @Post('surveillance-programs')
  @Roles('ADMIN', 'SST')
  createSurveillanceProgram(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateMedicalSurveillanceProgramDto,
  ) {
    return this.service.createSurveillanceProgram(user, dto);
  }

  @Patch('surveillance-programs/:id')
  @Roles('ADMIN', 'SST')
  updateSurveillanceProgram(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMedicalSurveillanceProgramDto,
  ) {
    return this.service.updateSurveillanceProgram(user, id, dto);
  }

  @Delete('surveillance-programs/:id')
  @Roles('ADMIN', 'SST')
  removeSurveillanceProgram(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.removeSurveillanceProgram(user, id);
  }

  /** S10.4: cohorte de expuestos derivada del riesgo (upsert por programa+riesgo). */
  @Post('surveillance-programs/:id/cohorts/derive')
  @Roles('ADMIN', 'SST')
  deriveSurveillanceCohort(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DeriveSurveillanceCohortDto,
  ) {
    return this.service.deriveSurveillanceCohort(user, id, dto);
  }

  /** S10.4: revisar o cerrar una cohorte. */
  @Patch('surveillance-cohorts/:id')
  @Roles('ADMIN', 'SST')
  reviewSurveillanceCohort(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewSurveillanceCohortDto,
  ) {
    return this.service.reviewSurveillanceCohort(user, id, dto);
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

  // --- Casos PVE (#44): catalogo CIE-10 -------------------------------------

  @Get('pve-diagnoses')
  @Roles('ADMIN', 'SST', 'AUDITOR')
  findPveDiagnoses(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findPveDiagnoses(user);
  }

  @Post('pve-diagnoses')
  @Roles('ADMIN', 'SST')
  createPveDiagnosis(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePveDiagnosisDto,
  ) {
    return this.service.createPveDiagnosis(user, dto);
  }

  @Patch('pve-diagnoses/:id')
  @Roles('ADMIN', 'SST')
  updatePveDiagnosis(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePveDiagnosisDto,
  ) {
    return this.service.updatePveDiagnosis(user, id, dto);
  }

  @Delete('pve-diagnoses/:id')
  @Roles('ADMIN', 'SST')
  removePveDiagnosis(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.removePveDiagnosis(user, id);
  }

  // --- Casos PVE (#44) -------------------------------------------------------

  @Get('pve-cases')
  @Roles('ADMIN', 'SST', 'AUDITOR')
  findPveCases(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListPveCasesQueryDto,
  ) {
    return this.service.findPveCases(user, query);
  }

  @Post('pve-cases')
  @Roles('ADMIN', 'SST')
  createPveCase(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreatePveCaseDto,
  ) {
    return this.service.createPveCase(user, dto);
  }

  @Patch('pve-cases/:id')
  @Roles('ADMIN', 'SST')
  updatePveCase(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePveCaseDto,
  ) {
    return this.service.updatePveCase(user, id, dto);
  }

  /** Transicion de estado del caso (sospecha -> confirmado -> cerrado). */
  @Patch('pve-cases/:id/status')
  @Roles('ADMIN', 'SST')
  updatePveCaseStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePveCaseStatusDto,
  ) {
    return this.service.updatePveCaseStatus(user, id, dto);
  }

  @Delete('pve-cases/:id')
  @Roles('ADMIN', 'SST')
  removePveCase(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.removePveCase(user, id);
  }
}
