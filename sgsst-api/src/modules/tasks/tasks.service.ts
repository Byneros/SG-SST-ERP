import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { resolveCompanyScope } from '../../common/pipes/company-scope';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { TasksRepository } from './tasks.repository';
import type {
  CreateTaskCommentDto,
  CreateTaskDto,
  TasksListQueryDto,
  UpdateTaskDto,
} from './dto/task.dto';

/**
 * Bandeja de tareas (S15.3, issue #42): seguimiento unificado del ciclo
 * Actuar. Origen trazable same-tenant (404 si es ajeno, sin revelar su
 * existencia). Los hallazgos MAJOR/CRITICAL generan automaticamente una
 * tarea para su responsable (o para los SST de la empresa si no tiene).
 */
@Injectable()
export class TasksService {
  constructor(
    private readonly repository: TasksRepository,
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private resolveCompanyId(
    currentUser: AuthenticatedUser,
    companyId?: string,
  ): string {
    return resolveCompanyScope(currentUser, companyId);
  }

  // --- Consultas ---------------------------------------------------------------

  findMany(currentUser: AuthenticatedUser, query: TasksListQueryDto) {
    return this.repository.findMany(
      this.resolveCompanyId(currentUser),
      query,
      currentUser.sub,
    );
  }

  /** Resumen para el widget del dashboard (vencidas, proximas 7 dias, mias). */
  summary(currentUser: AuthenticatedUser) {
    return this.repository.summary(
      this.resolveCompanyId(currentUser),
      currentUser.sub,
    );
  }

  async findOne(currentUser: AuthenticatedUser, id: string) {
    const task = await this.repository.findByIdScoped(
      id,
      this.resolveCompanyId(currentUser),
    );
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }

  // --- Mutaciones --------------------------------------------------------------

  async create(currentUser: AuthenticatedUser, dto: CreateTaskDto) {
    const companyId = this.resolveCompanyId(currentUser, dto.companyId);

    // MANUAL no exige origen; los demas exigen sourceId del tenant existente.
    if (dto.sourceType !== 'MANUAL') {
      if (!dto.sourceId) {
        throw new BadRequestException(
          `El origen ${dto.sourceType.toLowerCase()} exige sourceId`,
        );
      }
      await this.assertSourceInScope(dto.sourceType, dto.sourceId, companyId);
    }
    if (dto.ownerId) {
      await this.assertOwnerInScope(dto.ownerId, companyId);
    }

    const task = await this.repository.create(dto, companyId);
    await this.auditService.log({
      user: currentUser,
      action: 'CREATE',
      entity: 'Task',
      entityId: task.id,
      after: task,
    });
    return task;
  }

  async update(currentUser: AuthenticatedUser, id: string, dto: UpdateTaskDto) {
    const companyId = this.resolveCompanyId(currentUser);
    const before = await this.repository.findByIdScoped(id, companyId);
    if (!before) {
      throw new NotFoundException('Task not found');
    }
    if (dto.ownerId) {
      await this.assertOwnerInScope(dto.ownerId, companyId);
    }

    const updated = await this.repository.updateScoped(id, companyId, dto);
    if (!updated) {
      throw new NotFoundException('Task not found');
    }
    await this.auditService.log({
      user: currentUser,
      action: 'UPDATE',
      entity: 'Task',
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
      throw new NotFoundException('Task not found');
    }
    await this.prisma.task.delete({ where: { id } });
    await this.auditService.log({
      user: currentUser,
      action: 'DELETE',
      entity: 'Task',
      entityId: id,
      before,
    });
    return { id, deleted: true };
  }

  // --- Comentarios ---------------------------------------------------------------

  async addComment(
    currentUser: AuthenticatedUser,
    taskId: string,
    dto: CreateTaskCommentDto,
  ) {
    const companyId = this.resolveCompanyId(currentUser);
    const task = await this.repository.findByIdScoped(taskId, companyId);
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    if (task.status === 'DONE' || task.status === 'CANCELLED') {
      throw new BadRequestException(
        'La tarea esta cerrada: reabre la tarea para comentar',
      );
    }

    const comment = await this.repository.createComment(
      taskId,
      currentUser.sub,
      dto,
    );
    await this.auditService.log({
      user: currentUser,
      action: 'CREATE',
      entity: 'TaskComment',
      entityId: comment.id,
      after: { ...comment, taskId },
    });
    return comment;
  }

  async removeComment(
    currentUser: AuthenticatedUser,
    taskId: string,
    commentId: string,
  ) {
    const companyId = this.resolveCompanyId(currentUser);
    const task = await this.repository.findByIdScoped(taskId, companyId);
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    const comment = await this.repository.findCommentByIdScoped(
      commentId,
      taskId,
      companyId,
    );
    if (!comment) {
      throw new NotFoundException('Task comment not found');
    }

    await this.repository.removeComment(commentId);
    await this.auditService.log({
      user: currentUser,
      action: 'DELETE',
      entity: 'TaskComment',
      entityId: commentId,
      before: comment,
    });
    return { id: commentId, deleted: true };
  }

  // --- Generacion automatica desde hallazgos (S15.3) -----------------------------

  /**
   * Al crear un hallazgo MAJOR/CRITICAL se genera una tarea para su
   * responsable; sin responsable, se deja sin asignar para que la bandeja
   * "mis tareas" la muestre a los gestionadores. Idempotente: no duplica
   * tareas activas para el mismo hallazgo. Devuelve la tarea creada o null.
   */
  async createForFinding(finding: {
    id: string;
    title: string;
    severity: string;
    ownerId?: string | null;
    companyId: string;
  }) {
    if (finding.severity !== 'MAJOR' && finding.severity !== 'CRITICAL') {
      return null;
    }
    const existing = await this.prisma.task.findFirst({
      where: {
        sourceType: 'FINDING',
        sourceId: finding.id,
        companyId: finding.companyId,
        status: { in: ['OPEN', 'IN_PROGRESS'] },
      },
      select: { id: true },
    });
    if (existing) {
      return null;
    }

    const priority = finding.severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH';
    const task = await this.prisma.task.create({
      data: {
        title: `Gestionar hallazgo: ${finding.title}`.slice(0, 200),
        description: `Tarea generada automaticamente por el hallazgo ${finding.title} (severidad ${finding.severity}).`,
        sourceType: 'FINDING',
        sourceId: finding.id,
        findingSeverity: finding.severity,
        ownerId: finding.ownerId ?? null,
        priority,
        companyId: finding.companyId,
      },
    });
    return task;
  }

  // --- Validaciones de alcance -------------------------------------------------

  /** Origen trazable: el recurso citado debe existir y ser del tenant (404). */
  private async assertSourceInScope(
    sourceType: string,
    sourceId: string,
    companyId: string,
  ) {
    const source = await this.findSource(sourceType, sourceId, companyId);
    if (!source) {
      throw new NotFoundException('Source not found');
    }
  }

  private findSource(sourceType: string, sourceId: string, companyId: string) {
    switch (sourceType) {
      case 'FINDING':
        return this.prisma.finding.findFirst({
          where: { id: sourceId, companyId },
          select: { id: true },
        });
      case 'ACTION_PLAN':
        return this.prisma.actionPlan.findFirst({
          where: { id: sourceId, companyId },
          select: { id: true },
        });
      case 'CHANGE_REQUEST':
        return this.prisma.changeRequest.findFirst({
          where: { id: sourceId, companyId },
          select: { id: true },
        });
      default:
        return Promise.resolve(null);
    }
  }

  private async assertOwnerInScope(ownerId: string, companyId: string) {
    const owner = await this.prisma.user.findFirst({
      where: { id: ownerId, companyId },
      select: { id: true },
    });
    if (!owner) {
      throw new NotFoundException('Owner not found');
    }
  }
}
