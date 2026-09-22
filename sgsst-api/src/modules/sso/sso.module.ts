import { Module } from '@nestjs/common';
import { SamlAuthController } from './saml/saml-auth.controller';
import { SamlService } from './saml/saml.service';
import { SsoAuthController } from './sso-auth.controller';
import { SsoController } from './sso.controller';
import { SsoService } from './sso.service';

@Module({
  controllers: [SsoAuthController, SsoController, SamlAuthController],
  providers: [SsoService, SamlService],
  exports: [SsoService],
})
export class SsoModule {}
