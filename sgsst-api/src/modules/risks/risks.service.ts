import { Injectable, NotFoundException } from '@nestjs/common';
import {
  assertCompanyScope,
  resolveCompanyScope,
} from '../../common/pipes/company-scope';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { CreateRiskDto } from './dto/create-risk.dto';
import { UpdateRiskDto } from './dto/update-risk.dto';
import { RisksRepository } from './risks.repository';

@Injectable()
export class RisksService {
  constructor(private readonly risksRepository: RisksRepository) {}

  private resolveCompanyId(
    currentUser: AuthenticatedUser,
    companyId?: string,
  ): string {
    return resolveCompanyScope(currentUser, companyId);
  }

  findAll(currentUser: AuthenticatedUser, companyId?: string) {
    const scopedCompanyId = this.resolveCompanyId(currentUser, companyId);
    return this.risksRepository.findAll(scopedCompanyId);
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

  create(currentUser: AuthenticatedUser, dto: CreateRiskDto) {
    const companyId = this.resolveCompanyId(currentUser, dto.companyId);
    return this.risksRepository.create(dto, companyId);
  }

  async update(currentUser: AuthenticatedUser, id: string, dto: UpdateRiskDto) {
    await this.findOne(currentUser, id);
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
