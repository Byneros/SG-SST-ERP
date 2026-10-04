import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type {
  CreateEmergencyBrigadeDto,
  CreateEmergencyBrigadeMemberDto,
  CreateEmergencyDrillDto,
  CreateEmergencyDrillFindingDto,
  CreateEmergencyPlanDto,
  CreateEmergencyResourceDto,
  CreateEmergencyThreatDto,
  EmergencyBrigadeListQueryDto,
  EmergencyDrillListQueryDto,
  EmergencyPlanListQueryDto,
  UpdateEmergencyBrigadeDto,
  UpdateEmergencyBrigadeMemberDto,
  UpdateEmergencyPlanDto,
  UpdateEmergencyResourceDto,
  UpdateEmergencyThreatDto,
} from './dto/emergency.dto';

const brigadeInclude = {
  site: { select: { id: true, name: true, code: true } },
  members: {
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
    },
    orderBy: { createdAt: 'asc' as const },
  },
  _count: { select: { members: true } },
} satisfies Prisma.EmergencyBrigadeInclude;

const brigadeMemberInclude = {
  employee: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      document: true,
      position: true,
    },
  },
  brigade: { select: { id: true, name: true, siteId: true } },
} satisfies Prisma.EmergencyBrigadeMemberInclude;

const planInclude = {
  site: { select: { id: true, name: true, code: true } },
  responsible: {
    select: { id: true, firstName: true, lastName: true, position: true },
  },
  threats: { orderBy: { createdAt: 'asc' as const } },
  resources: { orderBy: { createdAt: 'asc' as const } },
  _count: { select: { threats: true, resources: true, drills: true } },
} satisfies Prisma.EmergencyPlanInclude;

const drillInclude = {
  plan: {
    select: {
      id: true,
      name: true,
      site: { select: { id: true, name: true } },
    },
  },
  findings: { orderBy: { createdAt: 'asc' as const } },
  _count: { select: { findings: true } },
} satisfies Prisma.EmergencyDrillInclude;

@Injectable()
export class EmergencyRepository {
  constructor(private readonly prisma: PrismaService) {}

  // --- Brigadas ---------------------------------------------------------------

