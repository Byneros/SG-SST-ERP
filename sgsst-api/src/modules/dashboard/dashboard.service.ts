import { ForbiddenException, Injectable, OnModuleDestroy } from '@nestjs/common';
import { IncidentStatus, Prisma, RiskLevel, Role } from '@prisma/client';
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

  private async computeSummary(companyId?: string) {
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
        where: companyId ? { id: companyId, isActive: true } : { isActive: true },
      }),
      this.prisma.employee.count({ where: { ...companyScope, isActive: true } }),
      this.prisma.user.count({ where: { ...companyScope, isActive: true } }),
      this.prisma.document.count({ where: { ...companyScope, isActive: true } }),
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
        where: companyId ? { id: companyId, isActive: false } : { isActive: false },
      }),
      this.prisma.employee.count({ where: { ...companyScope, isActive: false } }),
      this.prisma.user.count({ where: { ...companyScope, isActive: false } }),
    ]);

    const totalCoreRecords =
      companiesCount + employeesCount + usersCount + inactiveCompanies + inactiveEmployees + inactiveUsers;
    const activeCoreRecords = companiesCount + employeesCount + usersCount;

    // Desglose por sede (solo alcance de una empresa; global no lo desglosa).
    const siteKpis = companyId ? await this.computeSiteKpis(companyId) : [];

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
    };
  }

  /** KPIs por sede de la empresa: empleados activos, riesgos criticos e incidentes abiertos. */
  private async computeSiteKpis(companyId: string): Promise<SiteKpi[]> {
    const [sites, employeeGroups, criticalRiskGroups, openIncidentGroups] =
      (await this.prisma.$transaction([
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
      ])) as [
        Array<{ id: string; name: string; code: string | null; isMain: boolean }>,
        Array<{ siteId: string | null; _count: { _all: number } }>,
        Array<{ siteId: string | null; _count: { _all: number } }>,
        Array<{ siteId: string | null; _count: { _all: number } }>,
      ];

    const countBySite = (groups: Array<{ siteId: string | null; _count: { _all: number } }>) =>
      new Map(groups.map((group) => [group.siteId, group._count._all]));
    const employeesBySite = countBySite(employeeGroups);
    const risksBySite = countBySite(criticalRiskGroups);
    const incidentsBySite = countBySite(openIncidentGroups);

    return sites.map((site) => ({
      siteId: site.id,
      name: site.name,
      code: site.code,
      isMain: site.isMain,
      employees: employeesBySite.get(site.id) ?? 0,
      criticalRisks: risksBySite.get(site.id) ?? 0,
      openIncidents: incidentsBySite.get(site.id) ?? 0,
    }));
  }

  private async getCachedSummary(cacheKey: string) {
    try {
      const value = await this.getRedis().get(cacheKey);
      return value ? JSON.parse(value) : null;
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
