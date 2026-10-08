import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type {
  CommitteeListQueryDto,
  CreateCommitteeCommitmentDto,
  CreateCommitteeDto,
  CreateCommitteeMeetingDto,
  CreateCommitteeMemberDto,
  UpdateCommitteeCommitmentDto,
  UpdateCommitteeDto,
  UpdateCommitteeMeetingDto,
  UpdateCommitteeMemberDto,
} from './dto/committee.dto';

const committeeInclude = {
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
    orderBy: [{ role: 'asc' as const }, { createdAt: 'asc' as const }],
  },
  _count: { select: { members: true, meetings: true } },
} satisfies Prisma.CommitteeInclude;

const meetingInclude = {
  minutesDocument: {
    select: { id: true, name: true, status: true, expiresAt: true },
  },
  commitments: {
    include: {
      responsible: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          position: true,
        },
      },
    },
    orderBy: { dueDate: 'asc' as const },
  },
} satisfies Prisma.CommitteeMeetingInclude;

const memberInclude = {
  employee: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      document: true,
      position: true,
    },
  },
} satisfies Prisma.CommitteeMemberInclude;

const commitmentInclude = {
  responsible: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      position: true,
    },
  },
} satisfies Prisma.CommitteeCommitmentInclude;

@Injectable()
export class CommitteesRepository {
  constructor(private readonly prisma: PrismaService) {}

  // --- Comites ---------------------------------------------------------------

