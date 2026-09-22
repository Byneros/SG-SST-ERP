import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { env } from '../../../config/env';
import { SamlService } from './saml.service';

@ApiTags('auth')
@Controller('auth/sso/saml')
export class SamlAuthController {
  private readonly logger = new Logger(SamlAuthController.name);

  constructor(private readonly samlService: SamlService) {}

  /** Metadata SP del backend para registrar la app en la consola del IdP. */
  @Get(':companyId/metadata')
  async metadata(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Res() res: Response,
  ) {
    const xml = await this.samlService.metadata(companyId);
    res.type('application/xml').send(xml);
  }

  /** La app pide la URL de login del IdP y navega (patron OIDC authorize). */
  @Get(':companyId/authorize')
  authorize(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query('redirect') redirect: string | undefined,
  ) {
    return this.samlService.beginLogin(companyId, redirect);
  }

  /** ACS: el IdP hace POST del assertion; redirect a la web con la sesion. */
  @ApiExcludeEndpoint()
  @Post(':companyId/acs')
  async acs(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() body: Record<string, string | undefined>,
    @Res() res: Response,
  ) {
    try {
      const { redirect, session } = await this.samlService.consumeAssertion(
        companyId,
        body.SAMLResponse,
        body.RelayState,
      );
      const params = new URLSearchParams({
        access_token: session.accessToken,
        refresh_token: session.refreshToken,
        expires_in: session.expiresIn,
        user: JSON.stringify(session.user),
      });
      return res.redirect(`${env.webBaseUrl}${redirect}#${params.toString()}`);
    } catch (error) {
      this.logger.warn(
        `SAML ACS failed for company ${companyId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      // El navegador llega aqui por POST del IdP: responder 302 a la web con error.
      return res.redirect(`${env.webBaseUrl}/?sso=error`);
    }
  }
}
