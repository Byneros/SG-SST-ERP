import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { PrismaService } from '../../database/prisma.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { CreateDocumentVersionDto } from './dto/create-document-version.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';

const documentInclude = {
  company: { select: { id: true, name: true, nit: true } },
  site: { select: { id: true, name: true, code: true } },
  approvals: {
    orderBy: { approvedAt: 'desc' as const },
    include: { approver: { select: { id: true, name: true, email: true } } },
  },
};

@Injectable()
export class DocumentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    companyId?: string,
    query: ListQueryDto = new ListQueryDto(),
    siteId?: string,
  ) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const search = query.search?.trim();
    const where: Prisma.DocumentWhereInput = {
      companyId,
      ...(siteId ? (siteId === 'none' ? { siteId: null } : { siteId }) : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
              { fileName: { contains: search, mode: 'insensitive' } },
              { company: { name: { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.document.findMany({
        where,
        include: {
          ...documentInclude,
          versions: { orderBy: { version: 'desc' }, take: 3 },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.document.count({ where }),
    ]);
    return {
      data,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  findById(id: string) {
    return this.prisma.document.findUnique({
      where: { id },
      include: {
        ...documentInclude,
        versions: { orderBy: { version: 'desc' } },
      },
    });
  }

  /** Variante con aislamiento por empresa: null si el documento es de otra empresa. */
  findByIdScoped(id: string, companyId: string) {
    return this.prisma.document.findFirst({
      where: { id, companyId },
      include: {
        ...documentInclude,
        versions: { orderBy: { version: 'desc' } },
      },
    });
  }

  /** Updates restrictivos: el documento debe pertenecer a la empresa del actor. */
  async updateScoped(id: string, companyId: string, dto: UpdateDocumentDto) {
    const current = await this.prisma.document.findFirst({
      where: { id, companyId },
      select: { version: true },
    });
    if (!current) {
      return null;
    }
    return this.prisma.document.update({
      where: { id },
      data: this.toPrismaData(dto),
      include: {
        ...documentInclude,
        versions: { orderBy: { version: 'desc' } },
      },
    });
  }

  async createVersionScoped(
    id: string,
    companyId: string,
    dto: CreateDocumentVersionDto,
  ) {
    const current = await this.prisma.document.findFirst({
      where: { id, companyId },
      select: { version: true },
    });
    if (!current) {
      return null;
    }
    const nextVersion = current.version + 1;
    return this.prisma.document.update({
      where: { id },
      data: {
        version: nextVersion,
        fileUrl: dto.fileUrl,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        status: 'DRAFT',
        versions: {
          create: {
            version: nextVersion,
            fileUrl: dto.fileUrl,
            fileName: dto.fileName,
            mimeType: dto.mimeType,
            notes: dto.notes,
          },
        },
      },
      include: {
        ...documentInclude,
        versions: { orderBy: { version: 'desc' } },
      },
    });
  }

  /** Borrado fisico restrictivo; el archivo en storage lo elimina el servicio. */
  async removeScoped(id: string, companyId: string) {
    const result = await this.prisma.document.deleteMany({
      where: { id, companyId },
    });
    return result.count > 0;
  }

  create(dto: CreateDocumentDto) {
    return this.prisma.document.create({
      data: {
        ...(this.toPrismaData(dto) as Prisma.DocumentUncheckedCreateInput),
        status: 'DRAFT',
        versions: {
          create: {
            version: 1,
            fileUrl: dto.fileUrl,
            fileName: dto.fileName,
            mimeType: dto.mimeType,
            notes: 'Version inicial',
          },
        },
      },
      include: {
        ...documentInclude,
        versions: { orderBy: { version: 'desc' } },
      },
    });
  }

  update(id: string, dto: UpdateDocumentDto) {
    return this.prisma.document.update({
      where: { id },
      data: this.toPrismaData(dto),
      include: {
        ...documentInclude,
        versions: { orderBy: { version: 'desc' } },
      },
    });
  }

  async createVersion(id: string, dto: CreateDocumentVersionDto) {
    const document = await this.prisma.document.findUniqueOrThrow({
      where: { id },
      select: { version: true },
    });
    const nextVersion = document.version + 1;
    return this.prisma.document.update({
      where: { id },
      data: {
        version: nextVersion,
        fileUrl: dto.fileUrl,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        status: 'DRAFT',
        versions: {
          create: {
            version: nextVersion,
            fileUrl: dto.fileUrl,
            fileName: dto.fileName,
            mimeType: dto.mimeType,
            notes: dto.notes,
          },
        },
      },
      include: {
        ...documentInclude,
        versions: { orderBy: { version: 'desc' } },
      },
    });
  }

  /** Borrado fisico; el archivo en storage lo elimina el servicio. */
  remove(id: string) {
    return this.prisma.document.delete({ where: { id } });
  }

  async approveScoped(
    id: string,
    companyId: string,
    approverId: string,
    comments?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const document = await tx.document.findFirst({
        where: { id, companyId, status: 'DRAFT' },
        select: { id: true, version: true },
      });
      if (!document) return null;

      await tx.documentApproval.create({
        data: {
          documentId: document.id,
          version: document.version,
          approverId,
          comments,
        },
      });
      return tx.document.update({
        where: { id },
        data: { status: 'PUBLISHED' },
        include: {
          ...documentInclude,
          versions: { orderBy: { version: 'desc' } },
        },
      });
    });
  }

  async transitionStatusScoped(
    id: string,
    companyId: string,
    status: 'EXPIRED' | 'ARCHIVED',
  ) {
    const result = await this.prisma.document.updateMany({
      where: { id, companyId },
      data: { status },
    });
    if (result.count === 0) return null;
    return this.findByIdScoped(id, companyId);
  }

  private toPrismaData(dto: CreateDocumentDto | UpdateDocumentDto) {
    return {
      ...dto,
      category: dto.category as never,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    };
  }
}
