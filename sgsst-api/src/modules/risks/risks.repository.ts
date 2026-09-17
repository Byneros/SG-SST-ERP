import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateRiskDto } from './dto/create-risk.dto';
import { UpdateRiskDto } from './dto/update-risk.dto';

@Injectable()
export class RisksRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(companyId: string) {
    return this.prisma.risk.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  findById(id: string) {
    return this.prisma.risk.findUnique({ where: { id } });
  }

  /** Variante con aislamiento por empresa. */
  findByIdScoped(id: string, companyId: string) {
    return this.prisma.risk.findFirst({ where: { id, companyId } });
  }

  /** Updates restrictivos: el riesgo debe pertenecer a la empresa del actor. */
  async updateScoped(id: string, companyId: string, dto: UpdateRiskDto) {
    const result = await this.prisma.risk.updateMany({
      where: { id, companyId },
      data: {
        title: dto.title,
        description: dto.description,
        level: dto.level as never,
      },
    });
    if (result.count === 0) {
      return null;
    }
    return this.prisma.risk.findFirst({ where: { id, companyId } });
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
      },
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
