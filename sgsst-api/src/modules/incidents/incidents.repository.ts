import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { AuthenticatedUser } from '../../common/types/authenticated-request';

@Injectable()
export class IncidentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(user: AuthenticatedUser, companyId: string, query: ListQueryDto) {
    return this.prisma.incident.findMany({
      where: { companyId },
      orderBy: { date: 'desc' },
    });
  }

  findById(id: string) {
    return this.prisma.incident.findUnique({ where: { id } });
  }

  /** Variante con aislamiento por empresa. */
  findByIdScoped(id: string, companyId: string) {
    return this.prisma.incident.findFirst({ where: { id, companyId } });
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
      },
    });
    if (result.count === 0) {
      return null;
    }
    return this.prisma.incident.findFirst({ where: { id, companyId } });
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
      },
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
}
