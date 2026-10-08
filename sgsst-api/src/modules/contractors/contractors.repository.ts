import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type {
  ContractorListQueryDto,
  CreateContractorDocumentDto,
  CreateContractorDto,
  CreateContractorWorkerDto,
  UpdateContractorDocumentDto,
  UpdateContractorDto,
  UpdateContractorWorkerDto,
} from './dto/contractor.dto';

const contractorInclude = {
  _count: { select: { workers: true, documents: true } },
  documents: {
    orderBy: { createdAt: 'desc' as const },
  },
} satisfies Prisma.ContractorInclude;

const workerInclude = {
  contractor: {
    select: { id: true, name: true, nit: true, status: true },
  },
  // S13.2: sede donde el trabajador ejecuta su actividad.
  site: {
    select: { id: true, name: true, code: true },
  },
} satisfies Prisma.ContractorWorkerInclude;

const documentInclude = {
  evidence: {
    select: { id: true, name: true, status: true, expiresAt: true },
  },
} satisfies Prisma.ContractorDocumentInclude;

@Injectable()
export class ContractorsRepository {
  constructor(private readonly prisma: PrismaService) {}

  // --- Contratistas -----------------------------------------------------------

  async findMany(companyId: string, query: ContractorListQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const search = query.search?.trim();
    const where: Prisma.ContractorWhereInput = {
      companyId,
      ...(query.status ? { status: query.status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { nit: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.contractor.findMany({
        where,
        include: contractorInclude,
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.contractor.count({ where }),
    ]);
    return {
      data,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  findByIdScoped(id: string, companyId: string) {
    return this.prisma.contractor.findFirst({
      where: { id, companyId },
      include: contractorInclude,
    });
  }

  create(dto: CreateContractorDto, companyId: string) {
    return this.prisma.contractor.create({
      data: {
        name: dto.name,
        nit: dto.nit,
        contact: dto.contact,
        phone: dto.phone,
        arl: dto.arl,
        activity: dto.activity,
        status: dto.status,
        companyId,
      },
    });
  }

  async updateScoped(id: string, companyId: string, dto: UpdateContractorDto) {
    const result = await this.prisma.contractor.updateMany({
      where: { id, companyId },
      data: {
        name: dto.name,
        nit: dto.nit,
        contact: dto.contact,
        phone: dto.phone,
        arl: dto.arl,
        activity: dto.activity,
        status: dto.status,
      },
    });
    if (result.count === 0) {
      return null;
    }
    return this.findByIdScoped(id, companyId);
  }

  /** Hard delete con traza (ADR); Cascade limpia workers y documents. */
  async removeScoped(id: string, companyId: string) {
    const before = await this.findByIdScoped(id, companyId);
    if (!before) {
      return null;
    }
    await this.prisma.contractor.delete({ where: { id } });
    return before;
  }

  /** S13.4: persiste la etapa del flujo de ingreso (scoped por empresa). */
  async updateEntryStatus(
    id: string,
    companyId: string,
    entryStatus: 'INDUCTION' | 'AUTHORIZED' | 'WORK' | 'CLOSED',
  ) {
    const result = await this.prisma.contractor.updateMany({
      where: { id, companyId },
      data: { entryStatus },
    });
    if (result.count === 0) {
      return null;
    }
    return this.findByIdScoped(id, companyId);
  }

  // --- Personal ---------------------------------------------------------------

  findWorkers(contractorId: string, companyId: string) {
    return this.prisma.contractorWorker.findMany({
      where: { contractorId, companyId },
      include: workerInclude,
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }

  findWorkerByIdScoped(id: string, companyId: string) {
    return this.prisma.contractorWorker.findFirst({
      where: { id, companyId },
      include: workerInclude,
    });
  }

  createWorker(
    dto: CreateContractorWorkerDto,
    contractorId: string,
    companyId: string,
  ) {
    return this.prisma.contractorWorker.create({
      data: {
        document: dto.document,
        firstName: dto.firstName,
        lastName: dto.lastName,
        job: dto.job,
        siteId: dto.siteId ?? null,
        inductedAt: dto.inductedAt ? new Date(dto.inductedAt) : null,
        status: dto.status,
        contractorId,
        companyId,
      },
    });
  }

  async updateWorkerScoped(
    id: string,
    companyId: string,
    dto: UpdateContractorWorkerDto,
  ) {
    const result = await this.prisma.contractorWorker.updateMany({
      where: { id, companyId },
      data: {
        document: dto.document,
        firstName: dto.firstName,
        lastName: dto.lastName,
        job: dto.job,
        // undefined = no tocar; null = desasignar sede.
        siteId: dto.siteId !== undefined ? (dto.siteId ?? null) : undefined,
        inductedAt: dto.inductedAt ? new Date(dto.inductedAt) : null,
        status: dto.status,
      },
    });
    if (result.count === 0) {
      return null;
    }
    return this.findWorkerByIdScoped(id, companyId);
  }

  async removeWorkerScoped(id: string, companyId: string) {
    const before = await this.findWorkerByIdScoped(id, companyId);
    if (!before) {
      return null;
    }
    await this.prisma.contractorWorker.delete({ where: { id } });
    return before;
  }

  // --- Documentos -------------------------------------------------------------

  findDocuments(contractorId: string, companyId: string) {
    return this.prisma.contractorDocument.findMany({
      where: { contractorId, companyId },
      include: documentInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  findDocumentByIdScoped(id: string, companyId: string) {
    return this.prisma.contractorDocument.findFirst({
      where: { id, companyId },
      include: documentInclude,
    });
  }

  createDocument(
    dto: CreateContractorDocumentDto,
    contractorId: string,
    companyId: string,
  ) {
    return this.prisma.contractorDocument.create({
      data: {
        documentType: dto.documentType,
        description: dto.description,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        status: dto.status,
        evidenceId: dto.evidenceId,
        contractorId,
        companyId,
      },
      include: documentInclude,
    });
  }

  async updateDocumentScoped(
    id: string,
    companyId: string,
    dto: UpdateContractorDocumentDto,
  ) {
    const result = await this.prisma.contractorDocument.updateMany({
      where: { id, companyId },
      data: {
        documentType: dto.documentType,
        description: dto.description,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        status: dto.status,
        evidenceId: dto.evidenceId,
      },
    });
    if (result.count === 0) {
      return null;
    }
    return this.findDocumentByIdScoped(id, companyId);
  }

  async removeDocumentScoped(id: string, companyId: string) {
    const before = await this.findDocumentByIdScoped(id, companyId);
    if (!before) {
      return null;
    }
    await this.prisma.contractorDocument.delete({ where: { id } });
    return before;
  }

  /**
   * Asistente IA (fase I1): documentos de contratistas vencidos o proximos
   * (30 dias). Solo lectura y siempre scoped por companyId.
   */
  findExpiringDocumentsForAssistant(companyId: string, take: number) {
    return this.prisma.contractorDocument.findMany({
      where: {
        companyId,
        expiresAt: {
          not: null,
          lte: new Date(Date.now() + 30 * 24 * 3600 * 1000),
        },
      },
      select: {
        documentType: true,
        status: true,
        expiresAt: true,
        contractor: { select: { name: true } },
      },
      orderBy: { expiresAt: 'asc' },
      take,
    });
  }

  /**
   * Asistente IA (fase I1): contratistas con etapa del flujo de ingreso y
   * estado. Solo lectura y siempre scoped por companyId.
   */
  findEntryFlowForAssistant(companyId: string) {
    return this.prisma.contractor.findMany({
      where: { companyId },
      select: { entryStatus: true, status: true },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Agregado de autorizacion de ingreso: cuentas por estado de documento y
   * workers activos/inductados. Todo scoped por companyId (regla: no se
   * autoriza ingreso con documentos criticos vencidos o rechazados).
   */
  async getCompliance(contractorId: string, companyId: string) {
    // Tipado explicito de filas: la inferencia de groupBy dentro de
    // $transaction no resuelve _count._all (mismo patron que dashboard.service).
    const [docCounts, workerCounts, contractor] =
      (await this.prisma.$transaction([
        this.prisma.contractorDocument.groupBy({
          by: ['status'],
          where: { contractorId, companyId },
          _count: { _all: true },
          orderBy: { status: 'asc' },
        }),
        this.prisma.contractorWorker.groupBy({
          by: ['status'],
          where: { contractorId, companyId },
          _count: { _all: true },
          orderBy: { status: 'asc' },
        }),
        this.prisma.contractor.findFirst({
          where: { id: contractorId, companyId },
          select: { id: true, status: true, name: true, entryStatus: true },
        }),
      ])) as [
        Array<{ status: string; _count: { _all: number } }>,
        Array<{ status: string; _count: { _all: number } }>,
        {
          id: string;
          status: string;
          name: string;
          entryStatus: string;
        } | null,
      ];

    const byDocumentStatus: Record<string, number> = {};
    for (const row of docCounts) {
      byDocumentStatus[row.status] = row._count._all;
    }
    const byWorkerStatus: Record<string, number> = {};
    for (const row of workerCounts) {
      byWorkerStatus[row.status] = row._count._all;
    }

    const documentsTotal = Object.values(byDocumentStatus).reduce(
      (a, b) => a + b,
      0,
    );
    const expired = byDocumentStatus.EXPIRED ?? 0;
    const rejected = byDocumentStatus.REJECTED ?? 0;
    const pending = byDocumentStatus.PENDING ?? 0;
    const workersActive = byWorkerStatus.ACTIVE ?? 0;

    const hasBlockingDocs = expired > 0 || rejected > 0;
    const hasPendingDocs = pending > 0;
    const canAuthorizeEntry =
      Boolean(contractor) &&
      contractor?.status === 'ACTIVE' &&
      !hasBlockingDocs &&
      !hasPendingDocs &&
      documentsTotal > 0;

    return {
      contractor: contractor ?? null,
      documentsTotal,
      byDocumentStatus,
      workersTotal: Object.values(byWorkerStatus).reduce((a, b) => a + b, 0),
      workersActive,
      canAuthorizeEntry,
      blockingReasons: [
        ...(contractor?.status !== 'ACTIVE' && contractor
          ? [`contratista ${contractor.status.toLowerCase()}`]
          : []),
        ...(hasBlockingDocs ? ['documentos vencidos o rechazados'] : []),
        ...(hasPendingDocs ? ['documentos pendientes de validacion'] : []),
        ...(documentsTotal === 0 ? ['sin documentos registrados'] : []),
      ],
    };
  }
}