  async findBrigades(companyId: string, query: EmergencyBrigadeListQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const search = query.search?.trim();
    const where: Prisma.EmergencyBrigadeWhereInput = {
      companyId,
      ...(query.siteId ? { siteId: query.siteId } : {}),
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.emergencyBrigade.findMany({
        where,
        include: brigadeInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.emergencyBrigade.count({ where }),
    ]);
    return {
      data,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  findBrigadeByIdScoped(id: string, companyId: string) {
    return this.prisma.emergencyBrigade.findFirst({
      where: { id, companyId },
      include: brigadeInclude,
    });
  }

  createBrigade(dto: CreateEmergencyBrigadeDto, companyId: string) {
    return this.prisma.emergencyBrigade.create({
      data: { name: dto.name, siteId: dto.siteId, companyId },
    });
  }

  async updateBrigadeScoped(
    id: string,
    companyId: string,
    dto: UpdateEmergencyBrigadeDto,
  ) {
    const result = await this.prisma.emergencyBrigade.updateMany({
      where: { id, companyId },
      data: { name: dto.name, siteId: dto.siteId },
    });
    if (result.count === 0) {
      return null;
    }
    return this.findBrigadeByIdScoped(id, companyId);
  }

  async removeBrigadeScoped(id: string, companyId: string) {
    const before = await this.findBrigadeByIdScoped(id, companyId);
    if (!before) {
      return null;
    }
    await this.prisma.emergencyBrigade.delete({ where: { id } });
    return before;
  }

  findBrigadeMembers(brigadeId: string, companyId: string) {
    return this.prisma.emergencyBrigadeMember.findMany({
      where: { brigadeId, companyId },
      include: brigadeMemberInclude,
      orderBy: { createdAt: 'asc' },
    });
  }

  findBrigadeMemberByIdScoped(id: string, companyId: string) {
    return this.prisma.emergencyBrigadeMember.findFirst({
      where: { id, companyId },
      include: brigadeMemberInclude,
    });
  }

  createBrigadeMember(
    dto: CreateEmergencyBrigadeMemberDto,
    brigadeId: string,
    companyId: string,
  ) {
    return this.prisma.emergencyBrigadeMember.create({
      data: {
        role: dto.role,
        formationCompletedAt: dto.formationCompletedAt
          ? new Date(dto.formationCompletedAt)
          : null,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : null,
        employeeId: dto.employeeId,
        brigadeId,
        companyId,
      },
      include: brigadeMemberInclude,
    });
  }

  async updateBrigadeMemberScoped(
    id: string,
    companyId: string,
    dto: UpdateEmergencyBrigadeMemberDto,
  ) {
    const result = await this.prisma.emergencyBrigadeMember.updateMany({
      where: { id, companyId },
      data: {
        role: dto.role,
        formationCompletedAt:
          dto.formationCompletedAt === undefined
            ? undefined
            : dto.formationCompletedAt === null
              ? null
              : new Date(dto.formationCompletedAt),
        validUntil:
          dto.validUntil === undefined
            ? undefined
            : dto.validUntil === null
              ? null
              : new Date(dto.validUntil),
        employeeId: dto.employeeId,
      },
    });
    if (result.count === 0) {
      return null;
    }
    return this.findBrigadeMemberByIdScoped(id, companyId);
  }

  async removeBrigadeMemberScoped(id: string, companyId: string) {
    const before = await this.findBrigadeMemberByIdScoped(id, companyId);
    if (!before) {
      return null;
    }
    await this.prisma.emergencyBrigadeMember.delete({ where: { id } });
    return before;
  }

  // --- Planes -----------------------------------------------------------------

  async findPlans(companyId: string, query: EmergencyPlanListQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const search = query.search?.trim();
    const where: Prisma.EmergencyPlanWhereInput = {
      companyId,
      ...(query.siteId ? { siteId: query.siteId } : {}),
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.emergencyPlan.findMany({
        where,
        include: planInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.emergencyPlan.count({ where }),
    ]);
    return {
      data,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  findPlanByIdScoped(id: string, companyId: string) {
    return this.prisma.emergencyPlan.findFirst({
      where: { id, companyId },
      include: planInclude,
    });
  }

  createPlan(dto: CreateEmergencyPlanDto, companyId: string) {
    return this.prisma.emergencyPlan.create({
      data: {
        name: dto.name,
        siteId: dto.siteId,
        responsibleEmployeeId: dto.responsibleEmployeeId,
        meetingPoint: dto.meetingPoint,
        routesDescription: dto.routesDescription,
        procedures: dto.procedures,
        vulnerabilityNotes: dto.vulnerabilityNotes,
        companyId,
      },
    });
  }

  async updatePlanScoped(
    id: string,
    companyId: string,
    dto: UpdateEmergencyPlanDto,
  ) {
    const result = await this.prisma.emergencyPlan.updateMany({
      where: { id, companyId },
      data: {
        name: dto.name,
        siteId: dto.siteId,
        responsibleEmployeeId: dto.responsibleEmployeeId,
        meetingPoint: dto.meetingPoint,
        routesDescription: dto.routesDescription,
        procedures: dto.procedures,
        vulnerabilityNotes: dto.vulnerabilityNotes,
      },
    });
    if (result.count === 0) {
      return null;
    }
    return this.findPlanByIdScoped(id, companyId);
  }

  async removePlanScoped(id: string, companyId: string) {
    const before = await this.findPlanByIdScoped(id, companyId);
    if (!before) {
      return null;
    }
    await this.prisma.emergencyPlan.delete({ where: { id } });
    return before;
  }

  // --- Amenazas ----------------------------------------------------------------

  createThreat(
    dto: CreateEmergencyThreatDto,
    planId: string,
    companyId: string,
  ) {
    return this.prisma.emergencyThreat.create({
      data: {
        type: dto.type,
        description: dto.description,
        riskLevel: dto.riskLevel,
        planId,
        companyId,
      },
    });
  }

  findThreatByIdScoped(id: string, companyId: string) {
    return this.prisma.emergencyThreat.findFirst({
      where: { id, companyId },
    });
  }

  async updateThreatScoped(
    id: string,
    companyId: string,
    dto: UpdateEmergencyThreatDto,
  ) {
    const result = await this.prisma.emergencyThreat.updateMany({
      where: { id, companyId },
      data: {
        type: dto.type,
        description: dto.description,
        riskLevel: dto.riskLevel,
      },
    });
    if (result.count === 0) {
      return null;
    }
    return this.findThreatByIdScoped(id, companyId);
  }

  async removeThreatScoped(id: string, companyId: string) {
    const before = await this.findThreatByIdScoped(id, companyId);
    if (!before) {
      return null;
    }
    await this.prisma.emergencyThreat.delete({ where: { id } });
    return before;
  }

  // --- Recursos ----------------------------------------------------------------

  createResource(
    dto: CreateEmergencyResourceDto,
    planId: string,
    companyId: string,
  ) {
    return this.prisma.emergencyResource.create({
      data: {
        resourceType: dto.resourceType,
        location: dto.location,
        quantity: dto.quantity,
        status: dto.status,
        lastInspectedAt: dto.lastInspectedAt
          ? new Date(dto.lastInspectedAt)
          : null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        planId,
        companyId,
      },
    });
  }

  findResourceByIdScoped(id: string, companyId: string) {
    return this.prisma.emergencyResource.findFirst({
      where: { id, companyId },
    });
  }

  async updateResourceScoped(
    id: string,
    companyId: string,
    dto: UpdateEmergencyResourceDto,
  ) {
    const result = await this.prisma.emergencyResource.updateMany({
      where: { id, companyId },
      data: {
        resourceType: dto.resourceType,
        location: dto.location,
        quantity: dto.quantity,
        status: dto.status,
        lastInspectedAt:
          dto.lastInspectedAt === undefined
            ? undefined
            : dto.lastInspectedAt === null
              ? null
              : new Date(dto.lastInspectedAt),
        expiresAt:
          dto.expiresAt === undefined
            ? undefined
            : dto.expiresAt === null
              ? null
              : new Date(dto.expiresAt),
      },
    });
    if (result.count === 0) {
      return null;
    }
    return this.findResourceByIdScoped(id, companyId);
  }

  async removeResourceScoped(id: string, companyId: string) {
    const before = await this.findResourceByIdScoped(id, companyId);
    if (!before) {
      return null;
    }
    await this.prisma.emergencyResource.delete({ where: { id } });
    return before;
  }

  // --- Simulacros --------------------------------------------------------------

  async findDrills(companyId: string, query: EmergencyDrillListQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const search = query.search?.trim();
    const where: Prisma.EmergencyDrillWhereInput = {
      companyId,
      ...(query.planId ? { planId: query.planId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.emergencyDrill.findMany({
        where,
        include: drillInclude,
        orderBy: { plannedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.emergencyDrill.count({ where }),
    ]);
    return {
      data,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  findDrillByIdScoped(id: string, companyId: string) {
    return this.prisma.emergencyDrill.findFirst({
      where: { id, companyId },
      include: drillInclude,
    });
  }

  createDrill(dto: CreateEmergencyDrillDto, companyId: string) {
    return this.prisma.emergencyDrill.create({
      data: {
        name: dto.name,
        scenario: dto.scenario,
        planId: dto.planId,
        plannedAt: new Date(dto.plannedAt),
        companyId,
      },
      include: drillInclude,
    });
  }

  async updateDrillScoped(
    id: string,
    companyId: string,
    data: Prisma.EmergencyDrillUpdateManyMutationInput,
  ) {
    const result = await this.prisma.emergencyDrill.updateMany({
      where: { id, companyId },
      data,
    });
    if (result.count === 0) {
      return null;
    }
    return this.findDrillByIdScoped(id, companyId);
  }

  async removeDrillScoped(id: string, companyId: string) {
    const before = await this.findDrillByIdScoped(id, companyId);
    if (!before) {
      return null;
    }
    await this.prisma.emergencyDrill.delete({ where: { id } });
    return before;
  }

  createFinding(
    dto: CreateEmergencyDrillFindingDto,
    drillId: string,
    companyId: string,
  ) {
    return this.prisma.emergencyDrillFinding.create({
      data: {
        description: dto.description,
        severity: dto.severity,
        actionDescription: dto.actionDescription,
        actionResponsible: dto.actionResponsible,
        actionDueDate: dto.actionDueDate ? new Date(dto.actionDueDate) : null,
        drillId,
        companyId,
      },
    });
  }

  findFindingByIdScoped(id: string, companyId: string) {
    return this.prisma.emergencyDrillFinding.findFirst({
      where: { id, companyId },
    });
  }

  async updateFindingScoped(
    id: string,
    companyId: string,
    data: Prisma.EmergencyDrillFindingUpdateManyMutationInput,
  ) {
    const result = await this.prisma.emergencyDrillFinding.updateMany({
      where: { id, companyId },
      data,
    });
    if (result.count === 0) {
      return null;
    }
    return this.prisma.emergencyDrillFinding.findFirst({
      where: { id, companyId },
    });
  }

  async removeFindingScoped(id: string, companyId: string) {
    const before = await this.findFindingByIdScoped(id, companyId);
    if (!before) {
      return null;
    }
    await this.prisma.emergencyDrillFinding.delete({ where: { id } });
    return before;
  }
}
