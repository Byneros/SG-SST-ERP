import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import {
  assertCompanyScope,
  resolveCompanyScope,
} from '../../common/pipes/company-scope';
import { AuditService } from '../audit/audit.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { CreateDocumentVersionDto } from './dto/create-document-version.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { DocumentsRepository } from './documents.repository';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly documentsRepository: DocumentsRepository,
    private readonly auditService: AuditService,
  ) {}

  findAll(companyId?: string, query: ListQueryDto = new ListQueryDto()) {
    return this.documentsRepository.findAll(companyId, query);
  }

  async findOne(id: string, user?: AuthenticatedUser) {
    // Aislamiento en consulta: un documento de otra empresa no existe para el actor
    // (aplica también antes de entregar URLs de descarga).
    const document = user
      ? await this.documentsRepository.findByIdScoped(
          id,
          resolveCompanyScope(user),
        )
      : await this.documentsRepository.findById(id);
    if (!document) {
      throw new NotFoundException('Document not found');
    }
    this.assertCompanyScope(document.companyId, user);
    return document;
  }

  async create(dto: CreateDocumentDto, user?: AuthenticatedUser) {
    // El controller ya resolvio companyId contra el scope autenticado; se revalida como defensa en profundidad.
    if (user) {
      assertCompanyScope(user, dto.companyId);
    }
    if (!dto.companyId) {
      throw new BadRequestException('Document must belong to one company');
    }
    const created = await this.documentsRepository.create(dto);
    await this.auditService.log({
      user,
      action: 'CREATE',
      entity: 'Document',
      entityId: created.id,
      after: created,
    });
    return created;
  }

  async update(id: string, dto: UpdateDocumentDto, user?: AuthenticatedUser) {
    const before = await this.findOne(id, user);
    if (user && dto.companyId) {
      assertCompanyScope(user, dto.companyId);
    }
    // Update restrictivo por empresa.
    const updated =
      user && user.companyId
        ? await this.documentsRepository.updateScoped(id, user.companyId, dto)
        : await this.documentsRepository.update(id, dto);
    if (!updated) {
      throw new NotFoundException('Document not found');
    }
    await this.auditService.log({
      user,
      action: this.resolveStateAction(before.isActive, dto.isActive),
      entity: 'Document',
      entityId: id,
      before,
      after: updated,
    });
    return updated;
  }

  async createVersion(
    id: string,
    dto: CreateDocumentVersionDto,
    user?: AuthenticatedUser,
  ) {
    const before = await this.findOne(id, user);
    const updated =
      user && user.companyId
        ? await this.documentsRepository.createVersionScoped(
            id,
            user.companyId,
            dto,
          )
        : await this.documentsRepository.createVersion(id, dto);
    await this.auditService.log({
      user,
      action: 'CREATE_VERSION',
      entity: 'Document',
      entityId: id,
      before,
      after: updated,
    });
    return updated;
  }

  async remove(id: string, user?: AuthenticatedUser) {
    const before = await this.findOne(id, user);
    if (user && user.companyId) {
      const removed = await this.documentsRepository.removeScoped(
        id,
        user.companyId,
      );
      if (!removed) {
        throw new NotFoundException('Document not found');
      }
      const updated = await this.documentsRepository.findByIdScoped(
        id,
        user.companyId,
      );
      await this.auditService.log({
        user,
        action: 'DEACTIVATE',
        entity: 'Document',
        entityId: id,
        before,
        after: updated,
      });
      return updated;
    }
    const updated = await this.documentsRepository.remove(id);
    await this.auditService.log({
      user,
      action: 'DEACTIVATE',
      entity: 'Document',
      entityId: id,
      before,
      after: updated,
    });
    return updated;
  }

  private assertCompanyScope(companyId: string, user?: AuthenticatedUser) {
    if (!user) {
      return;
    }
    assertCompanyScope(user, companyId);
  }

  private resolveStateAction(beforeActive: boolean, nextActive?: boolean) {
    if (nextActive === true && !beforeActive) {
      return 'REACTIVATE';
    }
    if (nextActive === false && beforeActive) {
      return 'DEACTIVATE';
    }
    return 'UPDATE';
  }
}
