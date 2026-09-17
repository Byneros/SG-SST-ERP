import { Injectable, NotFoundException } from '@nestjs/common';
import {
  assertCompanyScope,
  resolveCompanyScope,
} from '../../common/pipes/company-scope';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import { IncidentsRepository } from './incidents.repository';
import { ListQueryDto } from '../../common/dto/list-query.dto';

@Injectable()
export class IncidentsService {
  constructor(private readonly incidentsRepository: IncidentsRepository) {}

  findAll(currentUser: AuthenticatedUser, companyId?: string) {
    return this.incidentsRepository.findAll(
      currentUser,
      this.resolveCompanyId(currentUser, companyId),
      new ListQueryDto(),
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

  create(currentUser: AuthenticatedUser, dto: CreateIncidentDto) {
    return this.incidentsRepository.create(
      dto,
      this.resolveCompanyId(currentUser, dto.companyId),
    );
  }

  async update(
    currentUser: AuthenticatedUser,
    id: string,
    dto: UpdateIncidentDto,
  ) {
    await this.findOne(currentUser, id);
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
