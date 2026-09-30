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
  CreateMedicalSurveillanceProgramDto,
  DeriveMedicalRequirementsDto,
  DeriveSurveillanceCohortDto,
  LiftMedicalRestrictionDto,
  ReviewSurveillanceCohortDto,
  UpdateMedicalExamDto,
  UpdateMedicalSurveillanceProgramDto,
  UpdatePveCaseDto,
  UpdatePveCaseStatusDto,
  UpdatePveDiagnosisDto,
  CreatePveCaseDto,
  CreatePveDiagnosisDto,
  ListPveCasesQueryDto,
} from './dto/medical.dto';
import {
  PVE_CASE_STATUSES,
  PVE_CASE_STATUS_TRANSITIONS,
} from './dto/medical.dto';

/**
 * Regla de derivacion #25.2: el nivel de riesgo del cargo determina los
 * examenes y su periodicidad (meses). Editar aqui para cambiar la politica.
 */
export const RISK_LEVEL_REQUIREMENTS: Record<
  string,
  { examType: string; periodicityMonths: number }[]
> = {
  CRITICAL: [
    { examType: 'INGRESO', periodicityMonths: 0 },
    { examType: 'PERIODICO', periodicityMonths: 6 },
  ],
  HIGH: [
    { examType: 'INGRESO', periodicityMonths: 0 },
    { examType: 'PERIODICO', periodicityMonths: 12 },
  ],
  MEDIUM: [{ examType: 'PERIODICO', periodicityMonths: 24 }],
  LOW: [],
};

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

    // #25.2: el riesgo del cargo debe existir y ser de la misma empresa.
    // Se usa el FK escalar (no el nested connect) para mantener un solo tipo
    // de input de Prisma; la pertenencia a la empresa ya se validó arriba.
    if (dto.riskId) {
      const risk = await this.prisma.risk.findFirst({
        where: { id: dto.riskId, companyId },
        select: { id: true },
      });
      if (!risk) {
        throw new NotFoundException('Risk not found');
      }
    }

    const profile = await this.prisma.medicalProfile.create({
      data: {
        position: dto.position,
        description: dto.description,
        companyId,
        riskId: dto.riskId ?? null,
        requirements: dto.requirements?.length
          ? {
              create: dto.requirements.map((requirement) => ({
                examType: requirement.examType,
                periodicityMonths: requirement.periodicityMonths ?? 12,
                derivedFromRiskId: requirement.derivedFromRiskId ?? null,
              })),
            }
          : undefined,
      },
      include: {
        requirements: {
          include: {
            derivedFromRisk: { select: { id: true, title: true, level: true } },
          },
        },
        risk: { select: { id: true, title: true, level: true } },
      },
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

  /**
   * #25.2 (Issue #25): deriva los requisitos medicos del profesiograma desde
   * los riesgos asociados al cargo. Idempotente: si el requisito ya existe
   * (mismo examType y origen), no lo duplica.
   */
  async deriveRequirementsFromRisk(
    user: AuthenticatedUser,
    profileId: string,
    dto: DeriveMedicalRequirementsDto,
  ) {
    assertMedicalRole(user);
    const companyId = this.resolveCompanyId(user, dto.companyId);

    const profile = await this.prisma.medicalProfile.findFirst({
      where: { id: profileId, companyId },
      include: { requirements: true },
    });
    if (!profile) {
      throw new NotFoundException('Medical profile not found');
    }

    // Riesgos del cargo: por riskId del perfil o por position coincidente.
    const risks = await this.prisma.risk.findMany({
      where: {
        companyId,
        OR: [
          ...(profile.riskId ? [{ id: profile.riskId }] : []),
          { position: profile.position },
        ],
      },
      orderBy: { level: 'asc' },
    });

    const worstLevel =
      risks.find((r) => r.level === 'CRITICAL')?.level ??
      risks.find((r) => r.level === 'HIGH')?.level ??
      risks.find((r) => r.level === 'MEDIUM')?.level ??
      risks.find((r) => r.level === 'LOW')?.level ??
      null;
    if (!worstLevel) {
      throw new NotFoundException(
        'No hay riesgos asociados al cargo del profesiograma',
      );
    }

    const planned = RISK_LEVEL_REQUIREMENTS[worstLevel] ?? [];
    const created: {
      id: string;
      examType: string;
      periodicityMonths: number;
    }[] = [];
    for (const requirement of planned) {
      const existing = profile.requirements.find(
        (r) =>
          r.examType === requirement.examType &&
          r.derivedFromRiskId === risks[0]?.id,
      );
      if (existing) continue;
      const requirementCreated =
        await this.prisma.medicalExamRequirement.create({
          data: {
            examType: requirement.examType,
            periodicityMonths: requirement.periodicityMonths,
            profileId: profile.id,
            derivedFromRiskId: risks[0]?.id ?? null,
          },
        });
      created.push({
        id: requirementCreated.id,
        examType: requirementCreated.examType,
        periodicityMonths: requirementCreated.periodicityMonths,
      });
    }

    await this.auditService.log({
      user,
      action: 'CREATE',
      entity: 'MedicalExamRequirement',
      entityId: profile.id,
      after: { profileId: profile.id, worstLevel, created },
    });

    return {
      profileId: profile.id,
      position: profile.position,
      worstRiskLevel: worstLevel,
      risksConsidered: risks.map((r) => ({
        id: r.id,
        title: r.title,
        level: r.level,
      })),
      created,
    };
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

  // --- Vigilancia epidemiologica (S10.4, Issue #28) ------------------------

  /** Programas PVE de la empresa con sus cohortes y conteo de expuestos. */
  async findSurveillancePrograms(user: AuthenticatedUser) {
    assertMedicalRole(user);
    const companyId = this.resolveCompanyId(user);
    return this.prisma.medicalSurveillanceProgram.findMany({
      where: { companyId },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        cohorts: {
          include: {
            risk: {
              select: { id: true, title: true, level: true, position: true },
            },
            _count: { select: { workers: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createSurveillanceProgram(
    user: AuthenticatedUser,
    dto: CreateMedicalSurveillanceProgramDto,
  ) {
    assertMedicalRole(user);
    const companyId = this.resolveCompanyId(user, dto.companyId);

    const program = await this.prisma.medicalSurveillanceProgram.create({
      data: {
        name: dto.name,
        riskType: dto.riskType,
        objective: dto.objective,
        ownerId: dto.ownerId ?? null,
        companyId,
      },
    });

    await this.auditService.log({
      user,
      action: 'CREATE',
      entity: 'MedicalSurveillanceProgram',
      entityId: program.id,
      after: program,
    });

    return program;
  }

  async updateSurveillanceProgram(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateMedicalSurveillanceProgramDto,
  ) {
    assertMedicalRole(user);
    const companyId = this.resolveCompanyId(user);
    const before = await this.prisma.medicalSurveillanceProgram.findFirst({
      where: { id, companyId },
    });
    if (!before) {
      throw new NotFoundException('Surveillance program not found');
    }

    const updated = await this.prisma.medicalSurveillanceProgram.update({
      where: { id },
      data: {
        name: dto.name,
        objective: dto.objective,
        status: dto.status,
        ownerId: dto.ownerId === undefined ? undefined : dto.ownerId,
      },
    });

    await this.auditService.log({
      user,
      action: 'UPDATE',
      entity: 'MedicalSurveillanceProgram',
      entityId: id,
      before,
      after: updated,
    });

    return updated;
  }

  async removeSurveillanceProgram(user: AuthenticatedUser, id: string) {
    assertMedicalRole(user);
    const companyId = this.resolveCompanyId(user);
    const before = await this.prisma.medicalSurveillanceProgram.findFirst({
      where: { id, companyId },
    });
    if (!before) {
      throw new NotFoundException('Surveillance program not found');
    }

    await this.prisma.medicalSurveillanceProgram.delete({ where: { id } });

    await this.auditService.log({
      user,
      action: 'DELETE',
      entity: 'MedicalSurveillanceProgram',
      entityId: id,
      before,
    });

    return { id, deleted: true };
  }

  /**
   * S10.4: deriva (o refresca) la cohorte de expuestos de un riesgo. La
   * cohorte nace de la matriz de riesgos: trabajadores del mismo cargo que
   * el riesgo (o de su sede si el riesgo no tiene cargo).
   */
  async deriveSurveillanceCohort(
    user: AuthenticatedUser,
    programId: string,
    dto: DeriveSurveillanceCohortDto,
  ) {
    assertMedicalRole(user);
    const companyId = this.resolveCompanyId(user, dto.companyId);

    const program = await this.prisma.medicalSurveillanceProgram.findFirst({
      where: { id: programId, companyId },
      select: { id: true },
    });
    if (!program) {
      throw new NotFoundException('Surveillance program not found');
    }

    const risk = await this.prisma.risk.findFirst({
      where: { id: dto.riskId, companyId },
      include: { site: { select: { id: true, name: true } } },
    });
    if (!risk) {
      throw new NotFoundException('Risk not found');
    }

    // Poblacion expuesta: empleados del cargo del riesgo; si el riesgo no
    // tiene cargo, los de la sede del riesgo (cohorte por localizacion).
    const exposed = await this.prisma.employee.findMany({
      where: {
        companyId,
        deletedAt: null,
        ...(risk.position
          ? { position: risk.position }
          : risk.siteId
            ? { siteId: risk.siteId }
            : {}),
      },
      select: { id: true },
    });

    // Upsert por (programa, riesgo): refrescar la cohorte no la duplica.
    const existing = await this.prisma.medicalSurveillanceCohort.findUnique({
      where: { programId_riskId: { programId, riskId: risk.id } },
      include: { workers: { select: { id: true } } },
    });

    const workerIds = exposed.map((worker) => ({ id: worker.id }));
    const cohort = existing
      ? await this.prisma.medicalSurveillanceCohort.update({
          where: { id: existing.id },
          data: {
            workers: { set: workerIds },
            lastReviewedAt: new Date(),
          },
          include: {
            workers: { select: { id: true } },
            risk: { select: { id: true, title: true, level: true } },
          },
        })
      : await this.prisma.medicalSurveillanceCohort.create({
          data: {
            programId,
            riskId: risk.id,
            companyId,
            workers: { connect: workerIds },
          },
          include: {
            workers: { select: { id: true } },
            risk: { select: { id: true, title: true, level: true } },
          },
        });

    await this.auditService.log({
      user,
      action: existing ? 'UPDATE' : 'CREATE',
      entity: 'MedicalSurveillanceCohort',
      entityId: cohort.id,
      after: {
        programId,
        riskId: risk.id,
        workers: workerIds.length,
      },
    });

    return {
      cohortId: cohort.id,
      programId,
      risk: {
        id: risk.id,
        title: risk.title,
        level: risk.level,
        position: risk.position,
      },
      workersCount: workerIds.length,
      reviewed: Boolean(existing),
    };
  }

  /** Revisar o cerrar una cohorte (seguimiento S10.4). */
  async reviewSurveillanceCohort(
    user: AuthenticatedUser,
    cohortId: string,
    dto: ReviewSurveillanceCohortDto,
  ) {
    assertMedicalRole(user);
    const companyId = this.resolveCompanyId(user);
    const before = await this.prisma.medicalSurveillanceCohort.findFirst({
      where: { id: cohortId, companyId },
    });
    if (!before) {
      throw new NotFoundException('Surveillance cohort not found');
    }

    const updated = await this.prisma.medicalSurveillanceCohort.update({
      where: { id: cohortId },
      data: {
        status: dto.status,
        lastReviewedAt: new Date(),
      },
    });

    await this.auditService.log({
      user,
      action: 'UPDATE',
      entity: 'MedicalSurveillanceCohort',
      entityId: cohortId,
      before,
      after: updated,
    });

    return updated;
  }

  // --- Casos PVE (#44) ------------------------------------------------------

  /** Include canonico del caso: trabajador, programa, cohorte y diagnostico. */
  private readonly pveCaseInclude = {
    employee: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        document: true,
        position: true,
      },
    },
    program: { select: { id: true, name: true, riskType: true } },
    cohort: { select: { id: true, status: true, lastReviewedAt: true } },
    diagnosis: { select: { id: true, code: true, name: true, category: true } },
  } as const;

  // --- Catalogo CIE-10 -------------------------------------------------------

  async findPveDiagnoses(user: AuthenticatedUser) {
    assertMedicalRole(user);
    return this.prisma.pveDiagnosis.findMany({
      where: { companyId: this.resolveCompanyId(user) },
      include: { _count: { select: { cases: true } } },
      orderBy: [{ active: 'desc' }, { code: 'asc' }],
    });
  }

  async createPveDiagnosis(
    user: AuthenticatedUser,
    dto: CreatePveDiagnosisDto,
  ) {
    assertMedicalRole(user);
    const companyId = this.resolveCompanyId(user, dto.companyId);

    const duplicated = await this.prisma.pveDiagnosis.findFirst({
      where: { companyId, code: dto.code },
      select: { id: true },
    });
    if (duplicated) {
      throw new ConflictException('Ya existe ese codigo CIE-10 en el catalogo');
    }

    const diagnosis = await this.prisma.pveDiagnosis.create({
      data: {
        code: dto.code,
        name: dto.name,
        category: dto.category,
        companyId,
      },
    });

    await this.auditService.log({
      user,
      action: 'CREATE',
      entity: 'PveDiagnosis',
      entityId: diagnosis.id,
      after: diagnosis,
    });

    return diagnosis;
  }

  async updatePveDiagnosis(
    user: AuthenticatedUser,
    id: string,
    dto: UpdatePveDiagnosisDto,
  ) {
    assertMedicalRole(user);
    const companyId = this.resolveCompanyId(user);
    const before = await this.prisma.pveDiagnosis.findFirst({
      where: { id, companyId },
    });
    if (!before) {
      throw new NotFoundException('PVE diagnosis not found');
    }

    const updated = await this.prisma.pveDiagnosis.update({
      where: { id },
      data: {
        name: dto.name,
        category: dto.category === undefined ? undefined : dto.category,
        active: dto.active,
      },
    });

    await this.auditService.log({
      user,
      action: 'UPDATE',
      entity: 'PveDiagnosis',
      entityId: id,
      before,
      after: updated,
    });

    return updated;
  }

  async removePveDiagnosis(user: AuthenticatedUser, id: string) {
    assertMedicalRole(user);
    const companyId = this.resolveCompanyId(user);
    const before = await this.prisma.pveDiagnosis.findFirst({
      where: { id, companyId },
      include: { _count: { select: { cases: true } } },
    });
    if (!before) {
      throw new NotFoundException('PVE diagnosis not found');
    }
    if (before._count.cases > 0) {
      // 409 en lugar de 500 por la FK Restrict: conservar el historico.
      throw new ConflictException(
        'El diagnostico tiene casos asociados: desactivalo en lugar de borrarlo',
      );
    }

    await this.prisma.pveDiagnosis.delete({ where: { id } });
    await this.auditService.log({
      user,
      action: 'DELETE',
      entity: 'PveDiagnosis',
      entityId: id,
      before,
    });

    return { id, deleted: true };
  }

  // --- Casos -----------------------------------------------------------------

  async findPveCases(user: AuthenticatedUser, query: ListPveCasesQueryDto) {
    assertMedicalRole(user);
    const companyId = this.resolveCompanyId(user);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const where = {
      companyId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.programId ? { programId: query.programId } : {}),
      ...(query.diagnosisId ? { diagnosisId: query.diagnosisId } : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.pveCase.findMany({
        where,
        include: this.pveCaseInclude,
        orderBy: [{ reportedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.pveCase.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    };
  }

  async createPveCase(user: AuthenticatedUser, dto: CreatePveCaseDto) {
    assertMedicalRole(user);
    const companyId = this.resolveCompanyId(user, dto.companyId);

    // Todo dentro del scope de la empresa: 404 si el recurso es ajeno.
    await this.assertEmployeeInScope(dto.employeeId, companyId);
    const program = await this.prisma.medicalSurveillanceProgram.findFirst({
      where: { id: dto.programId, companyId },
      select: { id: true },
    });
    if (!program) {
      throw new NotFoundException('Surveillance program not found');
    }
    const diagnosis = await this.prisma.pveDiagnosis.findFirst({
      where: { id: dto.diagnosisId, companyId },
      select: { id: true, active: true },
    });
    if (!diagnosis) {
      throw new NotFoundException('PVE diagnosis not found');
    }
    if (!diagnosis.active) {
      throw new ConflictException(
        'El diagnostico esta inactivo en el catalogo',
      );
    }
    if (dto.cohortId) {
      const cohort = await this.prisma.medicalSurveillanceCohort.findFirst({
        where: { id: dto.cohortId, programId: dto.programId, companyId },
        select: { id: true },
      });
      if (!cohort) {
        throw new NotFoundException('Surveillance cohort not found');
      }
    }

    // Un solo caso abierto por empleado+programa+diagnostico.
    const openDuplicate = await this.prisma.pveCase.findFirst({
      where: {
        companyId,
        employeeId: dto.employeeId,
        programId: dto.programId,
        diagnosisId: dto.diagnosisId,
        status: { not: 'CLOSED' },
      },
      select: { id: true },
    });
    if (openDuplicate) {
      throw new ConflictException(
        'Ya existe un caso abierto para ese trabajador, programa y diagnostico',
      );
    }

    const created = await this.prisma.pveCase.create({
      data: {
        employeeId: dto.employeeId,
        programId: dto.programId,
        cohortId: dto.cohortId ?? null,
        diagnosisId: dto.diagnosisId,
        status: dto.status ?? 'SUSPECTED',
        reportedAt: dto.reportedAt ? new Date(dto.reportedAt) : undefined,
        nextFollowUpAt: dto.nextFollowUpAt
          ? new Date(dto.nextFollowUpAt)
          : null,
        absenceDays: dto.absenceDays ?? 0,
        notes: dto.notes ?? null,
        companyId,
      },
      include: this.pveCaseInclude,
    });

    await this.auditService.log({
      user,
      action: 'CREATE',
      entity: 'PveCase',
      entityId: created.id,
      after: created,
    });

    return created;
  }

  async updatePveCase(
    user: AuthenticatedUser,
    id: string,
    dto: UpdatePveCaseDto,
  ) {
    assertMedicalRole(user);
    const companyId = this.resolveCompanyId(user);
    const before = await this.prisma.pveCase.findFirst({
      where: { id, companyId },
    });
    if (!before) {
      throw new NotFoundException('PVE case not found');
    }
    if (dto.diagnosisId) {
      const diagnosis = await this.prisma.pveDiagnosis.findFirst({
        where: { id: dto.diagnosisId, companyId },
        select: { id: true, active: true },
      });
      if (!diagnosis) {
        throw new NotFoundException('PVE diagnosis not found');
      }
      if (!diagnosis.active) {
        throw new ConflictException(
          'El diagnostico esta inactivo en el catalogo',
        );
      }
    }
    if (dto.cohortId) {
      const cohort = await this.prisma.medicalSurveillanceCohort.findFirst({
        where: { id: dto.cohortId, programId: before.programId, companyId },
        select: { id: true },
      });
      if (!cohort) {
        throw new NotFoundException('Surveillance cohort not found');
      }
    }

    const updated = await this.prisma.pveCase.update({
      where: { id },
      data: {
        cohortId: dto.cohortId === undefined ? undefined : dto.cohortId,
        diagnosisId: dto.diagnosisId,
        nextFollowUpAt:
          dto.nextFollowUpAt === undefined
            ? undefined
            : dto.nextFollowUpAt
              ? new Date(dto.nextFollowUpAt)
              : null,
        absenceDays: dto.absenceDays,
        notes: dto.notes === undefined ? undefined : dto.notes,
      },
      include: this.pveCaseInclude,
    });

    await this.auditService.log({
      user,
      action: 'UPDATE',
      entity: 'PveCase',
      entityId: id,
      before,
      after: updated,
    });

    return updated;
  }

  /** Transicion de estado (solo hacia adelante); el cierre sella closedAt. */
  async updatePveCaseStatus(
    user: AuthenticatedUser,
    id: string,
    dto: UpdatePveCaseStatusDto,
  ) {
    assertMedicalRole(user);
    const companyId = this.resolveCompanyId(user);
    const before = await this.prisma.pveCase.findFirst({
      where: { id, companyId },
    });
    if (!before) {
      throw new NotFoundException('PVE case not found');
    }
    const allowed =
      PVE_CASE_STATUS_TRANSITIONS[
        before.status as (typeof PVE_CASE_STATUSES)[number]
      ] ?? [];
    if (!allowed.includes(dto.status)) {
      throw new ConflictException(
        `Transicion invalida: ${before.status} -> ${dto.status}`,
      );
    }

    const updated = await this.prisma.pveCase.update({
      where: { id },
      data: {
        status: dto.status,
        closedAt: dto.status === 'CLOSED' ? new Date() : undefined,
        notes: dto.notes === undefined ? undefined : dto.notes,
      },
      include: this.pveCaseInclude,
    });

    await this.auditService.log({
      user,
      action: 'UPDATE',
      entity: 'PveCase',
      entityId: id,
      before,
      after: updated,
    });

    return updated;
  }

  async removePveCase(user: AuthenticatedUser, id: string) {
    assertMedicalRole(user);
    const companyId = this.resolveCompanyId(user);
    const before = await this.prisma.pveCase.findFirst({
      where: { id, companyId },
    });
    if (!before) {
      throw new NotFoundException('PVE case not found');
    }

    await this.prisma.pveCase.delete({ where: { id } });
    await this.auditService.log({
      user,
      action: 'DELETE',
      entity: 'PveCase',
      entityId: id,
      before,
    });

    return { id, deleted: true };
  }
}
