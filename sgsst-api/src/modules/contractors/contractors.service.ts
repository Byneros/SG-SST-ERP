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
  AdvanceContractorEntryDto,
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

/** Etapas del flujo de ingreso (#37): solo avanza hacia adelante. */
const ENTRY_FLOW_ORDER = [
  'VALIDATION',
  'INDUCTION',
  'AUTHORIZED',
  'WORK',
  'CLOSED',
] as const;

type EntryStage = (typeof ENTRY_FLOW_ORDER)[number];

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

    // S13.2: la sede debe pertenecer a la empresa del alcance (404 ajena).
    await this.assertWorkerSite(dto.siteId, companyId);

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

    // S13.2: la sede debe pertenecer a la empresa del alcance (404 ajena).
    await this.assertWorkerSite(dto.siteId, companyId);

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

  /** S13.2: la sede del trabajador debe ser sede de la empresa del alcance. */
  private async assertWorkerSite(
    siteId: string | null | undefined,
    companyId: string,
  ) {
    if (!siteId) {
      return;
    }
    const site = await this.prisma.site.findFirst({
      where: { id: siteId, companyId },
      select: { id: true },
    });
    if (!site) {
      throw new NotFoundException('Site not found');
    }
  }

  /**
   * Estado calculado del flujo de ingreso (#37). Regla de negocio (doc
   * funcional §8): no se autoriza el ingreso con documentos vencidos/
   * rechazados o pendientes de validacion, ni con el contratista no activo.
   * El agregado considera vencidos por fecha real, ademas del estado
   * almacenado. La etapa del flujo (entryStatus) es persistida; los
   * requisitos son calculados en cada consulta.
   */
  private async computeEntryState(contractorId: string, companyId: string) {
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

    // S13.4: el estado calculado tambien considera vencidos por fecha real,
    // aunque su estado almacenado siga en VALID (el repositorio solo ve el
    // estado almacenado).
    const canAuthorizeEntry =
      compliance.canAuthorizeEntry &&
      workersWithoutInduction.length === 0 &&
      expiredByDate.length === 0;

    // S13.4: requisitos calculados por transicion del flujo.
    // Validacion: todos los documentos validos (sin pendientes/vencidos/
    // rechazados, al menos uno). Induccion: ademas todo el personal activo
    // inducido y al menos un trabajador. Trabajo y cierre: libres.
    const documentsValidated =
      compliance.documentsTotal > 0 &&
      (compliance.byDocumentStatus.PENDING ?? 0) === 0 &&
      (compliance.byDocumentStatus.EXPIRED ?? 0) === 0 &&
      (compliance.byDocumentStatus.REJECTED ?? 0) === 0 &&
      expiredByDate.length === 0;
    const workersInducted =
      workers.length > 0 && workersWithoutInduction.length === 0;

    const entryStatus = (compliance.contractor?.entryStatus ??
      'VALIDATION') as EntryStage;
    const stageIndex = ENTRY_FLOW_ORDER.indexOf(entryStatus);
    const nextStage =
      stageIndex >= 0 && stageIndex < ENTRY_FLOW_ORDER.length - 1
        ? ENTRY_FLOW_ORDER[stageIndex + 1]
        : null;

    const requirementsByStage: Record<EntryStage, string[]> = {
      VALIDATION: ['todos los documentos en VALID'],
      INDUCTION: ['todo el personal activo inducido'],
      AUTHORIZED: [],
      WORK: [],
      CLOSED: [],
    };

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
      entryStatus,
      nextStage,
      requirementsByStage,
      documentsValidated,
      workersInducted,
    };
  }

  /** Estado del flujo de ingreso: decision calculada, la UI nunca decide. */
  async getEntryAuthorization(
    currentUser: AuthenticatedUser,
    contractorId: string,
  ) {
    await this.findOne(currentUser, contractorId);
    return this.computeEntryState(
      contractorId,
      this.resolveCompanyId(currentUser),
    );
  }

  /**
   * S13.4: avanza el flujo Contratista -> Validacion -> Induccion ->
   * Autorizacion -> Trabajo -> Cierre. Solo transiciones hacia la etapa
   * siguiente, con los requisitos calculados de cada etapa (los documentos
   * criticos vencidos bloquean la validacion; la induccion pendiente
   * bloquea la autorizacion). Toda transicion queda auditada.
   */
  async advanceEntry(
    currentUser: AuthenticatedUser,
    contractorId: string,
    dto: AdvanceContractorEntryDto,
  ) {
    const companyId = this.resolveCompanyId(currentUser);
    await this.findOne(currentUser, contractorId);

    const state = await this.computeEntryState(contractorId, companyId);
    const current = state.entryStatus;

    if (current === 'CLOSED') {
      throw new BadRequestException('El flujo de ingreso ya esta cerrado');
    }
    if (dto.target !== state.nextStage) {
      throw new BadRequestException(
        `Transicion invalida: desde ${current} solo se puede avanzar a ${state.nextStage ?? 'ninguna etapa'}`,
      );
    }

    if (dto.target === 'INDUCTION' && !state.documentsValidated) {
      throw new BadRequestException(
        'No se puede avanzar a Induccion: hay documentos pendientes, vencidos o rechazados',
      );
    }
    if (dto.target === 'AUTHORIZED') {
      const reasons: string[] = [];
      if (!state.documentsValidated) {
        reasons.push('documentos pendientes, vencidos o rechazados');
      }
      if (!state.workersInducted) {
        reasons.push('personal sin induccion o sin personal registrado');
      }
      if (state.contractor?.status !== 'ACTIVE') {
        reasons.push('contratista no activo');
      }
      if (reasons.length > 0) {
        throw new BadRequestException(
          `No se puede autorizar el ingreso: ${reasons.join('; ')}`,
        );
      }
    }

    const updated = await this.repository.updateEntryStatus(
      contractorId,
      companyId,
      dto.target,
    );
    await this.auditService.log({
      user: currentUser,
      action: 'ENTRY_FLOW_ADVANCE',
      entity: 'Contractor',
      entityId: contractorId,
      before: { entryStatus: current },
      after: { entryStatus: updated?.entryStatus ?? dto.target },
    });

    const targetIndex = ENTRY_FLOW_ORDER.indexOf(dto.target);
    const nextAfterTarget =
      targetIndex < ENTRY_FLOW_ORDER.length - 1
        ? ENTRY_FLOW_ORDER[targetIndex + 1]
        : null;

    return {
      ...state,
      contractor: state.contractor
        ? {
            ...state.contractor,
            entryStatus: updated?.entryStatus ?? dto.target,
          }
        : state.contractor,
      entryStatus: updated?.entryStatus ?? dto.target,
      nextStage: nextAfterTarget,
    };
  }
}
