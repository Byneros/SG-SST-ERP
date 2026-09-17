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
