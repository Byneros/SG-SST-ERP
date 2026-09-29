import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateRiskDto } from './dto/create-risk.dto';
import { UpdateRiskDto } from './dto/update-risk.dto';

const siteInclude = { site: { select: { id: true, name: true, code: true } } };

@Injectable()
export class RisksRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(companyId: string, siteId?: string) {
    return this.prisma.risk.findMany({
      where: {
        companyId,
        ...(siteId ? (siteId === 'none' ? { siteId: null } : { siteId }) : {}),
      },
      include: siteInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  findById(id: string) {
    return this.prisma.risk.findUnique({ where: { id }, include: siteInclude });
  }

  /** Variante con aislamiento por empresa. */
  findByIdScoped(id: string, companyId: string) {
    return this.prisma.risk.findFirst({
      where: { id, companyId },
      include: siteInclude,
    });
  }

  /** Updates restrictivos: el riesgo debe pertenecer a la empresa del actor. */
  async updateScoped(id: string, companyId: string, dto: UpdateRiskDto) {
    const result = await this.prisma.risk.updateMany({
      where: { id, companyId },
      data: {
        title: dto.title,
        description: dto.description,
        level: dto.level as never,
        siteId: dto.siteId === undefined ? undefined : dto.siteId,
        position: dto.position === undefined ? undefined : dto.position,
      },
    });
    if (result.count === 0) {
      return null;
    }
    return this.prisma.risk.findFirst({
      where: { id, companyId },
      include: siteInclude,
    });
  }

  async removeScoped(id: string, companyId: string) {
    const result = await this.prisma.risk.deleteMany({
      where: { id, companyId },
    });
    return result.count > 0;
  }

  create(dto: CreateRiskDto, companyId: string) {
    return this.prisma.risk.create({
      data: {
        title: dto.title,
        description: dto.description,
        level: dto.level as never,
        companyId,
        siteId: dto.siteId,
        position: dto.position,
      },
      include: siteInclude,
    });
  }

  update(id: string, dto: UpdateRiskDto) {
    return this.prisma.risk.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        level: dto.level as never,
      },
    });
  }

  remove(id: string) {
    return this.prisma.risk.delete({ where: { id } });
  }
}
