import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ListQueryDto } from '../../common/dto/list-query.dto';
import { PrismaService } from '../../database/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(companyId?: string, query: ListQueryDto = new ListQueryDto()) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const search = query.search?.trim();
    const where: Prisma.UserWhereInput = {
      companyId,
      isActive: query.isActive,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        select: this.safeSelect(),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.user.count({ where }),
    ]);
    return {
      data,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  count() {
    return this.prisma.user.count();
  }

  findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: this.safeSelect(),
    });
  }

  /** Variante con aislamiento por empresa: null si el usuario es de otra empresa. */
  findByIdScoped(id: string, companyId: string) {
    return this.prisma.user.findFirst({
      where: { id, companyId },
      select: this.safeSelect(),
    });
  }

  findAuthById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  create(dto: CreateUserDto, passwordHash: string) {
    return this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: passwordHash,
        role: dto.role as never,
        companyId: dto.companyId,
      },
      select: this.safeSelect(),
    });
  }

  update(id: string, dto: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name,
        email: dto.email,
        role: dto.role as never,
        companyId: dto.companyId,
        isActive: dto.isActive,
        deletedAt:
          dto.isActive === undefined
            ? undefined
            : dto.isActive
              ? null
              : new Date(),
      },
      select: this.safeSelect(),
    });
  }

  /** Updates restrictivos: el usuario objetivo debe pertenecer a la empresa del actor.
   *  El cambio de empresa (`companyId`) solo es legítimo dentro del mismo scope autenticado. */
  updateScoped(id: string, companyId: string, dto: UpdateUserDto) {
    return this.prisma.user.updateMany({
      where: { id, companyId },
      data: {
        name: dto.name,
        email: dto.email,
        role: dto.role as never,
        companyId: dto.companyId,
        isActive: dto.isActive,
        deletedAt:
          dto.isActive === undefined
            ? undefined
            : dto.isActive
              ? null
              : new Date(),
      },
    });
  }

  removeScoped(id: string, companyId: string) {
    return this.prisma.user.updateMany({
      where: { id, companyId },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    });
  }

  updatePassword(id: string, passwordHash: string) {
    return this.prisma.user.update({
      where: { id },
      data: {
        password: passwordHash,
        refreshTokenHash: null,
        passwordResetTokenHash: null,
        passwordResetExpiresAt: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
      select: this.safeSelect(),
    });
  }

  updateRefreshTokenHash(id: string, refreshTokenHash: string | null) {
    return this.prisma.user.update({
      where: { id },
      data: { refreshTokenHash },
      select: this.safeSelect(),
    });
  }

  updatePasswordResetToken(
    id: string,
    passwordResetTokenHash: string | null,
    passwordResetExpiresAt: Date | null,
  ) {
    return this.prisma.user.update({
      where: { id },
      data: { passwordResetTokenHash, passwordResetExpiresAt },
      select: this.safeSelect(),
    });
  }

  updateMfaSecret(id: string, mfaSecret: string | null, mfaEnabled: boolean) {
    return this.prisma.user.update({
      where: { id },
      data: { mfaSecret, mfaEnabled },
      select: this.safeSelect(),
    });
  }

  /**
   * Registra un intento fallido de login: incrementa el contador y bloquea la
   * cuenta al alcanzar `maxAttempts` (por `lockMinutes`). Transaccional para
   * leer/escribir el contador de forma consistente. Si el bloqueo anterior ya
   * expiró, el contador arranca de cero (ciclo nuevo de intentos).
   */
  async registerFailedLogin(
    id: string,
    maxAttempts: number,
    lockMinutes: number,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.user.findUnique({
        where: { id },
        select: { failedLoginAttempts: true, lockedUntil: true },
      });
      const previousLockExpired =
        !!current?.lockedUntil && current.lockedUntil.getTime() <= Date.now();
      const attempts =
        (previousLockExpired ? 0 : (current?.failedLoginAttempts ?? 0)) + 1;
      const locked = attempts >= maxAttempts;
      await tx.user.update({
        where: { id },
        data: {
          failedLoginAttempts: attempts,
          ...(locked
            ? { lockedUntil: new Date(Date.now() + lockMinutes * 60_000) }
            : {}),
        },
      });
      return { locked, attempts };
    });
  }

  /** Estado de bloqueo de la cuenta para el desbloqueo administrativo (H-5). */
  findLockState(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, failedLoginAttempts: true, lockedUntil: true },
    });
  }

  /**
   * Desbloqueo administrativo (H-5): limpia el lockout condicionalmente (solo si
   * el bloqueo sigue vigente) sin sellar `lastLoginAt` (eso ocurre al loguearse).
   * Con `companyId`, la mutacion queda ademas confinada a la empresa del actor.
   */
  unlockLogin(id: string, companyId?: string) {
    return this.prisma.user.updateMany({
      where: {
        id,
        ...(companyId ? { companyId } : {}),
        lockedUntil: { gt: new Date() },
      },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  }

  /** Login exitoso o password reset: limpia el bloqueo (y sella el ultimo login). */
  resetLoginLockout(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
      select: this.safeSelect(),
    });
  }

  remove(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
      select: this.safeSelect(),
    });
  }

  private safeSelect() {
    return {
      id: true,
      name: true,
      email: true,
      role: true,
      mfaEnabled: true,
      isActive: true,
      deletedAt: true,
      companyId: true,
      company: {
        select: {
          id: true,
          name: true,
          nit: true,
        },
      },
      createdAt: true,
      updatedAt: true,
    };
  }
}
