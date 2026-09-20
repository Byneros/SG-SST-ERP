import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  assertCompanyScope,
  resolveCompanyScope,
} from '../../common/pipes/company-scope';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../../database/prisma.service';
import { CreateSiteDto } from './dto/create-site.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { SitesRepository } from './sites.repository';

@Injectable()
export class SitesService {
  constructor(
    private readonly sitesRepository: SitesRepository,
    private readonly auditService: AuditService,
  ) {}

  findAll(user: AuthenticatedUser, query: ListQueryDto = new ListQueryDto()) {
    const companyId = resolveCompanyScope(user);
    return this.sitesRepository.findAll(companyId, query);
  }

  async findOne(id: string, user?: AuthenticatedUser) {
    // Aislamiento: una sede de otra empresa no existe para el actor (404).
    const site = user
      ? await this.sitesRepository.findByIdScoped(
          id,
          resolveCompanyScope(user),
        )
      : await this.sitesRepository.findById(id);
    if (!site) {
      throw new NotFoundException('Site not found');
    }
    if (user) {
      assertCompanyScope(user, site.companyId);
    }
    return site;
  }

  async create(dto: CreateSiteDto, user?: AuthenticatedUser) {
    // Fuente unica de verdad: con actor autenticado, el companyId ajeno del
    // cliente se rechaza (403). Sin actor (procesos internos) exige companyId.
    const companyId = user
      ? resolveCompanyScope(user, dto.companyId)
      : dto.companyId;
    if (!companyId) {
      throw new BadRequestException('Site must belong to one company');
    }
    if (dto.code) {
      const existing = await this.sitesRepository.findByCode(
        companyId,
        dto.code,
      );
      if (existing) {
        throw new ConflictException('Site code is already registered');
      }
    }
    const created = await this.sitesRepository.create(dto, companyId);
    await this.auditService.log({
      user,
      action: 'CREATE',
      entity: 'Site',
      entityId: created.id,
      after: created,
    });
    return created;
  }

  async update(id: string, dto: UpdateSiteDto, user?: AuthenticatedUser) {
    const before = await this.findOne(id, user);
    if (dto.code && dto.code !== before.code) {
      const scope = user ? resolveCompanyScope(user) : before.companyId;
      const existing = await this.sitesRepository.findByCode(
        scope,
        dto.code,
      );
      if (existing && existing.id !== id) {
        throw new ConflictException('Site code is already registered');
      }
    }
    // Update restrictivo por empresa: si la sede no pertenece al scope, no existe.
    const updated = user
      ? await this.sitesRepository.updateScoped(
          id,
          resolveCompanyScope(user),
          dto,
        )
      : await this.sitesRepository.update(id, dto);
    if (!updated) {
      throw new NotFoundException('Site not found');
    }
    await this.auditService.log({
      user,
      action: 'UPDATE',
      entity: 'Site',
      entityId: id,
      before,
      after: updated,
    });
    return updated;
  }

  async remove(id: string, user?: AuthenticatedUser) {
    const before = await this.findOne(id, user);
    if (user) {
      const removed = await this.sitesRepository.removeScoped(
        id,
        resolveCompanyScope(user),
      );
      if (removed.count === 0) {
        throw new NotFoundException('Site not found');
      }
    } else {
      await this.sitesRepository.remove(id);
    }
    const updated = user
      ? await this.sitesRepository.findByIdScoped(
          id,
          resolveCompanyScope(user),
        )
      : await this.sitesRepository.findById(id);
    await this.auditService.log({
      user,
      action: 'DEACTIVATE',
      entity: 'Site',
      entityId: id,
      before,
      after: updated,
    });
    return updated;
  }
}
