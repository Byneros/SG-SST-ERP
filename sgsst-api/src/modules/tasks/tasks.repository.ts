import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type {
  CreateTaskCommentDto,
  CreateTaskDto,
  TasksListQueryDto,
  UpdateTaskDto,
} from './dto/task.dto';

const taskInclude = {
  owner: { select: { id: true, name: true, email: true } },
  company: { select: { id: true, name: true } },
  comments: {
    orderBy: { createdAt: 'asc' as const },
    include: { author: { select: { id: true, name: true } } },
  },
} satisfies Prisma.TaskInclude;

@Injectable()
export class TasksRepository {
  constructor(private readonly prisma: PrismaService) {}

  // --- Listado -----------------------------------------------------------------

  async findMany(
    companyId: string,
    query: TasksListQueryDto,
    currentUserId: string,
  ) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const search = query.search?.trim();
    const activeStatuses = ['OPEN', 'IN_PROGRESS'] as const;
    const now = new Date();
    const where: Prisma.TaskWhereInput = {
      companyId,
      ...(query.sourceType ? { sourceType: query.sourceType } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.ownerId ? { ownerId: query.ownerId } : {}),
      ...(query.assignee === 'me'
        ? { OR: [{ ownerId: currentUserId }, { ownerId: null }] }
        : {}),
      ...(query.overdue === 'true'
        ? {
            status: { in: [...activeStatuses] },
            dueDate: { lt: now },
          }
        : {}),
      ...(query.dueWithinDays
        ? {
            status: { in: [...activeStatuses] },
            dueDate: {
              gte: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
              lte: new Date(
                now.getTime() + query.dueWithinDays * 24 * 60 * 60 * 1000,
              ),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    // Orden: vencen primero (sin fecha al final), luego prioridad desc y mas recientes.
    const [data, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        include: taskInclude,
        orderBy: [
          { dueDate: { sort: 'asc', nulls: 'last' } },
          { priority: 'desc' },
          { createdAt: 'desc' },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.task.count({ where }),
    ]);
    return {
      data,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  /** Resumen para el widget del dashboard (mismo tenant). */
  async summary(companyId: string, currentUserId: string) {
    const activeStatuses = ['OPEN', 'IN_PROGRESS'] as const;
    const now = new Date();
    const next7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const mineOrUnassigned = {
      OR: [{ ownerId: currentUserId }, { ownerId: null }],
    };
    const [total, overdue, dueSoon, mine, mineOverdue] =
      await this.prisma.$transaction([
        this.prisma.task.count({
          where: { companyId, status: { in: [...activeStatuses] } },
        }),
        this.prisma.task.count({
          where: {
            companyId,
            status: { in: [...activeStatuses] },
            dueDate: { lt: now },
          },
        }),
        this.prisma.task.count({
          where: {
            companyId,
            status: { in: [...activeStatuses] },
            dueDate: { gte: now, lte: next7Days },
          },
        }),
        this.prisma.task.count({
          where: {
            companyId,
            status: { in: [...activeStatuses] },
            ...mineOrUnassigned,
          },
        }),
        this.prisma.task.count({
          where: {
            companyId,
            status: { in: [...activeStatuses] },
            dueDate: { lt: now },
            ...mineOrUnassigned,
          },
        }),
      ]);
    return { total, overdue, dueSoon, mine, mineOverdue };
  }

  findByIdScoped(id: string, companyId: string) {
    return this.prisma.task.findFirst({
      where: { id, companyId },
      include: taskInclude,
    });
  }

  // --- Mutaciones --------------------------------------------------------------

  create(dto: CreateTaskDto, companyId: string) {
    return this.prisma.task.create({
      data: {
        title: dto.title,
        description: dto.description ?? null,
        sourceType: dto.sourceType,
        sourceId: dto.sourceId ?? null,
        ownerId: dto.ownerId ?? null,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        priority: dto.priority ?? 'MEDIUM',
        companyId,
      },
      include: taskInclude,
    });
  }

  async updateScoped(id: string, companyId: string, dto: UpdateTaskDto) {
    const data: Prisma.TaskUncheckedUpdateInput = {
      title: dto.title,
      description: dto.description,
      ownerId: dto.ownerId === undefined ? undefined : dto.ownerId,
      dueDate:
        dto.dueDate === undefined
          ? undefined
          : dto.dueDate
            ? new Date(dto.dueDate)
            : null,
      priority: dto.priority,
      status: dto.status,
      // Cierre/cancelacion sella la fecha; reabrir la limpia (patron findings).
      closedAt:
        dto.status === 'DONE' || dto.status === 'CANCELLED'
          ? new Date()
          : dto.status === undefined
            ? undefined
            : null,
    };
    const result = await this.prisma.task.updateMany({
      where: { id, companyId },
      data,
    });
    if (result.count === 0) {
      return null;
    }
    return this.findByIdScoped(id, companyId);
  }

  // --- Comentarios -------------------------------------------------------------

  createComment(taskId: string, authorId: string, dto: CreateTaskCommentDto) {
    return this.prisma.taskComment.create({
      data: {
        taskId,
        authorId,
        body: dto.body,
      },
      include: { author: { select: { id: true, name: true } } },
    });
  }

  findCommentByIdScoped(commentId: string, taskId: string, companyId: string) {
    return this.prisma.taskComment.findFirst({
      where: { id: commentId, taskId, task: { companyId } },
    });
  }

  removeComment(commentId: string) {
    return this.prisma.taskComment.delete({ where: { id: commentId } });
  }
}
