import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { resolveCompanyScope } from '../../common/pipes/company-scope';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../../database/prisma.service';
import type {
  CreateMedicalExamDto,
  CreateMedicalProfileDto,
  CreateMedicalRestrictionDto,
  LiftMedicalRestrictionDto,
  UpdateMedicalExamDto,
} from './dto/medical.dto';

/**
 * Roles autorizados para datos de medicina laboral. EMPLOYEE queda excluido
 * explicitamente: los examenes y restricciones son datos sensibles de salud
 * ocupacional (el profesiograma publicable se sirve por otro endpoint).
 */
const MEDICAL_ROLES = ['ADMIN', 'SST', 'AUDITOR', 'SUPER_ADMIN'] as const;

export function assertMedicalRole(user: AuthenticatedUser): void {
  if (!MEDICAL_ROLES.includes(user.role as (typeof MEDICAL_ROLES)[number])) {
    // 404 (no 403) para no revelar la existencia del recurso.
    throw new NotFoundException('Medical records not found');
  }
}

@Injectable()
export class MedicalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private resolveCompanyId(
    currentUser: AuthenticatedUser,
    companyId?: string,
  ): string {
    return resolveCompanyScope(currentUser, companyId);
  }

  private async assertEmployeeInScope(employeeId: string, companyId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, companyId, deletedAt: null },
      select: { id: true },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
  }

  // --- Profesiograma --------------------------------------------------------

  async findProfiles(user: AuthenticatedUser) {
    assertMedicalRole(user);
    return this.prisma.medicalProfile.findMany({
      where: { companyId: this.resolveCompanyId(user) },
      include: { requirements: true },
      orderBy: { position: 'asc' },
    });
  }

  async createProfile(user: AuthenticatedUser, dto: CreateMedicalProfileDto) {
    assertMedicalRole(user);
    const companyId = this.resolveCompanyId(user, dto.companyId);

    const existing = await this.prisma.medicalProfile.findUnique({
      where: { companyId_position: { companyId, position: dto.position } },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        `Ya existe un profesiograma para el cargo ${dto.position}`,
      );
    }

    const profile = await this.prisma.medicalProfile.create({
      data: {
        position: dto.position,
        description: dto.description,
        companyId,
        requirements: dto.requirements?.length
          ? {
              create: dto.requirements.map((requirement) => ({
                examType: requirement.examType,
                periodicityMonths: requirement.periodicityMonths ?? 12,
              })),
            }
          : undefined,
      },
      include: { requirements: true },
    });

    await this.auditService.log({
      user,
      action: 'CREATE',
      entity: 'MedicalProfile',
      entityId: profile.id,
      after: profile,
    });

    return profile;
  }

  // --- Examenes ocupacionales ----------------------------------------------

  async findExams(user: AuthenticatedUser, employeeId?: string) {
    assertMedicalRole(user);
    const companyId = this.resolveCompanyId(user);
    if (employeeId) {
      await this.assertEmployeeInScope(employeeId, companyId);
    }
    return this.prisma.medicalExam.findMany({
      where: {
        companyId,
        ...(employeeId ? { employeeId } : {}),
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            document: true,
            position: true,
          },
        },
        restrictions: true,
      },
      orderBy: { scheduledAt: 'desc' },
    });
  }

  async createExam(user: AuthenticatedUser, dto: CreateMedicalExamDto) {
    assertMedicalRole(user);
    const companyId = this.resolveCompanyId(user, dto.companyId);
    await this.assertEmployeeInScope(dto.employeeId, companyId);

    const exam = await this.prisma.medicalExam.create({
      data: {
        examType: dto.examType,
        concept: dto.concept ?? 'PENDIENTE',
        scheduledAt: new Date(dto.scheduledAt),
        performedAt: dto.performedAt ? new Date(dto.performedAt) : null,
        provider: dto.provider,
        nextDueAt: dto.nextDueAt ? new Date(dto.nextDueAt) : null,
        notes: dto.notes,
        employeeId: dto.employeeId,
        companyId,
      },
    });

    await this.auditService.log({
      user,
      action: 'CREATE',
      entity: 'MedicalExam',
      entityId: exam.id,
      after: exam,
    });

    return exam;
  }

  /** Resultado operativo del examen: concepto, fecha realizada y proxima fecha. */
  async updateExam(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateMedicalExamDto,
  ) {
    assertMedicalRole(user);
    const companyId = this.resolveCompanyId(user);
    const before = await this.prisma.medicalExam.findFirst({
      where: { id, companyId },
    });
    if (!before) {
      throw new NotFoundException('Medical exam not found');
    }

    const updated = await this.prisma.medicalExam.update({
      where: { id },
      data: {
        concept: dto.concept,
        performedAt:
          dto.performedAt === undefined
            ? undefined
            : dto.performedAt
              ? new Date(dto.performedAt)
              : null,
        provider: dto.provider,
        nextDueAt:
          dto.nextDueAt === undefined
            ? undefined
            : dto.nextDueAt
              ? new Date(dto.nextDueAt)
              : null,
        notes: dto.notes === undefined ? undefined : dto.notes,
      },
      include: { restrictions: true },
    });

    await this.auditService.log({
      user,
      action: 'UPDATE',
      entity: 'MedicalExam',
      entityId: id,
      before,
      after: updated,
    });

    return updated;
  }

  async removeExam(user: AuthenticatedUser, id: string) {
    assertMedicalRole(user);
    const companyId = this.resolveCompanyId(user);
    const before = await this.prisma.medicalExam.findFirst({
      where: { id, companyId },
    });
    if (!before) {
      throw new NotFoundException('Medical exam not found');
    }

    await this.prisma.medicalExam.delete({ where: { id } });

    await this.auditService.log({
      user,
      action: 'DELETE',
      entity: 'MedicalExam',
      entityId: id,
      before,
    });

    return { id, deleted: true };
  }

  // --- Restricciones --------------------------------------------------------

  async findRestrictions(user: AuthenticatedUser, employeeId?: string) {
    assertMedicalRole(user);
    const companyId = this.resolveCompanyId(user);
    if (employeeId) {
      await this.assertEmployeeInScope(employeeId, companyId);
    }
    return this.prisma.medicalRestriction.findMany({
      where: {
        companyId,
        ...(employeeId ? { employeeId } : {}),
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            document: true,
            position: true,
          },
        },
        exam: { select: { id: true, examType: true, performedAt: true } },
      },
      orderBy: { startDate: 'desc' },
    });
  }

  async createRestriction(
    user: AuthenticatedUser,
    dto: CreateMedicalRestrictionDto,
  ) {
    assertMedicalRole(user);
    const companyId = this.resolveCompanyId(user, dto.companyId);
    await this.assertEmployeeInScope(dto.employeeId, companyId);

    const restriction = await this.prisma.medicalRestriction.create({
      data: {
        description: dto.description,
        startDate: dto.startDate ? new Date(dto.startDate) : new Date(),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        examId: dto.examId ?? null,
        employeeId: dto.employeeId,
        companyId,
      },
    });

    await this.auditService.log({
      user,
      action: 'CREATE',
      entity: 'MedicalRestriction',
      entityId: restriction.id,
      after: restriction,
    });

    return restriction;
  }

  /** Levantamiento de restriccion: responsable y fecha quedan trazados. */
  async liftRestriction(
    user: AuthenticatedUser,
    id: string,
    dto: LiftMedicalRestrictionDto,
  ) {
    assertMedicalRole(user);
    const companyId = this.resolveCompanyId(user);
    const before = await this.prisma.medicalRestriction.findFirst({
      where: { id, companyId },
    });
    if (!before) {
      throw new NotFoundException('Medical restriction not found');
    }
    if (before.status === 'LIFTED') {
      return before;
    }

    const updated = await this.prisma.medicalRestriction.update({
      where: { id },
      data: {
        status: 'LIFTED',
        liftedAt: new Date(),
        liftedBy: dto.liftedBy,
      },
    });

    await this.auditService.log({
      user,
      action: 'UPDATE',
      entity: 'MedicalRestriction',
      entityId: id,
      before,
      after: updated,
    });

    return updated;
  }
}