  async findMany(companyId: string, query: CommitteeListQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const search = query.search?.trim();
    const where: Prisma.CommitteeWhereInput = {
      companyId,
      ...(query.type ? { type: query.type } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.committee.findMany({
        where,
        include: committeeInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.committee.count({ where }),
    ]);
    return {
      data,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  findByIdScoped(id: string, companyId: string) {
    return this.prisma.committee.findFirst({
      where: { id, companyId },
      include: committeeInclude,
    });
  }

  create(dto: CreateCommitteeDto, companyId: string) {
    return this.prisma.committee.create({
      data: {
        name: dto.name,
        type: dto.type,
        periodStart: new Date(dto.periodStart),
        periodEnd: new Date(dto.periodEnd),
        status: dto.status,
        companyId,
      },
    });
  }

  async updateScoped(id: string, companyId: string, dto: UpdateCommitteeDto) {
    const result = await this.prisma.committee.updateMany({
      where: { id, companyId },
      data: {
        name: dto.name,
        type: dto.type,
        periodStart: dto.periodStart ? new Date(dto.periodStart) : undefined,
        periodEnd: dto.periodEnd ? new Date(dto.periodEnd) : undefined,
        status: dto.status,
      },
    });
    if (result.count === 0) {
      return null;
    }
    return this.findByIdScoped(id, companyId);
  }

  /** Hard delete con traza (ADR); Cascade limpia members y meetings. */
  async removeScoped(id: string, companyId: string) {
    const before = await this.findByIdScoped(id, companyId);
    if (!before) {
      return null;
    }
    await this.prisma.committee.delete({ where: { id } });
    return before;
  }

  // --- Integrantes -----------------------------------------------------------

  findMembers(committeeId: string, companyId: string) {
    return this.prisma.committeeMember.findMany({
      where: { committeeId, companyId },
      include: memberInclude,
      orderBy: [{ role: 'asc' as const }, { createdAt: 'asc' as const }],
    });
  }

  findMemberByIdScoped(id: string, companyId: string) {
    return this.prisma.committeeMember.findFirst({
      where: { id, companyId },
      include: memberInclude,
    });
  }

  createMember(
    dto: CreateCommitteeMemberDto,
    committeeId: string,
    companyId: string,
  ) {
    return this.prisma.committeeMember.create({
      data: {
        role: dto.role,
        seatType: dto.seatType,
        startDate: new Date(dto.startDate),
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        employeeId: dto.employeeId,
        committeeId,
        companyId,
      },
      include: memberInclude,
    });
  }

  async updateMemberScoped(
    id: string,
    companyId: string,
    dto: UpdateCommitteeMemberDto,
  ) {
    const result = await this.prisma.committeeMember.updateMany({
      where: { id, companyId },
      data: {
        role: dto.role,
        seatType: dto.seatType,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate:
          dto.endDate === undefined
            ? undefined
            : dto.endDate === null
              ? null
              : new Date(dto.endDate),
        employeeId: dto.employeeId,
      },
    });
    if (result.count === 0) {
      return null;
    }
    return this.findMemberByIdScoped(id, companyId);
  }

  async removeMemberScoped(id: string, companyId: string) {
    const before = await this.findMemberByIdScoped(id, companyId);
    if (!before) {
      return null;
    }
    await this.prisma.committeeMember.delete({ where: { id } });
    return before;
  }

  // --- Reuniones / actas -------------------------------------------------------

  findMeetings(committeeId: string, companyId: string) {
    return this.prisma.committeeMeeting.findMany({
      where: { committeeId, companyId },
      include: meetingInclude,
      orderBy: { number: 'asc' },
    });
  }

  findMeetingByIdScoped(id: string, companyId: string) {
    return this.prisma.committeeMeeting.findFirst({
      where: { id, companyId },
      include: meetingInclude,
    });
  }

  createMeeting(
    dto: CreateCommitteeMeetingDto,
    committeeId: string,
    companyId: string,
  ) {
    return this.prisma.committeeMeeting.create({
      data: {
        number: dto.number,
        meetingAt: new Date(dto.meetingAt),
        agenda: dto.agenda,
        notes: dto.notes,
        status: dto.status,
        minutesDocumentId: dto.minutesDocumentId,
        committeeId,
        companyId,
      },
      include: meetingInclude,
    });
  }

  async updateMeetingScoped(
    id: string,
    companyId: string,
    dto: UpdateCommitteeMeetingDto,
  ) {
    const result = await this.prisma.committeeMeeting.updateMany({
      where: { id, companyId },
      data: {
        number: dto.number,
        meetingAt: dto.meetingAt ? new Date(dto.meetingAt) : undefined,
        agenda: dto.agenda,
        notes: dto.notes,
        status: dto.status,
        minutesDocumentId: dto.minutesDocumentId,
      },
    });
    if (result.count === 0) {
      return null;
    }
    return this.findMeetingByIdScoped(id, companyId);
  }

  async removeMeetingScoped(id: string, companyId: string) {
    const before = await this.findMeetingByIdScoped(id, companyId);
    if (!before) {
      return null;
    }
    await this.prisma.committeeMeeting.delete({ where: { id } });
    return before;
  }

  // --- Compromisos ------------------------------------------------------------

  createCommitment(
    dto: CreateCommitteeCommitmentDto,
    meetingId: string,
    companyId: string,
  ) {
    return this.prisma.committeeCommitment.create({
      data: {
        description: dto.description,
        responsibleEmployeeId: dto.responsibleEmployeeId,
        dueDate: new Date(dto.dueDate),
        completedAt: dto.completedAt ? new Date(dto.completedAt) : null,
        meetingId,
        companyId,
      },
      include: commitmentInclude,
    });
  }

  findCommitmentByIdScoped(id: string, companyId: string) {
    return this.prisma.committeeCommitment.findFirst({
      where: { id, companyId },
      include: commitmentInclude,
    });
  }

  async updateCommitmentScoped(
    id: string,
    companyId: string,
    dto: UpdateCommitteeCommitmentDto,
  ) {
    const result = await this.prisma.committeeCommitment.updateMany({
      where: { id, companyId },
      data: {
        description: dto.description,
        responsibleEmployeeId: dto.responsibleEmployeeId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        completedAt:
          dto.completedAt === undefined
            ? undefined
            : dto.completedAt === null
              ? null
              : new Date(dto.completedAt),
      },
    });
    if (result.count === 0) {
      return null;
    }
    return this.findCommitmentByIdScoped(id, companyId);
  }

  async removeCommitmentScoped(id: string, companyId: string) {
    const before = await this.findCommitmentByIdScoped(id, companyId);
    if (!before) {
      return null;
    }
    await this.prisma.committeeCommitment.delete({ where: { id } });
    return before;
  }

  /**
   * Asistente IA (fase I2): resumen de comites por tipo y estado, con
   * integrantes y reuniones agregadas. Solo lectura, scoped por companyId.
   */
  findSummaryForAssistant(companyId: string) {
    return this.prisma.committee.findMany({
      where: { companyId },
      select: {
        name: true,
        type: true,
        status: true,
        periodStart: true,
        periodEnd: true,
        _count: { select: { members: true, meetings: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Asistente IA (fase I2): compromisos pendientes (sin completedAt) de todo
   * el tenant, los mas urgentes primero (tope 20). Solo lectura, scoped.
   */
  findOpenCommitmentsForAssistant(companyId: string, take: number) {
    return this.prisma.committeeCommitment.findMany({
      where: {
        companyId,
        completedAt: null,
      },
      select: {
        description: true,
        dueDate: true,
        meeting: {
          select: {
            number: true,
            committee: { select: { name: true, type: true } },
          },
        },
        responsible: {
          select: { firstName: true, lastName: true, position: true },
        },
      },
      orderBy: { dueDate: 'asc' },
      take,
    });
  }

  /** Compromisos vencidos (pendientes con fecha pasada) de todo el tenant. */
  findOverdueCommitments(companyId: string, now: Date) {
    return this.prisma.committeeCommitment.findMany({
      where: {
        companyId,
        completedAt: null,
        dueDate: { lt: now },
      },
      include: commitmentInclude,
      orderBy: { dueDate: 'asc' },
    });
  }
}
