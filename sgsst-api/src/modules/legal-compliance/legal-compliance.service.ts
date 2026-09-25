import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  LegalNormStatus,
  LegalObligationFrequency,
  LegalRequirementStatus,
  Prisma,
  RiskLevel,
} from '@prisma/client';
import { assertCompanyScope } from '../../common/pipes/company-scope';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { PrismaService } from '../../database/prisma.service';
import { CompanyLegalRequirementsQueryDto } from './dto/company-legal-requirements-query.dto';
import { CreateLegalNormDto } from './dto/create-legal-norm.dto';
import { CreateLegalRequirementDto } from './dto/create-legal-requirement.dto';
import { LegalRequirementsQueryDto } from './dto/legal-requirements-query.dto';
import { LinkLegalEvidenceDto } from './dto/link-legal-evidence.dto';
import { UpdateCompanyLegalRequirementDto } from './dto/update-company-legal-requirement.dto';
import { UpdateLegalNormDto } from './dto/update-legal-norm.dto';
import { UpdateLegalRequirementDto } from './dto/update-legal-requirement.dto';

type DefaultLegalRequirementSeed = {
  title: string;
  description: string;
  article?: string;
  frequency: string;
  riskLevel: string;
  moduleKey: string;
  evidenceName: string;
  evidenceType: string;
  kpiKey: string;
  reportKey: string;
};

type DefaultLegalMapItem = {
  norm: {
    code: string;
    name: string;
    type: string;
    issuingEntity: string;
  };
  requirements: DefaultLegalRequirementSeed[];
};

type LegalReportGap = {
  id: string;
  normCode: string;
  requirementTitle: string;
  status: LegalRequirementStatus;
  riskLevel: RiskLevel;
  dueDate: Date | null;
  modules: string[];
  notes?: string | null;
};

type LegalReportMissingEvidence = {
  id: string;
  normCode: string;
  requirementTitle: string;
  riskLevel: RiskLevel;
  missingCount: number;
  requiredEvidence: string[];
  modules: string[];
  dueDate: Date | null;
};

type LegalReportCriticalDeadline = {
  id: string;
  normCode: string;
  requirementTitle: string;
  status: LegalRequirementStatus;
  riskLevel: RiskLevel;
  dueDate: Date;
  overdue: boolean;
};

