import { Injectable, NotFoundException } from '@nestjs/common';
import {
  assertCompanyScope,
  resolveCompanyScope,
} from '../../common/pipes/company-scope';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { SitesRepository } from '../sites/sites.repository';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import { IncidentsRepository } from './incidents.repository';
import { ListQueryDto } from '../../common/dto/list-query.dto';

@Injectable()
export class IncidentsService {
  constructor(
    private readonly incidentsRepository: IncidentsRepository,
    private readonly sitesRepository: SitesRepository,
  ) {}

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
    return this.incidentsRepository.findAll(
      currentUser,
      scopedCompanyId,
      new ListQueryDto(),
      siteId,
    );
  }

  async findOne(currentUser: AuthenticatedUser, id: string) {
    // Aislamiento: un incidente de otra empresa no existe para el actor.
    const incident = await this.incidentsRepository.findByIdScoped(
      id,
      this.resolveCompanyId(currentUser),
    );
    if (!incident) {
      throw new NotFoundException('Incident not found');
    }
    assertCompanyScope(currentUser, incident.companyId);
    return incident;
  }

  async create(currentUser: AuthenticatedUser, dto: CreateIncidentDto) {
    const companyId = this.resolveCompanyId(currentUser, dto.companyId);
    // La sede debe existir y ser de la empresa del incidente (aplica tambien
    // al reporte hecho por EMPLOYEE).
    if (dto.siteId) {
      await this.assertSiteInScope(dto.siteId, companyId);
    }
    return this.incidentsRepository.create(dto, companyId);
  }

  async update(
    currentUser: AuthenticatedUser,
    id: string,
    dto: UpdateIncidentDto,
  ) {
    await this.findOne(currentUser, id);
    // Sede del update: de la misma empresa; null desasigna; undefined no toca.
    if (dto.siteId !== undefined && dto.siteId !== null) {
      await this.assertSiteInScope(
        dto.siteId,
        this.resolveCompanyId(currentUser),
      );
    }
    // Update restrictivo por empresa (defensa en profundidad).
    const updated = await this.incidentsRepository.updateScoped(
      id,
      this.resolveCompanyId(currentUser),
      dto,
    );
    if (!updated) {
      throw new NotFoundException('Incident not found');
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
    const removed = await this.incidentsRepository.removeScoped(
      id,
      this.resolveCompanyId(currentUser),
    );
    if (!removed) {
      throw new NotFoundException('Incident not found');
    }
    return { success: true };
  }

  private resolveCompanyId(
    currentUser: AuthenticatedUser,
    companyId?: string,
  ): string {
    return resolveCompanyScope(currentUser, companyId);
  }
}
