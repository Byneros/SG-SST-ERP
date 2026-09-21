import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { assertCompanyScope } from '../../common/pipes/company-scope';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { AuditService } from '../audit/audit.service';
import { CreateSsoProviderDto } from './dto/create-sso-provider.dto';
import { UpdateSsoProviderDto } from './dto/update-sso-provider.dto';
import { encryptSecret } from './sso-crypto';
import { SsoService } from './sso.service';

@ApiTags('auth')
@Controller('sso')
export class SsoController {
  constructor(
    private readonly ssoService: SsoService,
    private readonly auditService: AuditService,
  ) {}

  /** Publico: empresas con SSO activo para el selector del login (sin secretos). */
  @Get('login-options')
  loginOptions() {
    return this.ssoService.listActiveLoginOptions();
  }

  @Get('providers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  async findProvider(
    @CurrentUser() user: AuthenticatedUser,
    @Query('companyId') companyId: string,
  ) {
    assertCompanyScope(user, companyId);
    const provider = await this.ssoService.findProviderByCompany(companyId);
    return provider ?? { configured: false };
  }

  @Post('providers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  async upsertProvider(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSsoProviderDto,
  ) {
    assertCompanyScope(user, dto.companyId);
    const provider = await this.ssoService.upsertProvider(
      dto.companyId,
      dto,
      encryptSecret,
    );
    void this.auditService.log({
      user,
      action: 'SSO_PROVIDER_SAVE',
      entity: 'SsoProvider',
      entityId: provider.id,
      after: { ...provider, clientSecret: undefined },
    });
    return { ...provider, clientSecret: undefined };
  }

  @Patch('providers/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  async updateProvider(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSsoProviderDto,
  ) {
    const existing = await this.ssoService.findProviderById(id);
    assertCompanyScope(user, existing.companyId);
    const provider = await this.ssoService.updateProvider(
      id,
      existing.companyId,
      dto,
      encryptSecret,
    );
    void this.auditService.log({
      user,
      action: 'SSO_PROVIDER_SAVE',
      entity: 'SsoProvider',
      entityId: id,
      after: { ...provider, clientSecret: undefined },
    });
    return { ...provider, clientSecret: undefined };
  }

  @Delete('providers/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'SUPER_ADMIN')
  async deleteProvider(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const existing = await this.ssoService.findProviderById(id);
    assertCompanyScope(user, existing.companyId);
    await this.ssoService.deleteProvider(id);
    void this.auditService.log({
      user,
      action: 'SSO_PROVIDER_DELETE',
      entity: 'SsoProvider',
      entityId: id,
    });
    return { success: true };
  }
}
