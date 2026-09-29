import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { resolveCompanyScope } from '../../common/pipes/company-scope';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../../database/prisma.service';
import { ContractorsRepository } from './contractors.repository';
import type {
  ContractorListQueryDto,
  CreateContractorDocumentDto,
  CreateContractorDto,
  CreateContractorWorkerDto,
  UpdateContractorDocumentDto,
  UpdateContractorDto,
  UpdateContractorWorkerDto,
} from './dto/contractor.dto';

/** Documento vencido si tiene vigencia y ya paso. */
function isExpired(expiresAt: Date | null | undefined): boolean {
  return Boolean(expiresAt && expiresAt.getTime() < Date.now());
}

@Injectable()
export class ContractorsService {
  constructor(
    private readonly repository: ContractorsRepository,
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private resolveCompanyId(
    currentUser: AuthenticatedUser,
    companyId?: string,
  ): string {
    return resolveCompanyScope(currentUser, companyId);
  }

  // --- Contratistas -----------------------------------------------------------

  findMany(currentUser: AuthenticatedUser, query: ContractorListQueryDto) {
    const companyId = this.resolveCompanyId(currentUser);
    return this.repository.findMany(companyId, query);
  }

  async findOne(currentUser: AuthenticatedUser, id: string) {
    const contractor = await this.repository.findByIdScoped(
      id,
      this.resolveCompanyId(currentUser),
    );
    if (!contractor) {
      throw new NotFoundException('Contractor not found');
    }
    return contractor;
  }

  async create(currentUser: AuthenticatedUser, dto: CreateContractorDto) {
    const companyId = this.resolveCompanyId(currentUser, dto.companyId);

    const duplicated = await this.prisma.contractor.findFirst({
      where: { companyId, nit: dto.nit },
      select: { id: true },
    });
    if (duplicated) {
      throw new BadRequestException(
        'Ya existe un contratista con ese NIT en la empresa',
      );
    }

    const contractor = await this.repository.create(dto, companyId);
    await this.auditService.log({
      user: currentUser,
      action: 'CREATE',
      entity: 'Contractor',
      entityId: contractor.id,
      after: contractor,
    });
    return contractor;
  }

  async update(
    currentUser: AuthenticatedUser,
    id: string,
    dto: UpdateContractorDto,
  ) {
    const companyId = this.resolveCompanyId(currentUser);
    const before = await this.repository.findByIdScoped(id, companyId);
    if (!before) {
      throw new NotFoundException('Contractor not found');
    }
    if (dto.nit && dto.nit !== before.nit) {
      const duplicated = await this.prisma.contractor.findFirst({
        where: { companyId, nit: dto.nit },
        select: { id: true },
      });
      if (duplicated) {
        throw new BadRequestException(
          'Ya existe un contratista con ese NIT en la empresa',
        );
      }
    }

    const updated = await this.repository.updateScoped(id, companyId, dto);
    if (!updated) {
      throw new NotFoundException('Contractor not found');
    }
    await this.auditService.log({
      user: currentUser,
      action: 'UPDATE',
      entity: 'Contractor',
      entityId: id,
      before,
      after: updated,
    });
    return updated;
  }

  async remove(currentUser: AuthenticatedUser, id: string) {
    const companyId = this.resolveCompanyId(currentUser);
    const before = await this.repository.findByIdScoped(id, companyId);
    if (!before) {
      throw new NotFoundException('Contractor not found');
    }
    await this.repository.removeScoped(id, companyId);
    await this.auditService.log({
      user: currentUser,
      action: 'DELETE',
      entity: 'Contractor',
      entityId: id,
      before,
    });
    return { id, deleted: true };
  }

  // --- Personal ---------------------------------------------------------------

  async findWorkers(currentUser: AuthenticatedUser, contractorId: string) {
    await this.findOne(currentUser, contractorId);
    return this.repository.findWorkers(
      contractorId,
      this.resolveCompanyId(currentUser),
    );
  }

  async createWorker(
    currentUser: AuthenticatedUser,
    contractorId: string,
    dto: CreateContractorWorkerDto,
  ) {
    const companyId = this.resolveCompanyId(currentUser, dto.companyId);
    await this.findOne(currentUser, contractorId);

    const duplicated = await this.prisma.contractorWorker.findFirst({
      where: { contractorId, document: dto.document },
      select: { id: true },
    });
    if (duplicated) {
      throw new BadRequestException(
        'Ya existe ese documento para este contratista',
      );
    }

    const worker = await this.repository.createWorker(
      dto,
      contractorId,
      companyId,
    );
    await this.auditService.log({
      user: currentUser,
      action: 'CREATE',
      entity: 'ContractorWorker',
      entityId: worker.id,
      after: worker,
    });
    return worker;
  }

  async updateWorker(
    currentUser: AuthenticatedUser,
    contractorId: string,
    id: string,
    dto: UpdateContractorWorkerDto,
  ) {
    const companyId = this.resolveCompanyId(currentUser);
    const before = await this.repository.findWorkerByIdScoped(id, companyId);
    if (!before || before.contractorId !== contractorId) {
      throw new NotFoundException('Contractor worker not found');
    }
    if (dto.document && dto.document !== before.document) {
      const duplicated = await this.prisma.contractorWorker.findFirst({
        where: { contractorId, document: dto.document },
        select: { id: true },
      });
      if (duplicated) {
        throw new BadRequestException(
          'Ya existe ese documento para este contratista',
        );
      }
    }

    const updated = await this.repository.updateWorkerScoped(
      id,
      companyId,
      dto,
    );
    if (!updated) {
      throw new NotFoundException('Contractor worker not found');
    }
    await this.auditService.log({
      user: currentUser,
      action: 'UPDATE',
      entity: 'ContractorWorker',
      entityId: id,
      before,
      after: updated,
    });
    return updated;
  }

  async removeWorker(
    currentUser: AuthenticatedUser,
    contractorId: string,
    id: string,
  ) {
    const companyId = this.resolveCompanyId(currentUser);
    const before = await this.repository.findWorkerByIdScoped(id, companyId);
    if (!before || before.contractorId !== contractorId) {
      throw new NotFoundException('Contractor worker not found');
    }
    await this.repository.removeWorkerScoped(id, companyId);
    await this.auditService.log({
      user: currentUser,
      action: 'DELETE',
      entity: 'ContractorWorker',
      entityId: id,
      before,
    });
    return { id, deleted: true };
  }

  // --- Documentos -------------------------------------------------------------

  async findDocuments(currentUser: AuthenticatedUser, contractorId: string) {
    await this.findOne(currentUser, contractorId);
    return this.repository.findDocuments(
      contractorId,
      this.resolveCompanyId(currentUser),
    );
  }

  async createDocument(
    currentUser: AuthenticatedUser,
    contractorId: string,
    dto: CreateContractorDocumentDto,
  ) {
    const companyId = this.resolveCompanyId(currentUser, dto.companyId);
    await this.findOne(currentUser, contractorId);

    // Evidencia same-tenant: un documento ajeno no existe para el actor (404).
    if (dto.evidenceId) {
      const evidence = await this.prisma.document.findFirst({
        where: { id: dto.evidenceId, companyId },
        select: { id: true },
      });
      if (!evidence) {
        throw new NotFoundException('Evidence document not found');
      }
    }

    const doc = await this.repository.createDocument(
      dto,
      contractorId,
      companyId,
    );
    await this.auditService.log({
      user: currentUser,
      action: 'CREATE',
      entity: 'ContractorDocument',
      entityId: doc.id,
      after: doc,
    });
    return doc;
  }

  async updateDocument(
    currentUser: AuthenticatedUser,
    contractorId: string,
    id: string,
    dto: UpdateContractorDocumentDto,
  ) {
    const companyId = this.resolveCompanyId(currentUser);
    const before = await this.repository.findDocumentByIdScoped(id, companyId);
    if (!before || before.contractorId !== contractorId) {
      throw new NotFoundException('Contractor document not found');
    }

    // Evidencia same-tenant (404 cross-tenant) y contratista del recurso.
    if (dto.evidenceId) {
      const evidence = await this.prisma.document.findFirst({
        where: { id: dto.evidenceId, companyId },
        select: { id: true },
      });
      if (!evidence) {
        throw new NotFoundException('Evidence document not found');
      }
    }

    const updated = await this.repository.updateDocumentScoped(
      id,
      companyId,
      dto,
    );
    if (!updated) {
      throw new NotFoundException('Contractor document not found');
    }
    await this.auditService.log({
      user: currentUser,
      action: 'UPDATE',
      entity: 'ContractorDocument',
      entityId: id,
      before,
      after: updated,
    });
    return updated;
  }

  async removeDocument(
    currentUser: AuthenticatedUser,
    contractorId: string,
    id: string,
  ) {
    const companyId = this.resolveCompanyId(currentUser);
    const before = await this.repository.findDocumentByIdScoped(id, companyId);
    if (!before || before.contractorId !== contractorId) {
      throw new NotFoundException('Contractor document not found');
    }
    await this.repository.removeDocumentScoped(id, companyId);
    await this.auditService.log({
      user: currentUser,
      action: 'DELETE',
      entity: 'ContractorDocument',
      entityId: id,
      before,
    });
    return { id, deleted: true };
  }

  // --- Autorizacion de ingreso ------------------------------------------------

  /**
   * Regla de negocio (doc funcional §8): no se autoriza el ingreso con
   * documentos vencidos/rechazados o pendientes de validacion, ni con el
   * contratista no activo. El agregado considera vencidos por fecha real,
   * ademas del estado almacenado.
   */
  async getEntryAuthorization(
    currentUser: AuthenticatedUser,
    contractorId: string,
  ) {
    await this.findOne(currentUser, contractorId);
    const companyId = this.resolveCompanyId(currentUser);

    const compliance = await this.repository.getCompliance(
      contractorId,
      companyId,
    );
    const documents = await this.repository.findDocuments(
      contractorId,
      companyId,
    );
    const workers = await this.repository.findWorkers(contractorId, companyId);

    const expiredByDate = documents.filter((doc) => isExpired(doc.expiresAt));
    const workersWithoutInduction = workers.filter(
      (worker) => worker.status === 'ACTIVE' && !worker.inductedAt,
    );

    const blockingReasons = [...compliance.blockingReasons];
    if (expiredByDate.length > 0) {
      const reason = `${expiredByDate.length} documento(s) vencido(s) por fecha`;
      if (
        !blockingReasons.includes(reason) &&
        !/vencid/.test(blockingReasons.join(' '))
      ) {
        blockingReasons.push(reason);
      }
    }
    if (workersWithoutInduction.length > 0 && workers.length > 0) {
      blockingReasons.push(
        `${workersWithoutInduction.length} trabajador(es) sin induccion`,
      );
    }
    if (workers.length === 0) {
      blockingReasons.push('sin personal registrado');
    }

    const canAuthorizeEntry =
      compliance.canAuthorizeEntry && workersWithoutInduction.length === 0;

    return {
      ...compliance,
      expiredByDate: expiredByDate.map((doc) => ({
        id: doc.id,
        documentType: doc.documentType,
        expiresAt: doc.expiresAt,
      })),
      workersWithoutInduction: workersWithoutInduction.length,
      canAuthorizeEntry,
      blockingReasons,
    };
  }
}
