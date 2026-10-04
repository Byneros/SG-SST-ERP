import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { resolveCompanyScope } from '../../common/pipes/company-scope';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../../database/prisma.service';
import { CommitteesRepository } from './committees.repository';
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

@Injectable()
export class CommitteesService {
  constructor(
    private readonly repository: CommitteesRepository,
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private resolveCompanyId(
    currentUser: AuthenticatedUser,
    companyId?: string,
  ): string {
    return resolveCompanyScope(currentUser, companyId);
  }

  // --- Comites ---------------------------------------------------------------

  findMany(currentUser: AuthenticatedUser, query: CommitteeListQueryDto) {
    const companyId = this.resolveCompanyId(currentUser);
    return this.repository.findMany(companyId, query);
  }

  async findOne(currentUser: AuthenticatedUser, id: string) {
    const committee = await this.repository.findByIdScoped(
      id,
      this.resolveCompanyId(currentUser),
    );
    if (!committee) {
      throw new NotFoundException('Committee not found');
    }
    return committee;
  }

  async create(currentUser: AuthenticatedUser, dto: CreateCommitteeDto) {
    const companyId = this.resolveCompanyId(currentUser, dto.companyId);

    if (new Date(dto.periodEnd) <= new Date(dto.periodStart)) {
      throw new BadRequestException(
        'El fin del periodo debe ser posterior al inicio',
      );
    }
    // Un comite activo por tipo: cerrar (o eliminar) el anterior para crear otro.
    const duplicatedActive = await this.prisma.committee.findFirst({
      where: { companyId, type: dto.type, status: 'ACTIVE' },
      select: { id: true },
    });
    if (duplicatedActive && dto.status !== 'CLOSED') {
      throw new BadRequestException(
        `Ya existe un comite ${dto.type} activo en la empresa`,
      );
    }

    const committee = await this.repository.create(dto, companyId);
    await this.auditService.log({
      user: currentUser,
      action: 'CREATE',
      entity: 'Committee',
      entityId: committee.id,
      after: committee,
    });
    return committee;
  }

  async update(
    currentUser: AuthenticatedUser,
    id: string,
    dto: UpdateCommitteeDto,
  ) {
    const companyId = this.resolveCompanyId(currentUser);
    const before = await this.repository.findByIdScoped(id, companyId);
    if (!before) {
      throw new NotFoundException('Committee not found');
    }
    if (dto.periodStart || dto.periodEnd) {
      const start = dto.periodStart
        ? new Date(dto.periodStart)
        : before.periodStart;
      const end = dto.periodEnd ? new Date(dto.periodEnd) : before.periodEnd;
      if (end <= start) {
        throw new BadRequestException(
          'El fin del periodo debe ser posterior al inicio',
        );
      }
    }
    // El cambio de tipo no puede dejar dos comites activos del mismo tipo.
    if (dto.type && dto.type !== before.type && before.status === 'ACTIVE') {
      const duplicatedActive = await this.prisma.committee.findFirst({
        where: { companyId, type: dto.type, status: 'ACTIVE' },
        select: { id: true },
      });
      if (duplicatedActive) {
        throw new BadRequestException(
          `Ya existe un comite ${dto.type} activo en la empresa`,
        );
      }
    }

    const updated = await this.repository.updateScoped(id, companyId, dto);
    if (!updated) {
      throw new NotFoundException('Committee not found');
    }
    await this.auditService.log({
      user: currentUser,
      action: 'UPDATE',
      entity: 'Committee',
      entityId: id,
      before,
      after: updated,
    });
    return updated;
  }

  async remove(currentUser: AuthenticatedUser, id: string) {
    const companyId = this.resolveCompanyId(currentUser);
    const before = await this.repository.findByIdScoped(id, companyId);
    if (!before) {
      throw new NotFoundException('Committee not found');
    }
    await this.repository.removeScoped(id, companyId);
    await this.auditService.log({
      user: currentUser,
      action: 'DELETE',
      entity: 'Committee',
      entityId: id,
      before,
    });
    return { id, deleted: true };
  }

  // --- Integrantes -----------------------------------------------------------

  async findMembers(currentUser: AuthenticatedUser, committeeId: string) {
    await this.findOne(currentUser, committeeId);
    return this.repository.findMembers(
      committeeId,
      this.resolveCompanyId(currentUser),
    );
  }

  async createMember(
    currentUser: AuthenticatedUser,
    committeeId: string,
    dto: CreateCommitteeMemberDto,
  ) {
    const companyId = this.resolveCompanyId(currentUser, dto.companyId);
    const committee = await this.repository.findByIdScoped(
      committeeId,
      companyId,
    );
    if (!committee) {
      throw new NotFoundException('Committee not found');
    }
    // El integrante debe ser un empleado de la misma empresa (404 cross-tenant).
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.employeeId, companyId },
      select: { id: true },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
    const duplicated = await this.prisma.committeeMember.findFirst({
      where: { committeeId, employeeId: dto.employeeId },
      select: { id: true },
    });
    if (duplicated) {
      throw new BadRequestException(
        'Ese empleado ya es integrante de este comite',
      );
    }

    const member = await this.repository.createMember(
      dto,
      committeeId,
      companyId,
    );
    await this.auditService.log({
      user: currentUser,
      action: 'CREATE',
      entity: 'CommitteeMember',
      entityId: member.id,
      after: member,
    });
    return member;
  }

