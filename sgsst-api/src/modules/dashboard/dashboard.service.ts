import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { IncidentStatus, RiskLevel } from '@prisma/client';
import IORedis from 'ioredis';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { resolveCompanyScope } from '../../common/pipes/company-scope';
import { env } from '../../config/env';
import { PrismaService } from '../../database/prisma.service';

/** KPIs de una sede para el desglose del dashboard. */
export type SiteKpi = {
  siteId: string;
  name: string;
  code: string | null;
  isMain: boolean;
  employees: number;
  criticalRisks: number;
  openIncidents: number;
  trainings: number;
  documents: number;
};

//** Resumen completo del dashboard devuelto por `summary` (y cacheado en Redis). */
export type DashboardSummary = {
  companiesCount: number;
  employeesCount: number;
  usersCount: number;
  documentsCount: number;
  criticalRisks: number;
  openIncidents: number;
  overdueTrainings: number;
  upcomingTrainings: number;
  inactiveCompanies: number;
  inactiveEmployees: number;
  inactiveUsers: number;
  activeRate: number;
  siteKpis: SiteKpi[];
  compliance: ComplianceSummary;
};

/** Bloque de cumplimiento SG-SST del dashboard (fase 7.4). */
export type ComplianceSummary = {
  pendingAudits: number;
  openFindings: number;
  overdueCorrectiveActions: number;
  evaluationsCount: number;
  evaluationsAvgCompliance: number | null;
  indicatorsCount: number;
  indicatorsOffTarget: number;
};

@Injectable()
export class DashboardService implements OnModuleDestroy {
  private redis?: IORedis;

  constructor(private readonly prisma: PrismaService) {}

