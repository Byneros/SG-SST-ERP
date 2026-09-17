import { Injectable, NotFoundException } from '@nestjs/common';
import { UpdateTrainingDto } from './dto/update-training.dto';
import {
  assertCompanyScope,
  resolveCompanyScope,
} from '../../common/pipes/company-scope';
import { AuthenticatedUser } from '../../common/types/authenticated-request';
import { CreateTrainingDto } from './dto/create-training.dto';
import { TrainingsRepository } from './trainings.repository';

@Injectable()
export class TrainingsService {
  constructor(private readonly trainingsRepository: TrainingsRepository) {}

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

  findAll(currentUser: AuthenticatedUser, companyId?: string) {
    return this.trainingsRepository.findAll(
      this.resolveCompanyId(currentUser, companyId),
    );
  }

  create(currentUser: AuthenticatedUser, dto: CreateTrainingDto) {
    return this.trainingsRepository.create(
      dto,
      this.resolveCompanyId(currentUser, dto.companyId),
    );
  }

  async update(
    currentUser: AuthenticatedUser,
    id: string,
    dto: UpdateTrainingDto,
  ) {
    await this.findOne(currentUser, id);
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