  async updateMember(
    currentUser: AuthenticatedUser,
    committeeId: string,
    id: string,
    dto: UpdateCommitteeMemberDto,
  ) {
    const companyId = this.resolveCompanyId(currentUser);
    const before = await this.repository.findMemberByIdScoped(id, companyId);
    if (!before || before.committeeId !== committeeId) {
      throw new NotFoundException('Committee member not found');
    }
    if (dto.employeeId && dto.employeeId !== before.employeeId) {
      const employee = await this.prisma.employee.findFirst({
        where: { id: dto.employeeId, companyId },
        select: { id: true },
      });
      if (!employee) {
        throw new NotFoundException('Employee not found');
      }
      const duplicated = await this.prisma.committeeMember.findFirst({
        where: { committeeId, employeeId: dto.employeeId },
        select: { id: true },
      });
      if (duplicated) {
        throw new BadRequestException(
          'Ese empleado ya es integrante de este comite',
        );
      }
    }

    const updated = await this.repository.updateMemberScoped(
      id,
      companyId,
      dto,
    );
    if (!updated) {
      throw new NotFoundException('Committee member not found');
    }
    await this.auditService.log({
      user: currentUser,
      action: 'UPDATE',
      entity: 'CommitteeMember',
      entityId: id,
      before,
      after: updated,
    });
    return updated;
  }

  async removeMember(
    currentUser: AuthenticatedUser,
    committeeId: string,
    id: string,
  ) {
    const companyId = this.resolveCompanyId(currentUser);
    const before = await this.repository.findMemberByIdScoped(id, companyId);
    if (!before || before.committeeId !== committeeId) {
      throw new NotFoundException('Committee member not found');
    }
    await this.repository.removeMemberScoped(id, companyId);
    await this.auditService.log({
      user: currentUser,
      action: 'DELETE',
      entity: 'CommitteeMember',
      entityId: id,
      before,
    });
    return { id, deleted: true };
  }

  // --- Reuniones / actas -------------------------------------------------------

  async findMeetings(currentUser: AuthenticatedUser, committeeId: string) {
    await this.findOne(currentUser, committeeId);
    return this.repository.findMeetings(
      committeeId,
      this.resolveCompanyId(currentUser),
    );
  }

  async createMeeting(
    currentUser: AuthenticatedUser,
    committeeId: string,
    dto: CreateCommitteeMeetingDto,
  ) {
    const companyId = this.resolveCompanyId(currentUser, dto.companyId);
    const committee = await this.repository.findByIdScoped(
      committeeId,
      companyId,
    );
    if (!committee) {
      throw new NotFoundException('Committee not found');
    }
    // Acta same-tenant: un documento ajeno no existe para el actor (404).
    if (dto.minutesDocumentId) {
      const evidence = await this.prisma.document.findFirst({
        where: { id: dto.minutesDocumentId, companyId },
        select: { id: true },
      });
      if (!evidence) {
        throw new NotFoundException('Minutes document not found');
      }
    }
    const duplicated = await this.prisma.committeeMeeting.findFirst({
      where: { committeeId, number: dto.number },
      select: { id: true },
    });
    if (duplicated) {
      throw new BadRequestException(
        'Ya existe una reunion con ese numero en este comite',
      );
    }

    const meeting = await this.repository.createMeeting(
      dto,
      committeeId,
      companyId,
    );
    await this.auditService.log({
      user: currentUser,
      action: 'CREATE',
      entity: 'CommitteeMeeting',
      entityId: meeting.id,
      after: meeting,
    });
    return meeting;
  }

  async updateMeeting(
    currentUser: AuthenticatedUser,
    committeeId: string,
    id: string,
    dto: UpdateCommitteeMeetingDto,
  ) {
    const companyId = this.resolveCompanyId(currentUser);
    const before = await this.repository.findMeetingByIdScoped(id, companyId);
    if (!before || before.committeeId !== committeeId) {
      throw new NotFoundException('Committee meeting not found');
    }
    if (dto.minutesDocumentId) {
      const evidence = await this.prisma.document.findFirst({
        where: { id: dto.minutesDocumentId, companyId },
        select: { id: true },
      });
      if (!evidence) {
        throw new NotFoundException('Minutes document not found');
      }
    }
    if (dto.number && dto.number !== before.number) {
      const duplicated = await this.prisma.committeeMeeting.findFirst({
        where: { committeeId, number: dto.number },
        select: { id: true },
      });
      if (duplicated) {
        throw new BadRequestException(
          'Ya existe una reunion con ese numero en este comite',
        );
      }
    }

    const updated = await this.repository.updateMeetingScoped(
      id,
      companyId,
      dto,
    );
    if (!updated) {
      throw new NotFoundException('Committee meeting not found');
    }
    await this.auditService.log({
      user: currentUser,
      action: 'UPDATE',
      entity: 'CommitteeMeeting',
      entityId: id,
      before,
      after: updated,
    });
    return updated;
  }

