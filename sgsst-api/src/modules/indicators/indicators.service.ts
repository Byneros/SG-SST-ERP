import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CompanyScopeService } from '../../common/company/company-scope.service';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../../database/prisma.service';
import { AuthenticatedUser } from '../../common/types/authenticated-request';
import { AddIndicatorMeasurementsDto } from './dto/indicator-targets.dto';
import { CreateIndicatorDto } from './dto/create-indicator.dto';
import { IndicatorListQueryDto } from './dto/indicator-list-query.dto';
import { SetIndicatorTargetsDto } from './dto/indicator-targets.dto';
import { UpdateIndicatorDto } from './dto/update-indicator.dto';

const indicatorInclude = {
  site: { select: { id: true, name: true, code: true } },
  targets: { orderBy: { period: 'asc' as const } },
  measurements: { orderBy: { period: 'asc' as const } },
} satisfies Prisma.IndicatorInclude;

@Injectable()
export class IndicatorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyScope: CompanyScopeService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(
    user: AuthenticatedUser,
    query: IndicatorListQueryDto,
    companyId?: string,
  ) {
    const scope = this.companyScope.resolveCompanyId(user, companyId);

    if (!scope) {
      return {
        data: [],
        meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
      };
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const search = query.search?.trim();
    const siteFilter =
      query.siteId === 'none'
        ? { siteId: null }
        : query.siteId
          ? { siteId: query.siteId }
          : {};

    if (query.siteId && query.siteId !== 'none') {
      await this.assertSiteInScope(scope, query.siteId);
    }

    const where: Prisma.IndicatorWhereInput = {
      companyId: scope,
      ...siteFilter,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.indicator.findMany({
        where,
        include: indicatorInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.indicator.count({ where }),
    ]);

    return {
      data,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async findOne(user: AuthenticatedUser, id: string) {
    const indicator = await this.prisma.indicator.findUnique({
      where: { id },
      include: indicatorInclude,
    });

    if (!indicator) {
      throw new NotFoundException('Indicator not found');
    }

    // Aislamiento: el indicador de otra empresa no existe para el actor (404).
    if (indicator.companyId !== this.companyScope.resolveCompanyId(user)) {
      throw new NotFoundException('Indicator not found');
    }

    this.companyScope.validate(user, indicator.companyId);

    return indicator;
  }

  async create(user: AuthenticatedUser, dto: CreateIndicatorDto) {
    const companyId = this.companyScope.resolveCompanyId(user, dto.companyId);

    if (!companyId) {
      throw new NotFoundException('Company ID is required');
    }

    if (dto.siteId) {
      await this.assertSiteInScope(companyId, dto.siteId);
    }

    return this.prisma.indicator.create({
      data: {
        name: dto.name,
        code: dto.code,
        description: dto.description,
        unit: dto.unit,
        formulaDefinition: dto.formulaDefinition,
        direction: dto.direction as never,
        value: dto.value ?? 0,
        siteId: dto.siteId,
        companyId,
      },
      include: indicatorInclude,
    });
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateIndicatorDto) {
    await this.findOne(user, id);

    if (dto.siteId) {
      const companyId = await this.prisma.indicator
        .findUnique({ where: { id }, select: { companyId: true } })
        .then((r) => r?.companyId);
      if (companyId) await this.assertSiteInScope(companyId, dto.siteId);
    }

    const { siteId, ...rest } = dto;
    const data: Prisma.IndicatorUncheckedUpdateInput = {
      ...rest,
      siteId: siteId === undefined ? undefined : siteId,
    };

    return this.prisma.indicator.update({
      where: { id },
      data,
      include: indicatorInclude,
    });
  }

  async remove(user: AuthenticatedUser, id: string) {
    const indicator = await this.findOne(user, id);

    // Borrado fisico con traza de auditoria (ADR de borrado, fase 1):
    // la cascada elimina metas y mediciones; la traza preserva quien/que/cuando.
    await this.prisma.indicator.delete({ where: { id } });
    await this.auditService.log({
      user,
      action: 'DELETE',
      entity: 'Indicator',
      entityId: id,
      before: indicator,
    });

    return { id, deleted: true };
  }

  /** Reemplaza/agrega metas por periodo (upsert por indicatorId+period). */
  async setTargets(
    user: AuthenticatedUser,
    id: string,
    dto: SetIndicatorTargetsDto,
  ) {
    await this.findOne(user, id);

    for (const target of dto.targets) {
      await this.prisma.indicatorTarget.upsert({
        where: {
          indicatorId_period: { indicatorId: id, period: target.period },
        },
        create: {
          indicatorId: id,
          period: target.period,
          target: target.target,
        },
        update: { target: target.target },
      });
    }

    return this.prisma.indicatorTarget.findMany({
      where: { indicatorId: id },
      orderBy: { period: 'asc' },
    });
  }

  /** Registra mediciones y actualiza el último valor del indicador. */
  async addMeasurements(
    user: AuthenticatedUser,
    id: string,
    dto: AddIndicatorMeasurementsDto,
  ) {
    await this.findOne(user, id);

    for (const measurement of dto.measurements) {
      await this.prisma.indicatorMeasurement.upsert({
        where: {
          indicatorId_period: { indicatorId: id, period: measurement.period },
        },
        create: {
          indicatorId: id,
          period: measurement.period,
          value: measurement.value,
          notes: measurement.notes,
        },
        update: {
          value: measurement.value,
          notes: measurement.notes,
        },
      });
    }

    // El último valor medido queda como valor vigente del indicador.
    const last = await this.prisma.indicatorMeasurement.findFirst({
      where: { indicatorId: id },
      orderBy: [{ period: 'desc' }, { measuredAt: 'desc' }],
    });

    if (last) {
      await this.prisma.indicator.update({
        where: { id },
        data: { value: last.value },
      });
    }

    return this.findOne(user, id);
  }

  /** 404 si la sede no existe o pertenece a otra empresa (mismo patrón del resto de módulos). */
  private async assertSiteInScope(companyId: string, siteId: string) {
    const site = await this.prisma.site.findFirst({
      where: { id: siteId, companyId },
      select: { id: true },
    });

    if (!site) {
      throw new NotFoundException('Site not found');
    }
  }
}