const defaultLegalMap: DefaultLegalMapItem[] = [
  {
    norm: {
      code: 'DECRETO_1072_2015',
      name: 'Decreto 1072 de 2015',
      type: 'Decreto',
      issuingEntity: 'Ministerio del Trabajo',
    },
    requirements: [
      {
        title: 'Politica SG-SST documentada, firmada y divulgada',
        description:
          'La empresa debe conservar una politica de Seguridad y Salud en el Trabajo vigente, aprobada por la alta direccion y comunicada a los trabajadores.',
        article: '2.2.4.6',
        frequency: 'ANNUAL',
        riskLevel: 'HIGH',
        moduleKey: 'documents',
        evidenceName: 'Politica SG-SST firmada y divulgada',
        evidenceType: 'document',
        kpiKey: 'critical_documents_current',
        reportKey: 'expired-documents',
      },
      {
        title: 'Matriz de peligros, evaluacion y valoracion de riesgos',
        description:
          'La organizacion debe identificar peligros, evaluar y valorar riesgos, y definir controles de intervencion.',
        article: '2.2.4.6',
        frequency: 'ANNUAL',
        riskLevel: 'CRITICAL',
        moduleKey: 'risks',
        evidenceName: 'Matriz GTC 45 actualizada',
        evidenceType: 'matrix',
        kpiKey: 'critical_risks_open',
        reportKey: 'summary',
      },
      {
        title: 'Plan anual de trabajo SG-SST',
        description:
          'El SG-SST debe contar con plan anual de trabajo con responsables, recursos, cronograma y seguimiento.',
        article: '2.2.4.6',
        frequency: 'ANNUAL',
        riskLevel: 'HIGH',
        moduleKey: 'annual_work_plan',
        evidenceName: 'Plan anual aprobado y con seguimiento',
        evidenceType: 'plan',
        kpiKey: 'annual_plan_completion',
        reportKey: 'summary',
      },
      {
        title: 'Gestion del cambio',
        description:
          'Todo cambio interno o externo relevante debe evaluarse frente a impactos en SST antes de su implementacion.',
        article: '2.2.4.6',
        frequency: 'EVENT_BASED',
        riskLevel: 'HIGH',
        moduleKey: 'change_management',
        evidenceName: 'Evaluacion SST del cambio',
        evidenceType: 'record',
        kpiKey: 'changes_with_sst_review',
        reportKey: 'summary',
      },
    ],
  },
  {
    norm: {
      code: 'RESOLUCION_0312_2019',
      name: 'Resolucion 0312 de 2019',
      type: 'Resolucion',
      issuingEntity: 'Ministerio del Trabajo',
    },
    requirements: [
      {
        title: 'Autoevaluacion de estandares minimos',
        description:
          'La empresa debe realizar y conservar la autoevaluacion de estandares minimos SG-SST segun su tamano y nivel de riesgo.',
        frequency: 'ANNUAL',
        riskLevel: 'CRITICAL',
        moduleKey: 'minimum_standards',
        evidenceName: 'Autoevaluacion Resolucion 0312',
        evidenceType: 'assessment',
        kpiKey: 'minimum_standards_score',
        reportKey: 'summary',
      },
      {
        title: 'Plan de mejora de estandares minimos',
        description:
          'Los incumplimientos de estandares minimos deben generar plan de mejora con responsables y fechas de cierre.',
        frequency: 'ANNUAL',
        riskLevel: 'CRITICAL',
        moduleKey: 'improvement_actions',
        evidenceName: 'Plan de mejora SG-SST',
        evidenceType: 'action_plan',
        kpiKey: 'corrective_actions_closure_rate',
        reportKey: 'audits',
      },
    ],
  },
  {
    norm: {
      code: 'LEY_1562_2012',
      name: 'Ley 1562 de 2012',
      type: 'Ley',
      issuingEntity: 'Congreso de Colombia',
    },
    requirements: [
      {
        title:
          'Afiliacion y cobertura del Sistema General de Riesgos Laborales',
        description:
          'Los trabajadores y contratistas aplicables deben estar cubiertos por el Sistema General de Riesgos Laborales.',
        frequency: 'MONTHLY',
        riskLevel: 'CRITICAL',
        moduleKey: 'employees',
        evidenceName: 'Soporte de afiliacion ARL',
        evidenceType: 'document',
        kpiKey: 'arl_coverage_rate',
        reportKey: 'employees',
      },
    ],
  },
  {
    norm: {
      code: 'RESOLUCION_1401_2007',
      name: 'Resolucion 1401 de 2007',
      type: 'Resolucion',
      issuingEntity: 'Ministerio de la Proteccion Social',
    },
    requirements: [
      {
        title: 'Investigacion de incidentes y accidentes de trabajo',
        description:
          'Todo incidente y accidente de trabajo debe investigarse, documentarse y cerrar acciones derivadas.',
        frequency: 'EVENT_BASED',
        riskLevel: 'CRITICAL',
        moduleKey: 'incidents',
        evidenceName: 'Investigacion y plan de accion del evento',
        evidenceType: 'investigation',
        kpiKey: 'incident_investigation_closure_rate',
        reportKey: 'summary',
      },
    ],
  },
  {
    norm: {
      code: 'RESOLUCION_2013_1986',
      name: 'Resolucion 2013 de 1986',
      type: 'Resolucion',
      issuingEntity: 'Ministerio de Trabajo y Seguridad Social',
    },
    requirements: [
      {
        title: 'Conformacion y funcionamiento del COPASST',
        description:
          'La empresa debe conformar, registrar y evidenciar reuniones y actividades del COPASST cuando aplique.',
        frequency: 'MONTHLY',
        riskLevel: 'HIGH',
        moduleKey: 'copasst',
        evidenceName: 'Actas y plan de trabajo COPASST',
        evidenceType: 'minutes',
        kpiKey: 'copasst_meeting_compliance',
        reportKey: 'summary',
      },
    ],
  },
  {
    norm: {
      code: 'RESOLUCION_2646_2008',
      name: 'Resolucion 2646 de 2008',
      type: 'Resolucion',
      issuingEntity: 'Ministerio de la Proteccion Social',
    },
    requirements: [
      {
        title: 'Gestion de factores de riesgo psicosocial',
        description:
          'La organizacion debe identificar, evaluar, intervenir y monitorear factores de riesgo psicosocial.',
        frequency: 'ANNUAL',
        riskLevel: 'HIGH',
        moduleKey: 'epidemiological_surveillance',
        evidenceName: 'Evaluacion e intervencion de riesgo psicosocial',
        evidenceType: 'assessment',
        kpiKey: 'psychosocial_intervention_completion',
        reportKey: 'summary',
      },
    ],
  },
  {
    norm: {
      code: 'RESOLUCION_2400_1979',
      name: 'Resolucion 2400 de 1979',
      type: 'Resolucion',
      issuingEntity: 'Ministerio de Trabajo y Seguridad Social',
    },
    requirements: [
      {
        title: 'Condiciones de higiene y seguridad en lugares de trabajo',
        description:
          'Las condiciones locativas, de higiene y seguridad deben inspeccionarse y gestionarse mediante acciones correctivas.',
        frequency: 'MONTHLY',
        riskLevel: 'HIGH',
        moduleKey: 'inspections',
        evidenceName: 'Inspeccion planeada y cierre de hallazgos',
        evidenceType: 'inspection',
        kpiKey: 'inspection_findings_closure_rate',
        reportKey: 'summary',
      },
    ],
  },
  {
    norm: {
      code: 'GTC_45',
      name: 'GTC 45',
      type: 'Guia tecnica',
      issuingEntity: 'ICONTEC',
    },
    requirements: [
      {
        title: 'Metodologia GTC 45 para peligros y riesgos',
        description:
          'La matriz de peligros debe aplicar criterios trazables de identificacion, valoracion e intervencion de riesgos.',
        frequency: 'ANNUAL',
        riskLevel: 'HIGH',
        moduleKey: 'risks',
        evidenceName: 'Matriz de peligros con metodologia GTC 45',
        evidenceType: 'matrix',
        kpiKey: 'risks_with_controls_rate',
        reportKey: 'summary',
      },
    ],
  },
  {
    norm: {
      code: 'ISO_45001_2018',
      name: 'ISO 45001:2018',
      type: 'Norma internacional',
      issuingEntity: 'ISO',
    },
    requirements: [
      {
        title: 'Auditorias internas del sistema de gestion SST',
        description:
          'La organizacion debe auditar periodicamente el sistema, registrar hallazgos y verificar acciones.',
        frequency: 'ANNUAL',
        riskLevel: 'MEDIUM',
        moduleKey: 'sgsst-audits',
        evidenceName: 'Programa, informe y seguimiento de auditoria interna',
        evidenceType: 'audit',
        kpiKey: 'audit_findings_closure_rate',
        reportKey: 'audits',
      },
    ],
  },
];

