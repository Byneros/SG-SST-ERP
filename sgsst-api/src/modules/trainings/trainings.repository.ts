import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateTrainingDto } from './dto/create-training.dto';
import { UpdateTrainingDto } from './dto/update-training.dto';

const siteInclude = { site: { select: { id: true, name: true, code: true } } };

@Injectable()
export class TrainingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(companyId: string, siteId?: string) {
    return this.prisma.training.findMany({
      where: {
        companyId,
        ...(siteId ? (siteId === 'none' ? { siteId: null } : { siteId }) : {}),
      },
      include: siteInclude,
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
      include: siteInclude,
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
      },
    });
    if (result.count === 0) {
      return null;
    }
    return this.prisma.training.findFirst({
      where: { id, companyId },
      include: siteInclude,
    });
  }

  async removeScoped(id: string, companyId: string) {
    const result = await this.prisma.training.deleteMany({
      where: { id, companyId },
    });
    return result.count > 0;
  }

  create(dto: CreateTrainingDto, companyId: string) {
    return this.prisma.training.create({
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
}
