import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import {
  assertCompanyScope,
  resolveCompanyScope,
} from '../../common/pipes/company-scope';
import { AuditService } from '../audit/audit.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly auditService: AuditService,
  ) {}

  findAll(companyId?: string, query: ListQueryDto = new ListQueryDto()) {
    return this.usersRepository.findAll(companyId, query);
  }

  async findOne(id: string, actor?: AuthenticatedUser) {
    // Aislamiento por empresa: el usuario de otra empresa no existe para el actor.
    // SUPER_ADMIN (sin companyId en su cuenta) conserva la búsqueda global;
    // el assert posterior valida el scope de la empresa encontrada.
    const user =
      actor && actor.companyId
        ? await this.usersRepository.findByIdScoped(id, actor.companyId)
        : await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (actor && user.companyId) {
      assertCompanyScope(actor, user.companyId);
    }
    return user;
  }

  async create(dto: CreateUserDto, actor?: AuthenticatedUser) {
    this.assertUserAssignmentScope(actor, dto.role, dto.companyId);
    const existing = await this.usersRepository.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    this.ensureSingleCompanyAssignment(dto.role, dto.companyId);

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const created = await this.usersRepository.create(dto, passwordHash);
    await this.auditService.log({
      user: actor,
      action: 'CREATE',
      entity: 'User',
      entityId: created.id,
      after: created,
    });
    return created;
  }

  async update(id: string, dto: UpdateUserDto, actor?: AuthenticatedUser) {
    const before = await this.findOne(id, actor);
    this.assertUserAssignmentScope(
      actor,
      dto.role ?? before.role,
      dto.companyId ?? before.companyId,
    );
    this.ensureSingleCompanyAssignment(
      dto.role ?? before.role,
      dto.companyId ?? before.companyId,
    );
    // Update restrictivo: solo afecta usuarios dentro del scope de empresa del actor.
    if (actor?.companyId) {
      const result = await this.usersRepository.updateScoped(
        id,
        actor.companyId,
        dto,
      );
      if (result.count === 0) {
        throw new NotFoundException('User not found');
      }
    } else {
      await this.usersRepository.update(id, dto);
    }
    const updated = await this.findOne(id, actor);
    await this.auditService.log({
      user: actor,
      action: this.resolveStateAction(before.isActive, dto.isActive),
      entity: 'User',
      entityId: id,
      before,
      after: updated,
    });
    return updated;
  }

  async remove(id: string, actor?: AuthenticatedUser) {
    const before = await this.findOne(id, actor);
    if (actor?.companyId) {
      const result = await this.usersRepository.removeScoped(
        id,
        actor.companyId,
      );
      if (result.count === 0) {
        throw new NotFoundException('User not found');
      }
    } else {
      await this.usersRepository.remove(id);
    }
    const updated = await this.findOne(id, actor);
    await this.auditService.log({
      user: actor,
      action: 'DEACTIVATE',
      entity: 'User',
      entityId: id,
      before,
      after: updated,
    });
    return updated;
  }

  /**
   * Desbloqueo administrativo del lockout de login (H-5): permite a un ADMIN de
   * la empresa (o SUPER_ADMIN/DEVELOPER) reactivar una cuenta bloqueada por
   * intentos fallidos sin esperar a la expiracion ni recurrir a la BD.
   *
   * Seguridad:
   * - Scope: misma fuente de verdad que `findOne` (`resolveCompanyScope`). El
   *   usuario normal queda confinado a su empresa; SUPER_ADMIN/DEVELOPER opera
   *   sobre su empresa activa (403 sin empresa seleccionada, igual que el resto
   *   del ERP); el usuario objetivo de otra empresa responde 404 sin revelarlo.
   * - Idempotente hacia atras: si la cuenta no esta bloqueada responde 409 (no
   *   re-limpia contadores de un ciclo activo de intentos fallidos).
   * - Toda operacion (exito o 409) registra AuditLog con el estado del lock.
   */
  async unlock(id: string, actor?: AuthenticatedUser) {
    const scopedCompanyId = actor ? resolveCompanyScope(actor) : undefined;
    const target = scopedCompanyId
      ? await this.usersRepository.findByIdScoped(id, scopedCompanyId)
      : await this.usersRepository.findById(id);
    if (!target) {
      throw new NotFoundException('User not found');
    }

    const lockState = await this.usersRepository.findLockState(id);
    const locked =
      !!lockState?.lockedUntil && lockState.lockedUntil.getTime() > Date.now();
    if (!locked) {
      await this.auditService.log({
        user: actor,
        action: 'UNLOCK_REJECTED_NOT_LOCKED',
        entity: 'User',
        entityId: id,
        before: lockState,
      });
      throw new ConflictException('User is not locked');
    }

    const result = await this.usersRepository.unlockLogin(id, scopedCompanyId);
    if (result.count === 0) {
      // Carrera: el lock expiro entre la lectura y la escritura condicional.
      throw new ConflictException('User is not locked');
    }

    // Relectura con el mismo scoping del inicio (no via findOne: para roles de
    // plataforma con empresa activa, findOne resuelve por companyId de cuenta).
    const after = scopedCompanyId
      ? await this.usersRepository.findByIdScoped(id, scopedCompanyId)
      : await this.usersRepository.findById(id);
    await this.auditService.log({
      user: actor,
      action: 'UNLOCK',
      entity: 'User',
      entityId: id,
      before: { ...lockState, locked: true },
      after: {
        id,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    return {
      id,
      unlocked: true,
      failedLoginAttempts: 0,
      lockedUntil: null,
      user: after,
    };
  }

  private ensureSingleCompanyAssignment(
    role: string,
    companyId?: string | null,
  ) {
    const isSuperAdmin = role === 'SUPER_ADMIN';
    if (isSuperAdmin) {
      if (companyId) {
        throw new BadRequestException(
          'SUPER_ADMIN cannot be assigned to a company',
        );
      }
      return;
    }

    // DEVELOPER es rol de plataforma: vive fuera de toda empresa (igual que
    // SUPER_ADMIN) y no se asigna via API; solo seed/consola lo crea.
    if (role === 'DEVELOPER') {
      throw new ForbiddenException(
        'DEVELOPER users cannot be managed through the users API',
      );
    }

    if (!companyId) {
      throw new BadRequestException(
        'Users with company roles must belong to one company',
      );
    }
  }

  private assertUserAssignmentScope(
    actor: AuthenticatedUser | undefined,
    role: string,
    companyId?: string | null,
  ) {
    if (!actor) return;
    // DEVELOPER no entra ni sale por la API de usuarios (evita que un ADMIN
    // promueva a DEVELOPER o que un DEVELOPER mute su propio rol aqui).
    if (role === 'DEVELOPER') {
      throw new ForbiddenException(
        'DEVELOPER users cannot be managed through the users API',
      );
    }
    if (role === 'SUPER_ADMIN') {
      if (actor.role !== 'SUPER_ADMIN') {
        throw new ForbiddenException(
          'Only SUPER_ADMIN can manage SUPER_ADMIN users',
        );
      }
      return;
    }
    assertCompanyScope(actor, companyId);
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
