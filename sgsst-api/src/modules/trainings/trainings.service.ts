import { Injectable, NotFoundException } from '@nestjs/common';
import { UpdateTrainingDto } from './dto/update-training.dto';
import {
  assertCompanyScope,
  resolveCompanyScope,
} from '../../common/pipes/company-scope';
import { AuthenticatedUser } from '../../common/types/authenticated-request';
import { CreateTrainingDto } from './dto/create-training.dto';
import { TrainingsRepository } from './trainings.repository';
import { SitesRepository } from '../sites/sites.repository';

@Injectable()
export class TrainingsService {
  constructor(
    private readonly trainingsRepository: TrainingsRepository,
    private readonly sitesRepository: SitesRepository,
  ) {}

  async findOne(currentUser: AuthenticatedUser, id: string) {
    // Aislamiento: una capacitación de otra empresa no existe para el actor.
    const training = await this.trainingsRepository.findByIdScoped(
      id,
      this.resolveCompanyId(currentUser),
    );
    if (!training) {
      throw new NotFoundException('Training not found');
    }
    assertCompanyScope(currentUser, training.companyId);
    return training;
  }

  private resolveCompanyId(
    currentUser: AuthenticatedUser,
    companyId?: string,
  ): string {
    return resolveCompanyScope(currentUser, companyId);
  }

  /** La sede debe existir y pertenecer a la empresa del scope. */
  private async assertSiteInScope(siteId: string, companyId: string) {
    const site = await this.sitesRepository.findByIdScoped(siteId, companyId);
    if (!site) {
      throw new NotFoundException('Site not found');
    }
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
    return this.trainingsRepository.findAll(scopedCompanyId, siteId);
  }

  async create(currentUser: AuthenticatedUser, dto: CreateTrainingDto) {
    const companyId = this.resolveCompanyId(currentUser, dto.companyId);
    // La sede debe ser de la empresa de la capacitacion.
    if (dto.siteId) {
      await this.assertSiteInScope(dto.siteId, companyId);
    }
    return this.trainingsRepository.create(
      dto,
      companyId,
    );
  }

  async update(
    currentUser: AuthenticatedUser,
    id: string,
    dto: UpdateTrainingDto,
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
    const updated = await this.trainingsRepository.updateScoped(
      id,
      this.resolveCompanyId(currentUser),
      dto,
    );
    if (!updated) {
      throw new NotFoundException('Training not found');
    }
    return updated;
  }

  async remove(currentUser: AuthenticatedUser, id: string) {
    await this.findOne(currentUser, id);
    const removed = await this.trainingsRepository.removeScoped(
      id,
      this.resolveCompanyId(currentUser),
    );
    if (!removed) {
      throw new NotFoundException('Training not found');
    }
    return { success: true };
  }
}
