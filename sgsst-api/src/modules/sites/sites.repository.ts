import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { PrismaService } from '../../database/prisma.service';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';

@Injectable()
export class SitesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId: string, query: ListQueryDto = new ListQueryDto()) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const search = query.search?.trim();
    const where: Prisma.SiteWhereInput = {
      companyId,
      isActive: query.isActive,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { code: { contains: search, mode: 'insensitive' } },
              { address: { contains: search, mode: 'insensitive' } },
              { city: { contains: search, mode: 'insensitive' } },
              { department: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.site.findMany({
        where,
        include: { company: { select: { id: true, name: true, nit: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.site.count({ where }),
    ]);
    return {
      data,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  findById(id: string) {
    return this.prisma.site.findUnique({
      where: { id },
      include: { company: { select: { id: true, name: true, nit: true } } },
    });
  }

  /** Variante con aislamiento por empresa: 404 (null) si la sede es de otra empresa. */
  findByIdScoped(id: string, companyId: string) {
    return this.prisma.site.findFirst({
      where: { id, companyId },
      include: { company: { select: { id: true, name: true, nit: true } } },
    });
  }

  findByCode(companyId: string, code: string) {
    return this.prisma.site.findFirst({
      where: { companyId, code, deletedAt: null },
    });
  }

  create(dto: CreateSiteDto, companyId: string) {
    return this.prisma.site.create({
      data: {
        name: dto.name,
        code: dto.code,
        address: dto.address,
        city: dto.city,
        department: dto.department,
        isMain: dto.isMain ?? false,
        companyId,
      },
      include: { company: { select: { id: true, name: true, nit: true } } },
    });
  }

  /** Updates restrictivos: la sede debe pertenecer a la empresa del actor. */
  async updateScoped(id: string, companyId: string, dto: UpdateSiteDto) {
    const result = await this.prisma.site.updateMany({
      where: { id, companyId },
      data: this.toPrismaData(dto) as Prisma.SiteUncheckedUpdateInput,
    });
    if (result.count === 0) {
      return null;
    }
    return this.prisma.site.findFirst({
      where: { id, companyId },
      include: { company: { select: { id: true, name: true, nit: true } } },
    });
  }

  update(id: string, dto: UpdateSiteDto) {
    return this.prisma.site.update({
      where: { id },
      data: this.toPrismaData(dto) as Prisma.SiteUncheckedUpdateInput,
      include: { company: { select: { id: true, name: true, nit: true } } },
    });
  }

  removeScoped(id: string, companyId: string) {
    return this.prisma.site.updateMany({
      where: { id, companyId },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });
  }

  remove(id: string) {
    return this.prisma.site.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });
  }

  private toPrismaData(dto: UpdateSiteDto) {
    return {
      name: dto.name,
      code: dto.code,
      address: dto.address,
      city: dto.city,
      department: dto.department,
      isMain: dto.isMain,
    };
  }
}
