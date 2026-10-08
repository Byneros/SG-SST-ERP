import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { AuthenticatedUser } from '../../common/types/authenticated-request';

const siteInclude = { site: { select: { id: true, name: true, code: true } } };

@Injectable()
export class IncidentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Listado paginado ({ data, meta }), mismo contrato que employees/sites. */
  async findAll(
    user: AuthenticatedUser,
    companyId: string,
    query: ListQueryDto,
    siteId?: string,
  ) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const search = query.search?.trim();
    const where = {
      companyId,
      ...(siteId ? (siteId === 'none' ? { siteId: null } : { siteId }) : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' as const } },
              {
                description: {
                  contains: search,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.incident.findMany({
        where,
        include: siteInclude,
        orderBy: { date: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.incident.count({ where }),
    ]);
    return {
      data,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  findById(id: string) {
    return this.prisma.incident.findUnique({
      where: { id },
      include: siteInclude,
    });
  }

  /** Variante con aislamiento por empresa. */
  findByIdScoped(id: string, companyId: string) {
    return this.prisma.incident.findFirst({
      where: { id, companyId },
      include: siteInclude,
    });
  }

  /** Updates restrictivos: el incidente debe pertenecer a la empresa del actor. */
  async updateScoped(id: string, companyId: string, dto: UpdateIncidentDto) {
    const result = await this.prisma.incident.updateMany({
      where: { id, companyId },
      data: {
        title: dto.title,
        description: dto.description,
        date: dto.date ? new Date(dto.date) : undefined,
        status: dto.status as never,
        siteId: dto.siteId === undefined ? undefined : dto.siteId,
      },
    });
    if (result.count === 0) {
      return null;
    }
    return this.prisma.incident.findFirst({
      where: { id, companyId },
      include: siteInclude,
    });
  }

  async removeScoped(id: string, companyId: string) {
    const result = await this.prisma.incident.deleteMany({
      where: { id, companyId },
    });
    return result.count > 0;
  }

  create(dto: CreateIncidentDto, companyId: string) {
    return this.prisma.incident.create({
      data: {
        title: dto.title,
        description: dto.description,
        date: new Date(dto.date),
        companyId,
        siteId: dto.siteId,
      },
      include: siteInclude,
    });
  }

  update(id: string, dto: UpdateIncidentDto) {
    return this.prisma.incident.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        date: dto.date ? new Date(dto.date) : undefined,
        status: dto.status as never,
      },
    });
  }

  remove(id: string) {
    return this.prisma.incident.delete({ where: { id } });
  }

  /**
   * Asistente IA (fase F): todos los incidentes de la empresa (solo campos
   * agregables). Solo lectura y siempre scoped por companyId.
   */
  findAllForAssistant(companyId: string) {
    return this.prisma.incident.findMany({
      where: { companyId },
      select: {
        title: true,
        description: true,
        date: true,
        status: true,
      },
      orderBy: { date: 'desc' },
    });
  }
}
