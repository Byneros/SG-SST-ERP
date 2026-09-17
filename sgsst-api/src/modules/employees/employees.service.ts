import {
  BadRequestException,
  ConflictException,
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
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeesRepository } from './employees.repository';

@Injectable()
export class EmployeesService {
  constructor(
    private readonly employeesRepository: EmployeesRepository,
    private readonly auditService: AuditService,
  ) {}

  findAll(companyId?: string, query: ListQueryDto = new ListQueryDto()) {
    return this.employeesRepository.findAll(companyId, query);
  }

  async findOne(id: string, user?: AuthenticatedUser) {
    // Consulta con aislamiento: si el empleado es de otra empresa no se filtra nada (404).
    const employee = user
      ? await this.employeesRepository.findByIdScoped(
          id,
          resolveCompanyScope(user),
        )
      : await this.employeesRepository.findById(id);
    if (!employee) {
      throw new NotFoundException('Employee not found');
    }
    if (user) {
      assertCompanyScope(user, employee.companyId);
    }
    return employee;
  }

  async create(dto: CreateEmployeeDto, user?: AuthenticatedUser) {
    if (user) {
      assertCompanyScope(user, dto.companyId);
    }
    const existing = await this.employeesRepository.findByDocument(
      dto.document,
    );
    if (existing) {
      throw new ConflictException('Document is already registered');
    }
    if (!dto.companyId) {
      throw new BadRequestException('Employee must belong to one company');
    }
    const created = await this.employeesRepository.create(dto);
    await this.auditService.log({
      user,
      action: 'CREATE',
      entity: 'Employee',
      entityId: created.id,
      after: created,
    });
    return created;
  }

  async update(id: string, dto: UpdateEmployeeDto, user?: AuthenticatedUser) {
    const before = await this.findOne(id, user);
    if (user && dto.companyId) {
      assertCompanyScope(user, dto.companyId);
    }
    if (dto.companyId !== undefined && !dto.companyId) {
      throw new BadRequestException('Employee must belong to one company');
    }
    if (dto.document && dto.document !== before.document) {
      const existing = await this.employeesRepository.findByDocument(
        dto.document,
      );
      if (existing) {
        throw new ConflictException('Document is already registered');
      }
    }
    // Update restrictivo por empresa: si el empleado no pertenece al scope, no existe para el actor.
    if (user) {
      const scope = resolveCompanyScope(user);
      const result = await this.employeesRepository.updateScoped(
        id,
        scope,
        dto,
      );
      if (result.count === 0) {
        throw new NotFoundException('Employee not found');
      }
    } else {
      await this.employeesRepository.update(id, dto);
    }
    const updated = user
      ? await this.employeesRepository.findByIdScoped(
          id,
          resolveCompanyScope(user),
        )
      : await this.employeesRepository.findById(id);
    await this.auditService.log({
      user,
      action: this.resolveStateAction(before.isActive, dto.isActive),
      entity: 'Employee',
      entityId: id,
      before,
      after: updated,
    });
    return updated;
  }

  async remove(id: string, user?: AuthenticatedUser) {
    const before = await this.findOne(id, user);
    if (user) {
      const scope = resolveCompanyScope(user);
      const result = await this.employeesRepository.removeScoped(id, scope);
      if (result.count === 0) {
        throw new NotFoundException('Employee not found');
      }
    } else {
      await this.employeesRepository.remove(id);
    }
    const updated = user
      ? await this.employeesRepository.findByIdScoped(
          id,
          resolveCompanyScope(user),
        )
      : await this.employeesRepository.findById(id);
    await this.auditService.log({
      user,
      action: 'DEACTIVATE',
      entity: 'Employee',
      entityId: id,
      before,
      after: updated,
    });
    return updated;
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