  async removeMeeting(
    currentUser: AuthenticatedUser,
    committeeId: string,
    id: string,
  ) {
    const companyId = this.resolveCompanyId(currentUser);
    const before = await this.repository.findMeetingByIdScoped(id, companyId);
    if (!before || before.committeeId !== committeeId) {
      throw new NotFoundException('Committee meeting not found');
    }
    await this.repository.removeMeetingScoped(id, companyId);
    await this.auditService.log({
      user: currentUser,
      action: 'DELETE',
      entity: 'CommitteeMeeting',
      entityId: id,
      before,
    });
    return { id, deleted: true };
  }

  // --- Compromisos ------------------------------------------------------------

  async createCommitment(
    currentUser: AuthenticatedUser,
    meetingId: string,
    dto: CreateCommitteeCommitmentDto,
  ) {
    const companyId = this.resolveCompanyId(currentUser, dto.companyId);
    const meeting = await this.repository.findMeetingByIdScoped(
      meetingId,
      companyId,
    );
    if (!meeting) {
      throw new NotFoundException('Committee meeting not found');
    }
    // Responsable same-tenant: empleado de la misma empresa (404 cross-tenant).
    const employee = await this.prisma.employee.findFirst({
      where: { id: dto.responsibleEmployeeId, companyId },
      select: { id: true },
    });
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    const commitment = await this.repository.createCommitment(
      dto,
      meetingId,
      companyId,
    );
    await this.auditService.log({
      user: currentUser,
      action: 'CREATE',
      entity: 'CommitteeCommitment',
      entityId: commitment.id,
      after: commitment,
    });
    return commitment;
  }

  async updateCommitment(
    currentUser: AuthenticatedUser,
    meetingId: string,
    id: string,
    dto: UpdateCommitteeCommitmentDto,
  ) {
    const companyId = this.resolveCompanyId(currentUser);
    const before = await this.repository.findCommitmentByIdScoped(
      id,
      companyId,
    );
    if (!before || before.meetingId !== meetingId) {
      throw new NotFoundException('Committee commitment not found');
    }
    if (
      dto.responsibleEmployeeId &&
      dto.responsibleEmployeeId !== before.responsibleEmployeeId
    ) {
      const employee = await this.prisma.employee.findFirst({
        where: { id: dto.responsibleEmployeeId, companyId },
        select: { id: true },
      });
      if (!employee) {
        throw new NotFoundException('Employee not found');
      }
    }

    const updated = await this.repository.updateCommitmentScoped(
      id,
      companyId,
      dto,
    );
    if (!updated) {
      throw new NotFoundException('Committee commitment not found');
    }
    await this.auditService.log({
      user: currentUser,
      action: 'UPDATE',
      entity: 'CommitteeCommitment',
      entityId: id,
      before,
      after: updated,
    });
    return updated;
  }

  async removeCommitment(
    currentUser: AuthenticatedUser,
    meetingId: string,
    id: string,
  ) {
    const companyId = this.resolveCompanyId(currentUser);
    const before = await this.repository.findCommitmentByIdScoped(
      id,
      companyId,
    );
    if (!before || before.meetingId !== meetingId) {
      throw new NotFoundException('Committee commitment not found');
    }
    await this.repository.removeCommitmentScoped(id, companyId);
    await this.auditService.log({
      user: currentUser,
      action: 'DELETE',
      entity: 'CommitteeCommitment',
      entityId: id,
      before,
    });
    return { id, deleted: true };
  }

  // --- Seguimiento ------------------------------------------------------------

  /**
   * Panel de seguimiento del comite: compromisos pendientes y vencidos.
   * El vencido (dueDate pasada, sin completedAt) es el dato que exige el
   * seguimiento de recomendaciones (criterio S11.1).
   */
  async getFollowUp(currentUser: AuthenticatedUser, committeeId: string) {
    const committee = await this.findOne(currentUser, committeeId);
    const companyId = this.resolveCompanyId(currentUser);

    const [overdue, meetings] = await Promise.all([
      this.repository.findOverdueCommitments(companyId, new Date()),
      this.repository.findMeetings(committeeId, companyId),
    ]);
    const committeeMeetingIds = new Set(meetings.map((meeting) => meeting.id));
    const committeeOverdue = overdue.filter((commitment) =>
      committeeMeetingIds.has(commitment.meetingId),
    );

    return {
      committee: {
        id: committee.id,
        name: committee.name,
        status: committee.status,
      },
      overdueCount: committeeOverdue.length,
      overdue: committeeOverdue.map((commitment) => ({
        id: commitment.id,
        description: commitment.description,
        dueDate: commitment.dueDate,
        responsible: commitment.responsible,
        meetingId: commitment.meetingId,
      })),
    };
  }
}
