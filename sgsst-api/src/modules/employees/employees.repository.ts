import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { PrismaService } from '../../database/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

@Injectable()
export class EmployeesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    companyId?: string,
    query: ListQueryDto = new ListQueryDto(),
    siteId?: string,
  ) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const search = query.search?.trim();
    const where: Prisma.EmployeeWhereInput = {
      companyId,
      isActive: query.isActive,
      ...(siteId ? (siteId === 'none' ? { siteId: null } : { siteId }) : {}),
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { document: { contains: search, mode: 'insensitive' } },
              { position: { contains: search, mode: 'insensitive' } },
              { workCenter: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const employeeInclude = {
      company: { select: { id: true, name: true, nit: true } },
      site: { select: { id: true, name: true, code: true } },
    } satisfies Prisma.EmployeeInclude;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.employee.findMany({
        where,
        include: employeeInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.employee.count({ where }),
    ]);
    return {
      data,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  findById(id: string) {
    return this.prisma.employee.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, name: true, nit: true } },
        site: { select: { id: true, name: true, code: true } },
      },
    });
  }

  /** Variante con aislamiento por empresa: 404 (null) si el recurso es de otra empresa. */
  findByIdScoped(id: string, companyId: string) {
    return this.prisma.employee.findFirst({
      where: { id, companyId },
      include: {
        company: { select: { id: true, name: true, nit: true } },
        site: { select: { id: true, name: true, code: true } },
      },
    });
  }

  /** Updates restrictivos: el registro debe pertenecer a la empresa del actor. */
  updateScoped(id: string, companyId: string, dto: UpdateEmployeeDto) {
    return this.prisma.employee.updateMany({
      where: { id, companyId },
      data: {
        ...(this.toPrismaData(dto) as Prisma.EmployeeUncheckedUpdateInput),
        deletedAt:
          dto.isActive === undefined
            ? undefined
            : dto.isActive
              ? null
              : new Date(),
      },
    });
  }

  removeScoped(id: string, companyId: string) {
    return this.prisma.employee.updateMany({
      where: { id, companyId },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });
  }

  findByDocument(document: string) {
    return this.prisma.employee.findUnique({ where: { document } });
  }

  create(dto: CreateEmployeeDto) {
    return this.prisma.employee.create({
      data: this.toPrismaData(dto) as Prisma.EmployeeUncheckedCreateInput,
      include: {
        company: { select: { id: true, name: true, nit: true } },
        site: { select: { id: true, name: true, code: true } },
      },
    });
  }

  update(id: string, dto: UpdateEmployeeDto) {
    return this.prisma.employee.update({
      where: { id },
      data: {
        ...(this.toPrismaData(dto) as Prisma.EmployeeUncheckedUpdateInput),
        deletedAt:
          dto.isActive === undefined
            ? undefined
            : dto.isActive
              ? null
              : new Date(),
      },
    });
  }

  remove(id: string) {
    return this.prisma.employee.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });
  }

  private toPrismaData(dto: CreateEmployeeDto | UpdateEmployeeDto) {
    return {
      ...dto,
      documentType: dto.documentType as never,
      contractType: dto.contractType as never,
      employmentStatus: dto.employmentStatus as never,
      hireDate: dto.hireDate ? new Date(dto.hireDate) : undefined,
    };
  }
}
