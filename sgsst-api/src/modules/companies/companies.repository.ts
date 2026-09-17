import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { PrismaService } from '../../database/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListQueryDto, companyId?: string) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const search = query.search?.trim();
    const where: Prisma.CompanyWhereInput = {
      ...(companyId ? { id: companyId } : {}),
      isActive: query.isActive,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { nit: { contains: search, mode: 'insensitive' } },
              { arl: { contains: search, mode: 'insensitive' } },
              { city: { contains: search, mode: 'insensitive' } },
              { department: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.company.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.company.count({ where }),
    ]);
    return {
      data,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  findById(id: string) {
    return this.prisma.company.findUnique({ where: { id } });
  }

  findByNit(nit: string) {
    return this.prisma.company.findUnique({ where: { nit } });
  }

  create(dto: CreateCompanyDto) {
    return this.prisma.company.create({
      data: this.toPrismaData(dto) as Prisma.CompanyUncheckedCreateInput,
    });
  }

  update(id: string, dto: UpdateCompanyDto) {
    return this.prisma.company.update({
      where: { id },
      data: {
        ...(this.toPrismaData(dto) as Prisma.CompanyUncheckedUpdateInput),
        deletedAt:
          dto.isActive === undefined ? undefined : dto.isActive ? null : new Date(),
      },
    });
  }

  remove(id: string) {
    return this.prisma.company.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });
  }

  deleteById(id: string) {
    return this.prisma.company.delete({ where: { id } });
  }

  private toPrismaData(dto: CreateCompanyDto | UpdateCompanyDto) {
    return {
      ...dto,
      riskClass: dto.riskClass as never,
    };
  }
}