  async summary(user: AuthenticatedUser, refresh = false) {
    const companyId = this.resolveCompanyId(user);
    const cacheKey = `dashboard:summary:${companyId ?? 'global'}`;

    if (!refresh) {
      const cached = await this.getCachedSummary(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const summary = await this.computeSummary(companyId);
    await this.setCachedSummary(cacheKey, summary);
    return summary;
  }

  async onModuleDestroy() {
    await this.redis?.quit();
  }

  private async computeSummary(companyId?: string): Promise<DashboardSummary> {
    const companyScope = companyId ? { companyId } : {};
    const now = new Date();

    const [
      companiesCount,
      employeesCount,
      usersCount,
      documentsCount,
      criticalRisks,
      openIncidents,
      overdueTrainings,
      upcomingTrainings,
      inactiveCompanies,
      inactiveEmployees,
      inactiveUsers,
    ] = await this.prisma.$transaction([
      this.prisma.company.count({
        where: companyId
          ? { id: companyId, isActive: true }
          : { isActive: true },
      }),
      this.prisma.employee.count({
        where: { ...companyScope, isActive: true },
      }),
      this.prisma.user.count({ where: { ...companyScope, isActive: true } }),
      this.prisma.document.count({
        where: { ...companyScope },
      }),
      this.prisma.risk.count({
        where: { ...companyScope, level: RiskLevel.CRITICAL },
      }),
      this.prisma.incident.count({
        where: {
          ...companyScope,
          status: { not: IncidentStatus.RESOLVED },
        },
      }),
      this.prisma.training.count({
        where: { ...companyScope, date: { lt: now } },
      }),
      this.prisma.training.count({
        where: { ...companyScope, date: { gte: now } },
      }),
      this.prisma.company.count({
        where: companyId
          ? { id: companyId, isActive: false }
          : { isActive: false },
      }),
      this.prisma.employee.count({
        where: { ...companyScope, isActive: false },
      }),
      this.prisma.user.count({ where: { ...companyScope, isActive: false } }),
    ]);

    const totalCoreRecords =
      companiesCount +
      employeesCount +
      usersCount +
      inactiveCompanies +
      inactiveEmployees +
      inactiveUsers;
    const activeCoreRecords = companiesCount + employeesCount + usersCount;

    // Desglose por sede (solo alcance de una empresa; global no lo desglosa).
    const siteKpis = companyId ? await this.computeSiteKpis(companyId) : [];

    // Cumplimiento SG-SST (fase 7.4): auditorías, hallazgos, acciones, evaluaciones e indicadores.
    const compliance = await this.computeCompliance(companyId);

    return {
      companiesCount,
      employeesCount,
      usersCount,
      documentsCount,
      criticalRisks,
      openIncidents,
      overdueTrainings,
      upcomingTrainings,
      inactiveCompanies,
      inactiveEmployees,
      inactiveUsers,
      activeRate:
        totalCoreRecords === 0
          ? 0
          : Math.round((activeCoreRecords / totalCoreRecords) * 100),
      siteKpis,
      compliance,
    };
  }

  /** Cumplimiento SG-SST: auditorías pendientes, hallazgos abiertos, acciones vencidas,
   *  evaluaciones 0312 e indicadores fuera de meta. Todo con scope por empresa. */
  private async computeCompliance(
    companyId?: string,
  ): Promise<ComplianceSummary> {
    const now = new Date();
    const scope = companyId ? { companyId } : {};
    const auditScope = { audit: scope };

    const [
      pendingAudits,
      openFindings,
      overdueCorrectiveActions,
      evaluationsAggregate,
      indicators,
    ] = await this.prisma.$transaction([
      this.prisma.audit.count({
        where: {
          ...scope,
          status: { in: ['PLANNED', 'IN_PROGRESS'] },
        },
      }),
      this.prisma.auditFinding.count({
        where: { ...auditScope, status: 'OPEN' },
      }),
      this.prisma.correctiveAction.count({
        where: {
          // CorrectiveAction no tiene relacion directa con Audit: pasa por finding.
          finding: { audit: scope },
          dueDate: { lt: now },
          status: { not: 'COMPLETED' },
        },
      }),
      this.prisma.sgsstEvaluation.aggregate({
        _count: { _all: true },
        _avg: { compliancePercent: true },
        where: scope,
      }),
      // Metas + valor actual para detectar indicadores fuera de meta en JS.
      this.prisma.indicator.findMany({
        where: scope,
        select: {
          value: true,
          direction: true,
          targets: { orderBy: { period: 'desc' }, take: 1 },
        },
      }),
    ]);

    const indicatorsOffTarget = indicators.filter((indicator) => {
      const target = indicator.targets[0]?.target;
      if (target === undefined) {
        return false;
      }
      return indicator.direction === 'HIGHER_IS_BETTER'
        ? indicator.value < target
        : indicator.value > target;
    }).length;

    return {
      pendingAudits,
      openFindings,
      overdueCorrectiveActions,
      evaluationsCount: evaluationsAggregate._count._all,
      evaluationsAvgCompliance:
        evaluationsAggregate._avg.compliancePercent === null
          ? null
          : Math.round(evaluationsAggregate._avg.compliancePercent * 100) / 100,
      indicatorsCount: indicators.length,
      indicatorsOffTarget,
    };
  }

  /** KPIs por sede de la empresa: empleados, riesgos, incidentes, capacitaciones y documentos. */
  private async computeSiteKpis(companyId: string): Promise<SiteKpi[]> {
    const [
      sites,
      employeeGroups,
      criticalRiskGroups,
      openIncidentGroups,
      trainingGroups,
      documentGroups,
    ] = (await this.prisma.$transaction([
      // Sedes activas de la empresa (el scope lo garantiza el where).
      this.prisma.site.findMany({
        where: { companyId, isActive: true },
        select: { id: true, name: true, code: true, isMain: true },
        orderBy: [{ isMain: 'desc' }, { name: 'asc' }],
      }),
      this.prisma.employee.groupBy({
        by: ['siteId'],
        where: { companyId, isActive: true, siteId: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.risk.groupBy({
        by: ['siteId'],
        where: { companyId, level: RiskLevel.CRITICAL, siteId: { not: null } },
        _count: { _all: true },
      }),
      this.prisma.incident.groupBy({
        by: ['siteId'],
        where: {
          companyId,
          status: { not: IncidentStatus.RESOLVED },
          siteId: { not: null },
        },
        _count: { _all: true },
      }),
      // Capacitaciones proximas (no vencidas) por sede.
      this.prisma.training.groupBy({
        by: ['siteId'],
        where: { companyId, date: { gte: new Date() }, siteId: { not: null } },
        _count: { _all: true },
      }),
      // Documentos activos por sede.
      this.prisma.document.groupBy({
        by: ['siteId'],
        where: { companyId, isActive: true, siteId: { not: null } },
        _count: { _all: true },
      }),
    ])) as [
      Array<{ id: string; name: string; code: string | null; isMain: boolean }>,
      Array<{ siteId: string | null; _count: { _all: number } }>,
      Array<{ siteId: string | null; _count: { _all: number } }>,
      Array<{ siteId: string | null; _count: { _all: number } }>,
      Array<{ siteId: string | null; _count: { _all: number } }>,
      Array<{ siteId: string | null; _count: { _all: number } }>,
    ];

    const countBySite = (
      groups: Array<{ siteId: string | null; _count: { _all: number } }>,
    ) => new Map(groups.map((group) => [group.siteId, group._count._all]));
    const employeesBySite = countBySite(employeeGroups);
    const risksBySite = countBySite(criticalRiskGroups);
    const incidentsBySite = countBySite(openIncidentGroups);
    const trainingsBySite = countBySite(trainingGroups);
    const documentsBySite = countBySite(documentGroups);

    return sites.map((site) => ({
      siteId: site.id,
      name: site.name,
      code: site.code,
      isMain: site.isMain,
      employees: employeesBySite.get(site.id) ?? 0,
      criticalRisks: risksBySite.get(site.id) ?? 0,
      openIncidents: incidentsBySite.get(site.id) ?? 0,
      trainings: trainingsBySite.get(site.id) ?? 0,
      documents: documentsBySite.get(site.id) ?? 0,
    }));
  }

  private async getCachedSummary(cacheKey: string) {
    try {
      const value = await this.getRedis().get(cacheKey);
      return value ? (JSON.parse(value) as DashboardSummary) : null;
    } catch {
      return null;
    }
  }

  private async setCachedSummary(cacheKey: string, summary: unknown) {
    try {
      await this.getRedis().set(
        cacheKey,
        JSON.stringify(summary),
        'EX',
        env.dashboardCacheTtlSeconds,
      );
    } catch {
      // Cache failure should never block dashboard reads.
    }
  }

  private getRedis() {
    this.redis =
      this.redis ??
      new IORedis(env.redisUrl, {
        lazyConnect: true,
        enableOfflineQueue: false,
        maxRetriesPerRequest: 1,
      });
    return this.redis;
  }

  private resolveCompanyId(user: AuthenticatedUser): string | undefined {
    return resolveCompanyScope(user);
  }
}
