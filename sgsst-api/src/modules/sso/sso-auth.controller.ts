import { Controller, Get, Logger, Query, Res } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { SsoService } from './sso.service';

@ApiTags('auth')
@Controller('auth/sso')
export class SsoAuthController {
  private readonly logger = new Logger(SsoAuthController.name);

  constructor(private readonly ssoService: SsoService) {}

  /** La app pide la URL de autorizacion y navega (evita redirects HTTP de por medio). */
  @Get('authorize')
  authorize(
    @Query('companyId') companyId: string,
    @Query('redirect') redirect: string | undefined,
  ) {
    return this.ssoService.beginLogin(companyId, redirect);
  }

  @ApiExcludeEndpoint()
  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Res() res: Response,
  ) {
    try {
      const { redirect, session } = await this.ssoService.handleCallback(
        code,
        state,
      );
      const params = new URLSearchParams({
        access_token: session.accessToken,
        refresh_token: session.refreshToken,
        expires_in: session.expiresIn,
        user: JSON.stringify(session.user),
      });
      return res.redirect(`${redirect}#${params.toString()}`);
    } catch (error) {
      this.logger.warn(
        `SSO callback failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return res.redirect('/?sso=error');
    }
  }
}
