import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { env } from '../../config/env';
import { PrismaService } from '../../database/prisma.service';
import { UsersRepository } from '../users/users.repository';
import { CreateUserDto } from '../users/dto/create-user.dto';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { ChangePasswordDto } from './dto/change-password.dto';
import { EnableMfaDto } from './dto/enable-mfa.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SwitchActiveCompanyDto } from './dto/switch-active-company.dto';
import { VerifyMfaDto } from './dto/verify-mfa.dto';
import { TotpService } from './totp.service';

const criticalMfaRoles = new Set(['SUPER_ADMIN', 'ADMIN', 'SST', 'AUDITOR']);

@Injectable()
export class AuthService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly jwtService: JwtService,
    private readonly totpService: TotpService,
    private readonly prisma: PrismaService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.usersRepository.findByEmail(dto.email);

    if (
      !user ||
      !user.isActive ||
      !(await bcrypt.compare(dto.password, user.password))
    ) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (criticalMfaRoles.has(String(user.role)) && user.mfaEnabled) {
      return {
        mfaRequired: true,
        mfaToken: await this.jwtService.signAsync(
          { sub: user.id, type: 'mfa', jti: randomUUID() },
          { expiresIn: '5m' as never },
        ),
        tokenType: 'MFA',
      };
    }

    return this.issueSession(user);
  }

  async verifyMfa(dto: VerifyMfaDto) {
    const payload = await this.verifyToken(dto.mfaToken, 'mfa');
    const user = await this.usersRepository.findAuthById(payload.sub);
    if (!user || !user.isActive || !user.mfaEnabled || !user.mfaSecret) {
      throw new UnauthorizedException('Invalid MFA challenge');
    }
    if (!this.totpService.verify(user.mfaSecret, dto.code)) {
      throw new UnauthorizedException('Invalid MFA code');
    }
    return this.issueSession(user);
  }

  async refresh(dto: RefreshTokenDto) {
    const payload = await this.verifyToken(dto.refreshToken, 'refresh');
    const user = await this.usersRepository.findAuthById(payload.sub);
    if (!user || !user.isActive || !user.refreshTokenHash) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const valid = await bcrypt.compare(dto.refreshToken, user.refreshTokenHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    return this.issueSession(user);
  }

  async logout(user: AuthenticatedUser) {
    await this.usersRepository.updateRefreshTokenHash(user.sub, null);
    return { success: true };
  }

  async switchActiveCompany(
    user: AuthenticatedUser,
    dto: SwitchActiveCompanyDto,
  ) {
    const existing = await this.usersRepository.findAuthById(user.sub);
    if (!existing || !existing.isActive) {
      throw new UnauthorizedException('Invalid user');
    }

    if (existing.role !== 'SUPER_ADMIN') {
      if (!dto.companyId || dto.companyId !== existing.companyId) {
        throw new UnauthorizedException('Invalid company scope');
      }
      return this.issueSession(existing, dto.companyId);
    }

    if (dto.companyId) {
      const company = await this.prisma.company.findFirst({
        where: { id: dto.companyId, isActive: true },
        select: { id: true },
      });
      if (!company) {
        throw new UnauthorizedException('Invalid company scope');
      }
    }

    return this.issueSession(existing, dto.companyId ?? null);
  }

  async changePassword(user: AuthenticatedUser, dto: ChangePasswordDto) {
    const existing = await this.usersRepository.findAuthById(user.sub);
    if (
      !existing ||
      !existing.isActive ||
      !(await bcrypt.compare(dto.currentPassword, existing.password))
    ) {
      throw new UnauthorizedException('Invalid current password');
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.usersRepository.updatePassword(user.sub, passwordHash);
    return { success: true };
  }

  async setupMfa(user: AuthenticatedUser) {
    const existing = await this.usersRepository.findAuthById(user.sub);
    if (!existing || !existing.isActive) {
      throw new UnauthorizedException('Invalid user');
    }
    const secret = existing.mfaSecret ?? this.totpService.generateSecret();
    await this.usersRepository.updateMfaSecret(
      existing.id,
      secret,
      existing.mfaEnabled,
    );
    return {
      secret,
      otpauthUrl: this.totpService.otpauthUrl(existing.email, secret),
      enabled: existing.mfaEnabled,
    };
  }

  async enableMfa(user: AuthenticatedUser, dto: EnableMfaDto) {
    const existing = await this.usersRepository.findAuthById(user.sub);
    if (!existing || !existing.isActive || !existing.mfaSecret) {
      throw new UnauthorizedException('MFA setup is required');
    }
    if (!this.totpService.verify(existing.mfaSecret, dto.code)) {
      throw new UnauthorizedException('Invalid MFA code');
    }
    await this.usersRepository.updateMfaSecret(
      existing.id,
      existing.mfaSecret,
      true,
    );
    return { success: true };
  }

  async disableMfa(user: AuthenticatedUser, dto: EnableMfaDto) {
    const existing = await this.usersRepository.findAuthById(user.sub);
    if (!existing || !existing.isActive || !existing.mfaSecret) {
      throw new UnauthorizedException('Invalid user');
    }
    if (!this.totpService.verify(existing.mfaSecret, dto.code)) {
      throw new UnauthorizedException('Invalid MFA code');
    }
    await this.usersRepository.updateMfaSecret(existing.id, null, false);
    return { success: true };
  }

  async requestPasswordReset(dto: RequestPasswordResetDto) {
    const user = await this.usersRepository.findByEmail(dto.email);
    if (!user || !user.isActive) {
      return { success: true };
    }

    const resetToken = await this.jwtService.signAsync(
      { sub: user.id, type: 'password-reset', jti: randomUUID() },
      { expiresIn: `${env.passwordResetExpiresMinutes}m` as never },
    );
    const resetTokenHash = await bcrypt.hash(resetToken, 12);
    const expiresAt = new Date(
      Date.now() + env.passwordResetExpiresMinutes * 60_000,
    );
    await this.usersRepository.updatePasswordResetToken(
      user.id,
      resetTokenHash,
      expiresAt,
    );

    return {
      success: true,
      ...(env.nodeEnv === 'production' ? {} : { resetToken }),
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const payload = await this.verifyToken(dto.resetToken, 'password-reset');
    const user = await this.usersRepository.findAuthById(payload.sub);
    if (
      !user ||
      !user.isActive ||
      !user.passwordResetTokenHash ||
      !user.passwordResetExpiresAt ||
      user.passwordResetExpiresAt.getTime() < Date.now() ||
      !(await bcrypt.compare(dto.resetToken, user.passwordResetTokenHash))
    ) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 12);
    await this.usersRepository.updatePassword(user.id, passwordHash);
    return { success: true };
  }

  async bootstrapAdmin(dto: CreateUserDto) {
    const usersCount = await this.usersRepository.count();
    if (usersCount > 0) {
      throw new ConflictException('Initial administrator already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    return this.usersRepository.create(
      { ...dto, role: 'SUPER_ADMIN', companyId: undefined },
      passwordHash,
    );
  }

  /** Publico para reuso (p. ej. SSO OIDC emite la misma sesion JWT/refresh). */
  async issueSession(
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
      companyId?: string | null;
      mfaEnabled?: boolean;
    },
    activeCompanyId = user.companyId ?? null,
  ) {
    const payload = this.toAccessPayload(user, activeCompanyId);
    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id, type: 'refresh', jti: randomUUID() },
      { expiresIn: env.refreshTokenExpiresIn as never },
    );
    await this.usersRepository.updateRefreshTokenHash(
      user.id,
      await bcrypt.hash(refreshToken, 12),
    );

    return {
      accessToken: await this.jwtService.signAsync(payload),
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: env.jwtExpiresIn,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
        activeCompanyId,
        mfaEnabled: user.mfaEnabled,
      },
    };
  }

  private toAccessPayload(
    user: {
      id: string;
      email: string;
      role: string;
      companyId?: string | null;
    },
    activeCompanyId: string | null,
  ) {
    return {
      sub: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      activeCompanyId,
      type: 'access',
    };
  }

  private async verifyToken(token: string, expectedType: string) {
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub?: string;
        type?: string;
      }>(token);
      if (payload.type !== expectedType || !payload.sub) {
        throw new UnauthorizedException('Invalid token');
      }
      return payload as { sub: string; type: string };
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
