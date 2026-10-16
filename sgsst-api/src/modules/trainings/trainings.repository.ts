import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateTrainingDto } from './dto/create-training.dto';
import { UpdateTrainingDto } from './dto/update-training.dto';

/** #58: asistente ya validado/normalizado por el service, listo para create. */
export type TrainingAttendeeCreateData = {
  employeeId?: string | null;
  name: string;
  score?: number | null;
  status?: 'ATTENDED' | 'PASSED' | 'FAILED';
  expiresAt: Date | null;
  evidenceId?: string | null;
  notes?: string | null;
};

const siteInclude = { site: { select: { id: true, name: true, code: true } } };

/** #58: asistentes con trabajador/evidencia para listado y detalle. */
export const attendeeInclude = {
  attendees: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      employee: {
        select: { id: true, firstName: true, lastName: true, document: true },
      },
      evidence: { select: { id: true, name: true, fileUrl: true } },
    },
  },
};

@Injectable()
export class TrainingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(companyId: string, siteId?: string) {
    return this.prisma.training.findMany({
      where: {
        companyId,
        ...(siteId ? (siteId === 'none' ? { siteId: null } : { siteId }) : {}),
      },
      include: { ...siteInclude, ...attendeeInclude },
      orderBy: { date: 'desc' },
    });
  }

  findById(id: string) {
    return this.prisma.training.findUnique({
      where: { id },
      include: siteInclude,
    });
  }

  /** Variante con aislamiento por empresa. */
  findByIdScoped(id: string, companyId: string) {
    return this.prisma.training.findFirst({
      where: { id, companyId },
      include: { ...siteInclude, ...attendeeInclude },
    });
  }

  /** Updates restrictivos: la capacitación debe pertenecer a la empresa del actor. */
  async updateScoped(id: string, companyId: string, dto: UpdateTrainingDto) {
    const result = await this.prisma.training.updateMany({
      where: { id, companyId },
      data: {
        title: dto.title,
        description: dto.description,
        date: dto.date ? new Date(dto.date) : undefined,
        siteId: dto.siteId === undefined ? undefined : dto.siteId,
        instructor: dto.instructor === undefined ? undefined : dto.instructor,
        validityMonths:
          dto.validityMonths === undefined ? undefined : dto.validityMonths,
      },
    });
    if (result.count === 0) {
      return null;
    }
    return this.prisma.training.findFirst({
      where: { id, companyId },
      include: { ...siteInclude, ...attendeeInclude },
    });
  }

  async removeScoped(id: string, companyId: string) {
    const result = await this.prisma.training.deleteMany({
      where: { id, companyId },
    });
    return result.count > 0;
  }

  create(
    dto: CreateTrainingDto,
    companyId: string,
    attendees?: TrainingAttendeeCreateData[],
  ) {
    return this.prisma.training.create({
      data: {
        title: dto.title,
        description: dto.description,
        date: new Date(dto.date),
        companyId,
        siteId: dto.siteId,
        ...(dto.instructor !== undefined ? { instructor: dto.instructor } : {}),
        ...(dto.validityMonths !== undefined
          ? { validityMonths: dto.validityMonths }
          : {}),
        // Asistentes resueltos por el service (validaciones + vencimiento).
        ...(attendees?.length
          ? { attendees: { create: attendees as never[] } }
          : {}),
      },
      include: { ...siteInclude, ...attendeeInclude },
    });
  }

  update(id: string, dto: UpdateTrainingDto) {
    return this.prisma.training.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        date: dto.date ? new Date(dto.date) : undefined,
      },
    });
  }

  remove(id: string) {
    return this.prisma.training.delete({ where: { id } });
  }

  /**
   * Asistente IA (fase H1): todas las capacitaciones con datos agregables
   * (titulo, anio, sede). Solo lectura y siempre scoped por companyId.
   */
  findAllForAssistant(companyId: string) {
    return this.prisma.training.findMany({
      where: { companyId },
      select: {
        title: true,
        description: true,
        date: true,
        siteId: true,
      },
      orderBy: { date: 'desc' },
    });
  }

  //----- asistentes (#58) -----------------------------------------------------
  findEmployeeScoped(employeeId: string, companyId: string) {
    return this.prisma.employee.findFirst({
      where: { id: employeeId, companyId },
      select: { id: true, firstName: true, lastName: true },
    });
  }

  createAttendee(
    trainingId: string,
    data: {
      employeeId: string | null;
      name: string;
      score?: number | null;
      status?: 'ATTENDED' | 'PASSED' | 'FAILED';
      expiresAt: Date | null;
      evidenceId?: string | null;
      notes?: string | null;
    },
  ) {
    return this.prisma.trainingAttendee.create({
      data: {
        trainingId,
        employeeId: data.employeeId,
        name: data.name,
        score: data.score,
        status: data.status,
        expiresAt: data.expiresAt,
        evidenceId: data.evidenceId,
        notes: data.notes,
      },
      include: attendeeInclude.attendees.include,
    });
  }

  findAttendeeScoped(id: string, companyId: string) {
    return this.prisma.trainingAttendee.findFirst({
      where: { id, training: { companyId } },
      include: {
        training: { select: { id: true, title: true, date: true, validityMonths: true } },
        employee: {
          select: { id: true, firstName: true, lastName: true, document: true },
        },
        evidence: { select: { id: true, name: true, fileUrl: true } },
      },
    });
  }

  updateAttendee(
    id: string,
    data: Prisma.TrainingAttendeeUpdateInput,
  ) {
    return this.prisma.trainingAttendee.update({
      where: { id },
      data,
      include: {
        training: { select: { id: true, title: true, date: true, validityMonths: true } },
        employee: {
          select: { id: true, firstName: true, lastName: true, document: true },
        },
        evidence: { select: { id: true, name: true, fileUrl: true } },
      },
    });
  }

  removeAttendee(id: string) {
    return this.prisma.trainingAttendee.delete({ where: { id } });
  }

  /**
   * Dashboard de vencimientos (#58): certificados (expiresAt) vencidos o que
   * vencen en la ventana indicada, con datos del trabajador y la capacitación.
   */
  findExpiringAttendees(companyId: string, now: Date, until: Date) {
    return this.prisma.trainingAttendee.findMany({
      where: {
        training: { companyId },
        expiresAt: { not: null, lte: until },
      },
      include: {
        training: { select: { id: true, title: true, date: true } },
        employee: {
          select: { id: true, firstName: true, lastName: true, document: true },
        },
      },
      orderBy: { expiresAt: 'asc' },
    });
  }

  /** Conteo por bucket para el resumen del dashboard de vencimientos. */
  countAttendeeExpirationBuckets(companyId: string, now: Date, soon: Date) {
    return this.prisma.$transaction([
      this.prisma.trainingAttendee.count({
        where: { training: { companyId }, expiresAt: { not: null, lt: now } },
      }),
      this.prisma.trainingAttendee.count({
        where: {
          training: { companyId },
          expiresAt: { not: null, gte: now, lte: soon },
        },
      }),
    ]);
  }
}
