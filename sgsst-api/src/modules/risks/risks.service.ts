import { Injectable, NotFoundException } from '@nestjs/common';
import {
  assertCompanyScope,
  resolveCompanyScope,
} from '../../common/pipes/company-scope';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { SitesRepository } from '../sites/sites.repository';
import { CreateRiskDto } from './dto/create-risk.dto';
import { UpdateRiskDto } from './dto/update-risk.dto';
import { RisksRepository } from './risks.repository';

@Injectable()
export class RisksService {
  constructor(
    private readonly risksRepository: RisksRepository,
    private readonly sitesRepository: SitesRepository,
  ) {}

  private resolveCompanyId(
    currentUser: AuthenticatedUser,
    companyId?: string,
  ): string {
    return resolveCompanyScope(currentUser, companyId);
  }

  async findAll(
    currentUser: AuthenticatedUser,
    companyId?: string,
    siteId?: string,
  ) {
    const scopedCompanyId = this.resolveCompanyId(currentUser, companyId);
    // Filtro por sede: una sede ajena no existe para el actor (404).
    if (siteId && siteId !== 'none') {
      await this.assertSiteInScope(siteId, scopedCompanyId);
    }
    return this.risksRepository.findAll(scopedCompanyId, siteId);
  }

  async findOne(currentUser: AuthenticatedUser, id: string) {
    // Aislamiento: un riesgo de otra empresa no existe para el actor.
    const risk = await this.risksRepository.findByIdScoped(
      id,
      this.resolveCompanyId(currentUser),
    );
    if (!risk) {
      throw new NotFoundException('Risk not found');
    }
    assertCompanyScope(currentUser, risk.companyId);
    return risk;
  }

  async create(currentUser: AuthenticatedUser, dto: CreateRiskDto) {
    const companyId = this.resolveCompanyId(currentUser, dto.companyId);
    // La sede debe existir y ser de la empresa del riesgo.
    if (dto.siteId) {
      await this.assertSiteInScope(dto.siteId, companyId);
    }
    return this.risksRepository.create(dto, companyId);
  }

  async update(currentUser: AuthenticatedUser, id: string, dto: UpdateRiskDto) {
    await this.findOne(currentUser, id);
    // Sede del update: de la misma empresa; null desasigna; undefined no toca.
    if (dto.siteId !== undefined && dto.siteId !== null) {
      await this.assertSiteInScope(
        dto.siteId,
        this.resolveCompanyId(currentUser),
      );
    }
    // Update restrictivo por empresa (defensa en profundidad, sin depender del findOne previo).
    const updated = await this.risksRepository.updateScoped(
      id,
      this.resolveCompanyId(currentUser),
      dto,
    );
    if (!updated) {
      throw new NotFoundException('Risk not found');
    }
    return updated;
  }

  /** La sede debe existir y pertenecer a la empresa del scope. */
  private async assertSiteInScope(siteId: string, companyId: string) {
    const site = await this.sitesRepository.findByIdScoped(siteId, companyId);
    if (!site) {
      throw new NotFoundException('Site not found');
    }
  }

  async remove(currentUser: AuthenticatedUser, id: string) {
    await this.findOne(currentUser, id);
    const removed = await this.risksRepository.removeScoped(
      id,
      this.resolveCompanyId(currentUser),
    );
    if (!removed) {
      throw new NotFoundException('Risk not found');
    }
    return { success: true };
  }
}