@Injectable()
export class LegalComplianceService {
  constructor(private readonly prisma: PrismaService) {}

  async findNorms(query: LegalRequirementsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const search = query.search?.trim();
    const where: Prisma.LegalNormWhereInput = search
      ? {
          OR: [
            { code: { contains: search, mode: 'insensitive' as const } },
            { name: { contains: search, mode: 'insensitive' as const } },
            { type: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};
    const [data, total] = await this.prisma.$transaction([
      this.prisma.legalNorm.findMany({
        where,
        orderBy: { code: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.legalNorm.count({ where }),
    ]);
    return {
      data,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async createNorm(dto: CreateLegalNormDto) {
    const existing = await this.prisma.legalNorm.findUnique({
      where: { code: dto.code },
    });
    if (existing) {
      throw new ConflictException('Legal norm code already exists');
    }
    return this.prisma.legalNorm.create({
      data: this.normData(dto) as Prisma.LegalNormCreateInput,
    });
  }

  async updateNorm(id: string, dto: UpdateLegalNormDto) {
    await this.findNormOrFail(id);
    return this.prisma.legalNorm.update({
      where: { id },
      data: this.normData(dto),
    });
  }

  async deactivateNorm(id: string) {
    await this.findNormOrFail(id);
    return this.prisma.legalNorm.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });
  }

  async findRequirements(query: LegalRequirementsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const search = query.search?.trim();
    const where: Prisma.LegalRequirementWhereInput = {
      ...(query.normId ? { normId: query.normId } : {}),
      ...(query.isActive !== undefined ? { active: query.isActive } : {}),
      ...(query.riskLevel ? { riskLevel: query.riskLevel as RiskLevel } : {}),
      ...(query.frequency
        ? { frequency: query.frequency as LegalObligationFrequency }
        : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' as const } },
              {
                description: { contains: search, mode: 'insensitive' as const },
              },
              {
                norm: {
                  name: { contains: search, mode: 'insensitive' as const },
                },
              },
              {
                norm: {
                  code: { contains: search, mode: 'insensitive' as const },
                },
              },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.legalRequirement.findMany({
        where,
        include: this.requirementInclude(),
        orderBy: [{ riskLevel: 'desc' }, { title: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.legalRequirement.count({ where }),
    ]);
    return {
      data,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async createRequirement(dto: CreateLegalRequirementDto) {
    await this.findNormOrFail(dto.normId);
    return this.prisma.legalRequirement.create({
      data: {
        ...(this.requirementData(
          dto,
        ) as Prisma.LegalRequirementUncheckedCreateInput),
        mappings: { create: dto.mappings ?? [] },
        evidenceRequirements: {
          create: this.evidenceRequirementsData(dto.evidenceRequirements),
        },
      },
      include: this.requirementInclude(),
    });
  }

  async updateRequirement(id: string, dto: UpdateLegalRequirementDto) {
    await this.findRequirementOrFail(id);
    if (dto.normId) {
      await this.findNormOrFail(dto.normId);
    }
    return this.prisma.$transaction(async (tx) => {
      if (dto.mappings) {
        await tx.legalRequirementMapping.deleteMany({
          where: { requirementId: id },
        });
      }
      if (dto.evidenceRequirements) {
        await tx.legalEvidenceRequirement.deleteMany({
          where: { requirementId: id },
        });
      }
      return tx.legalRequirement.update({
        where: { id },
        data: {
          ...this.requirementData(dto),
          ...(dto.mappings ? { mappings: { create: dto.mappings } } : {}),
          ...(dto.evidenceRequirements
            ? {
                evidenceRequirements: {
                  create: this.evidenceRequirementsData(
                    dto.evidenceRequirements,
                  ),
                },
              }
            : {}),
        },
        include: this.requirementInclude(),
      });
    });
  }

  async deactivateRequirement(id: string) {
    await this.findRequirementOrFail(id);
    return this.prisma.legalRequirement.update({
      where: { id },
      data: { active: false },
      include: this.requirementInclude(),
    });
  }

  async seedDefaults() {
    let norms = 0;
    let requirements = 0;
    for (const item of defaultLegalMap) {
      const norm = await this.prisma.legalNorm.upsert({
        where: { code: item.norm.code },
        create: item.norm,
        update: item.norm,
      });
      norms += 1;
      for (const requirementSeed of item.requirements) {
        const existing = await this.prisma.legalRequirement.findFirst({
          where: { normId: norm.id, title: requirementSeed.title },
        });
        const requirementData = {
          normId: norm.id,
          article: requirementSeed.article,
          title: requirementSeed.title,
          description: requirementSeed.description,
          frequency: requirementSeed.frequency as LegalObligationFrequency,
          riskLevel: requirementSeed.riskLevel as RiskLevel,
          active: true,
        };
        const requirement = existing
          ? await this.prisma.legalRequirement.update({
              where: { id: existing.id },
              data: requirementData,
            })
          : await this.prisma.legalRequirement.create({
              data: requirementData,
            });
        requirements += 1;
        await this.ensureMapping(requirement.id, requirementSeed);
        await this.ensureEvidenceRequirement(requirement.id, requirementSeed);
      }
    }
    return { success: true, norms, requirements };
  }

  async syncCompanyRequirements(
    currentUser: AuthenticatedUser,
    companyId: string,
  ) {
    assertCompanyScope(currentUser, companyId);
    const activeRequirements = await this.prisma.legalRequirement.findMany({
      where: { active: true },
      select: { id: true, frequency: true, riskLevel: true },
    });
    let created = 0;
    for (const requirement of activeRequirements) {
      const existing = await this.prisma.companyLegalRequirement.findUnique({
        where: {
          companyId_requirementId: { companyId, requirementId: requirement.id },
        },
      });
      if (existing) continue;
      await this.prisma.companyLegalRequirement.create({
        data: {
          companyId,
          requirementId: requirement.id,
          dueDate: this.defaultDueDate(
            requirement.frequency,
            requirement.riskLevel,
          ),
          nextReviewAt: this.defaultDueDate(
            requirement.frequency,
            requirement.riskLevel,
          ),
        },
      });
      created += 1;
    }
    return {
      success: true,
      companyId,
      created,
      totalActiveRequirements: activeRequirements.length,
    };
  }

  async findCompanyRequirements(
    currentUser: AuthenticatedUser,
    companyId: string,
    query: CompanyLegalRequirementsQueryDto,
  ) {
    assertCompanyScope(currentUser, companyId);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const search = query.search?.trim();
    const where: Prisma.CompanyLegalRequirementWhereInput = {
      companyId,
      ...(query.status
        ? { status: query.status as LegalRequirementStatus }
        : {}),
      ...(query.applies !== undefined ? { applies: query.applies } : {}),
      ...(search
        ? {
            requirement: {
              OR: [
                { title: { contains: search, mode: 'insensitive' as const } },
                {
                  description: {
                    contains: search,
                    mode: 'insensitive' as const,
                  },
                },
                {
                  norm: {
                    name: { contains: search, mode: 'insensitive' as const },
                  },
                },
                {
                  norm: {
                    code: { contains: search, mode: 'insensitive' as const },
                  },
                },
              ],
            },
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.companyLegalRequirement.findMany({
        where,
        include: {
          company: { select: { id: true, name: true, nit: true } },
          requirement: { include: this.requirementInclude() },
          evidences: true,
        },
        orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.companyLegalRequirement.count({ where }),
    ]);
    return {
      data,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async updateCompanyRequirement(
    currentUser: AuthenticatedUser,
    id: string,
    dto: UpdateCompanyLegalRequirementDto,
  ) {
    const current = await this.findCompanyRequirementOrFail(currentUser, id);
    const data = {
      ...dto,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      nextReviewAt: dto.nextReviewAt ? new Date(dto.nextReviewAt) : undefined,
      lastReviewedAt: dto.lastReviewedAt
        ? new Date(dto.lastReviewedAt)
        : dto.status && dto.status !== current.status
          ? new Date()
          : undefined,
    };
    return this.prisma.companyLegalRequirement.update({
      where: { id },
      data: data as Prisma.CompanyLegalRequirementUncheckedUpdateInput,
      include: {
        company: { select: { id: true, name: true, nit: true } },
        requirement: { include: this.requirementInclude() },
        evidences: true,
      },
    });
  }

  async linkEvidence(
    currentUser: AuthenticatedUser,
    companyRequirementId: string,
    dto: LinkLegalEvidenceDto,
  ) {
    const companyRequirement = await this.findCompanyRequirementOrFail(
      currentUser,
      companyRequirementId,
    );
    await this.assertEvidenceBelongsToCompany(
      dto.entity,
      dto.entityId,
      companyRequirement.companyId,
    );
    const duplicate = await this.prisma.legalEvidenceLink.findFirst({
      where: {
        companyRequirementId,
        entity: dto.entity,
        entityId: dto.entityId,
      },
    });
    if (duplicate) {
      throw new ConflictException(
        'Evidence is already linked to this legal requirement',
      );
    }

    // El revisor de la evidencia siempre es el usuario autenticado: el cliente no puede
    // atribuir la revisión a un tercero (evita referencias cruzadas entre empresas).
    const evidence = await this.prisma.legalEvidenceLink.create({
      data: {
        companyRequirementId,
        entity: dto.entity,
        entityId: dto.entityId,
        status: (dto.status ?? 'PENDING') as LegalRequirementStatus,
        reviewedById: currentUser.sub,
        reviewedAt:
          dto.status && dto.status !== 'PENDING' ? new Date() : undefined,
        comments: dto.comments,
      },
    });
    const updatedRequirement =
      await this.recalculateCompanyRequirementCompliance(companyRequirementId);
    return { evidence, companyRequirement: updatedRequirement };
  }

  async summary(currentUser: AuthenticatedUser, companyId: string) {
    assertCompanyScope(currentUser, companyId);
    const records = await this.prisma.companyLegalRequirement.findMany({
      where: { companyId },
      select: { status: true, applies: true, dueDate: true, score: true },
    });
    const applicable = records.filter((item) => item.applies);
    const byStatus = applicable.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = (acc[item.status] ?? 0) + 1;
      return acc;
    }, {});
    const now = new Date();
    const overdue = applicable.filter(
      (item) =>
        item.dueDate &&
        item.dueDate < now &&
        !['COMPLIES', 'NOT_APPLICABLE'].includes(item.status),
    ).length;
    const compliant = byStatus.COMPLIES ?? 0;
    const averageScore = applicable.length
      ? Math.round(
          applicable.reduce((total, item) => total + (item.score ?? 0), 0) /
            applicable.length,
        )
      : 0;
    return {
      companyId,
      total: records.length,
      applicable: applicable.length,
      byStatus,
      overdue,
      complianceRate: applicable.length
        ? Math.round((compliant / applicable.length) * 100)
        : 0,
      averageScore,
    };
  }

  async managementReports(currentUser: AuthenticatedUser, companyId: string) {
    assertCompanyScope(currentUser, companyId);
    const records = await this.prisma.companyLegalRequirement.findMany({
      where: { companyId, applies: true },
      include: {
        company: { select: { id: true, name: true, nit: true } },
        evidences: true,
        requirement: {
          include: {
            norm: true,
            mappings: true,
            evidenceRequirements: true,
          },
        },
      },
      orderBy: [{ dueDate: 'asc' }, { status: 'asc' }],
    });
    const now = new Date();
    const next30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const byNormMap = new Map<
      string,
      {
        normCode: string;
        normName: string;
        total: number;
        complies: number;
        partial: number;
        nonCompliant: number;
        pending: number;
        overdue: number;
        missingEvidence: number;
      }
    >();
    const openGaps: LegalReportGap[] = [];
    const missingEvidence: LegalReportMissingEvidence[] = [];
    const criticalDeadlines: LegalReportCriticalDeadline[] = [];

    for (const item of records) {
      const normKey = item.requirement.normId;
      const normSummary = byNormMap.get(normKey) ?? {
        normCode: item.requirement.norm.code,
        normName: item.requirement.norm.name,
        total: 0,
        complies: 0,
        partial: 0,
        nonCompliant: 0,
        pending: 0,
        overdue: 0,
        missingEvidence: 0,
      };
      normSummary.total += 1;
      if (item.status === LegalRequirementStatus.COMPLIES)
        normSummary.complies += 1;
      if (item.status === LegalRequirementStatus.PARTIAL)
        normSummary.partial += 1;
      if (item.status === LegalRequirementStatus.NON_COMPLIANT)
        normSummary.nonCompliant += 1;
      if (item.status === LegalRequirementStatus.PENDING)
        normSummary.pending += 1;
      if (
        item.dueDate &&
        item.dueDate < now &&
        !this.isClosedLegalStatus(item.status)
      ) {
        normSummary.overdue += 1;
      }

      const mandatoryCount = item.requirement.evidenceRequirements.filter(
        (evidence) => evidence.mandatory,
      ).length;
      const compliantEvidenceCount = item.evidences.filter(
        (evidence) => evidence.status === LegalRequirementStatus.COMPLIES,
      ).length;
      const missingCount = Math.max(mandatoryCount - compliantEvidenceCount, 0);
      if (missingCount > 0) {
        normSummary.missingEvidence += missingCount;
        missingEvidence.push({
          id: item.id,
          normCode: item.requirement.norm.code,
          requirementTitle: item.requirement.title,
          riskLevel: item.requirement.riskLevel,
          missingCount,
          requiredEvidence: item.requirement.evidenceRequirements
            .filter((evidence) => evidence.mandatory)
            .map((evidence) => evidence.evidenceName),
          modules: item.requirement.mappings.map(
            (mapping) => mapping.moduleKey,
          ),
          dueDate: item.dueDate,
        });
      }

      if (
        item.status === LegalRequirementStatus.NON_COMPLIANT ||
        item.status === LegalRequirementStatus.PARTIAL
      ) {
        openGaps.push({
          id: item.id,
          normCode: item.requirement.norm.code,
          requirementTitle: item.requirement.title,
          status: item.status,
          riskLevel: item.requirement.riskLevel,
          dueDate: item.dueDate,
          modules: item.requirement.mappings.map(
            (mapping) => mapping.moduleKey,
          ),
          notes: item.notes,
        });
      }

      if (
        item.dueDate &&
        item.dueDate <= next30Days &&
        !this.isClosedLegalStatus(item.status) &&
        ['HIGH', 'CRITICAL'].includes(item.requirement.riskLevel)
      ) {
        criticalDeadlines.push({
          id: item.id,
          normCode: item.requirement.norm.code,
          requirementTitle: item.requirement.title,
          status: item.status,
          riskLevel: item.requirement.riskLevel,
          dueDate: item.dueDate,
          overdue: item.dueDate < now,
        });
      }

      byNormMap.set(normKey, normSummary);
    }

    const byNorm = Array.from(byNormMap.values())
      .map((item) => ({
        ...item,
        complianceRate: item.total
          ? Math.round((item.complies / item.total) * 100)
          : 0,
      }))
      .sort((a, b) => a.complianceRate - b.complianceRate || b.total - a.total);

    return {
      byNorm,
      openGaps: openGaps.slice(0, 25),
      missingEvidence: missingEvidence.slice(0, 25),
      criticalDeadlines: criticalDeadlines
        .sort((a, b) => {
          const aDate = a.dueDate
            ? new Date(a.dueDate).getTime()
            : Number.MAX_SAFE_INTEGER;
          const bDate = b.dueDate
            ? new Date(b.dueDate).getTime()
            : Number.MAX_SAFE_INTEGER;
          return aDate - bDate;
        })
        .slice(0, 25),
      totals: {
        norms: byNorm.length,
        openGaps: openGaps.length,
        missingEvidence: missingEvidence.length,
        criticalDeadlines: criticalDeadlines.length,
      },
    };
  }

  private async findNormOrFail(id: string) {
    const norm = await this.prisma.legalNorm.findUnique({ where: { id } });
    if (!norm) throw new NotFoundException('Legal norm not found');
    return norm;
  }

  private isClosedLegalStatus(status: LegalRequirementStatus) {
    return (
      status === LegalRequirementStatus.COMPLIES ||
      status === LegalRequirementStatus.NOT_APPLICABLE
    );
  }

  private async findRequirementOrFail(id: string) {
    const requirement = await this.prisma.legalRequirement.findUnique({
      where: { id },
    });
    if (!requirement)
      throw new NotFoundException('Legal requirement not found');
    return requirement;
  }

  private async findCompanyRequirementOrFail(
    currentUser: AuthenticatedUser,
    id: string,
  ) {
    const companyRequirement =
      await this.prisma.companyLegalRequirement.findUnique({
        where: { id },
        select: { id: true, companyId: true, status: true },
      });
    if (!companyRequirement) {
      throw new NotFoundException('Company legal requirement not found');
    }
    assertCompanyScope(currentUser, companyRequirement.companyId);
    return companyRequirement;
  }

  private async assertEvidenceBelongsToCompany(
    entity: string,
    entityId: string,
    companyId: string,
  ) {
    if (entity === 'Document') {
      const document = await this.prisma.document.findUnique({
        where: { id: entityId },
        select: { companyId: true, isActive: true },
      });
      if (!document || document.companyId !== companyId || !document.isActive) {
        throw new BadRequestException(
          'Evidence document does not belong to the company scope',
        );
      }
      return;
    }

    if (entity === 'Audit') {
      // Audit es hard delete (ADR de borrado): si existe, esta activa.
      const audit = await this.prisma.audit.findUnique({
        where: { id: entityId },
        select: { companyId: true },
      });
      if (!audit || audit.companyId !== companyId) {
        throw new BadRequestException(
          'Evidence audit does not belong to the company scope',
        );
      }
      return;
    }

    throw new BadRequestException('Unsupported legal evidence entity');
  }

  private async recalculateCompanyRequirementCompliance(
    companyRequirementId: string,
  ) {
    const companyRequirement =
      await this.prisma.companyLegalRequirement.findUnique({
        where: { id: companyRequirementId },
        include: {
          evidences: true,
          requirement: { include: { evidenceRequirements: true } },
        },
      });
    if (!companyRequirement) {
      throw new NotFoundException('Company legal requirement not found');
    }
    if (!companyRequirement.applies) {
      return this.prisma.companyLegalRequirement.update({
        where: { id: companyRequirementId },
        data: {
          status: LegalRequirementStatus.NOT_APPLICABLE,
          score: 100,
          lastReviewedAt: new Date(),
        },
        include: {
          requirement: { include: this.requirementInclude() },
          evidences: true,
        },
      });
    }

    const mandatoryCount =
      companyRequirement.requirement.evidenceRequirements.filter(
        (item) => item.mandatory,
      ).length;
    const reviewedEvidence = companyRequirement.evidences.filter(
      (item) => item.status !== LegalRequirementStatus.PENDING,
    );
    const compliantEvidence = reviewedEvidence.filter(
      (item) => item.status === LegalRequirementStatus.COMPLIES,
    ).length;
    const hasNonCompliant = reviewedEvidence.some(
      (item) => item.status === LegalRequirementStatus.NON_COMPLIANT,
    );
    const hasPartial = reviewedEvidence.some(
      (item) => item.status === LegalRequirementStatus.PARTIAL,
    );

    let status: LegalRequirementStatus = LegalRequirementStatus.PENDING;
    let score = 0;
    if (hasNonCompliant) {
      status = LegalRequirementStatus.NON_COMPLIANT;
      score = 0;
    } else if (mandatoryCount > 0 && compliantEvidence >= mandatoryCount) {
      status = LegalRequirementStatus.COMPLIES;
      score = 100;
    } else if (mandatoryCount === 0 && compliantEvidence > 0) {
      status = LegalRequirementStatus.COMPLIES;
      score = 100;
    } else if (hasPartial || compliantEvidence > 0) {
      status = LegalRequirementStatus.PARTIAL;
      score = 50;
    }

    return this.prisma.companyLegalRequirement.update({
      where: { id: companyRequirementId },
      data: {
        status,
        score,
        lastReviewedAt: reviewedEvidence.length ? new Date() : undefined,
      },
      include: {
        requirement: { include: this.requirementInclude() },
        evidences: true,
      },
    });
  }

  private normData(dto: Partial<CreateLegalNormDto>) {
    return {
      code: dto.code,
      name: dto.name,
      type: dto.type,
      issuingEntity: dto.issuingEntity,
      issuedAt: dto.issuedAt ? new Date(dto.issuedAt) : undefined,
      effectiveFrom: dto.effectiveFrom
        ? new Date(dto.effectiveFrom)
        : undefined,
      status: dto.status as LegalNormStatus | undefined,
      url: dto.url,
    };
  }

  private requirementData(dto: Partial<CreateLegalRequirementDto>) {
    return {
      normId: dto.normId,
      article: dto.article,
      numeral: dto.numeral,
      title: dto.title,
      description: dto.description,
      obligationType: dto.obligationType,
      frequency: dto.frequency as LegalObligationFrequency | undefined,
      appliesTo: dto.appliesTo,
      riskLevel: dto.riskLevel as RiskLevel | undefined,
      active: dto.active,
    };
  }

  private requirementInclude() {
    return {
      norm: true,
      mappings: true,
      evidenceRequirements: true,
    };
  }

  private async ensureMapping(
    requirementId: string,
    seed: DefaultLegalRequirementSeed,
  ) {
    const existing = await this.prisma.legalRequirementMapping.findFirst({
      where: { requirementId, moduleKey: seed.moduleKey },
    });
    const data = {
      requirementId,
      moduleKey: seed.moduleKey,
      evidenceType: seed.evidenceType,
      kpiKey: seed.kpiKey,
      reportKey: seed.reportKey,
    };
    return existing
      ? this.prisma.legalRequirementMapping.update({
          where: { id: existing.id },
          data,
        })
      : this.prisma.legalRequirementMapping.create({ data });
  }

  private async ensureEvidenceRequirement(
    requirementId: string,
    seed: DefaultLegalRequirementSeed,
  ) {
    const existing = await this.prisma.legalEvidenceRequirement.findFirst({
      where: { requirementId, evidenceName: seed.evidenceName },
    });
    const data = {
      requirementId,
      evidenceName: seed.evidenceName,
      evidenceType: seed.evidenceType,
      mandatory: true,
      frequency: seed.frequency as LegalObligationFrequency,
      retentionYears: 20,
    };
    return existing
      ? this.prisma.legalEvidenceRequirement.update({
          where: { id: existing.id },
          data: data,
        })
      : this.prisma.legalEvidenceRequirement.create({
          data: data,
        });
  }

  private evidenceRequirementsData(
    evidenceRequirements?: CreateLegalRequirementDto['evidenceRequirements'],
  ) {
    return (evidenceRequirements ?? []).map((item) => ({
      ...item,
      frequency: item.frequency as LegalObligationFrequency | undefined,
    }));
  }

  private defaultDueDate(frequency: string, riskLevel: string) {
    if (frequency === 'EVENT_BASED' || frequency === 'CONTINUOUS') {
      return undefined;
    }
    const daysByFrequency: Record<string, number> = {
      ONCE: 30,
      MONTHLY: 30,
      QUARTERLY: 90,
      SEMIANNUAL: 180,
      ANNUAL: 365,
    };
    const riskAdjustment =
      riskLevel === 'CRITICAL' ? -15 : riskLevel === 'HIGH' ? -7 : 0;
    const days = Math.max(
      (daysByFrequency[frequency] ?? 365) + riskAdjustment,
      7,
    );
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }
}
