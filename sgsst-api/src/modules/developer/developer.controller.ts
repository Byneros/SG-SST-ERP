import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { DeveloperService } from './developer.service';

/**
 * Panel tecnico de plataforma (S11.1). Acceso EXCLUSIVO del rol DEVELOPER.
 * RolesGuard hace bypass a SUPER_ADMIN en todo el sistema, por eso AQUI cada
 * handler valida ademas assertDeveloper (el panel no admite bypass).
 */
@ApiTags('developer')
@ApiBearerAuth()
@Controller('developer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('DEVELOPER')
export class DeveloperController {
  constructor(private readonly developerService: DeveloperService) {}

  /** Resumen general: estado API + PostgreSQL + Redis. */
  @Get('overview')
  getOverview(@CurrentUser() user: AuthenticatedUser) {
    this.developerService.assertDeveloper(user);
    return this.developerService.getOverview();
  }

  /** Modulos del sistema y su estado de configuracion. */
  @Get('modules')
  getModules(@CurrentUser() user: AuthenticatedUser) {
    this.developerService.assertDeveloper(user);
    return this.developerService.getModules();
  }

  /** Estado de las colas BullMQ (notifications/reports). */
  @Get('queues')
  getQueues(@CurrentUser() user: AuthenticatedUser) {
    this.developerService.assertDeveloper(user);
    return this.developerService.getQueues();
  }

  /** Ultimas operaciones administrativas (audit log global). */
  @Get('audit')
  getAudit(@CurrentUser() user: AuthenticatedUser) {
    this.developerService.assertDeveloper(user);
    return this.developerService.getRecentAdminActivity();
  }

  /**
   * Ultimos errores/avisos tecnicos del proceso (ya enmascarados por el
   * logger global). Fuente real: el mismo log de la aplicacion.
   */
  @Get('errors')
  getErrors(@CurrentUser() user: AuthenticatedUser) {
    this.developerService.assertDeveloper(user);
    return this.developerService.getErrors();
  }

  /** Diagnostico: conteos globales de infraestructura (sin datos de tenants). */
  @Get('diagnostics')
  getDiagnostics(@CurrentUser() user: AuthenticatedUser) {
    this.developerService.assertDeveloper(user);
    return this.developerService.getDiagnostics(user);
  }
}
