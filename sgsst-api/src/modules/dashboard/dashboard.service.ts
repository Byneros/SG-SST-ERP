import { ForbiddenException, Injectable, OnModuleDestroy } from '@nestjs/common';
import { IncidentStatus, Prisma, RiskLevel, Role } from '@prisma/client';
import IORedis from 'ioredis';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { resolveCompanyScope } from '../../common/pipes/company-scope';
import { env } from '../../config/env';
import { PrismaService } from '../../database/prisma.service';

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
    };
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
