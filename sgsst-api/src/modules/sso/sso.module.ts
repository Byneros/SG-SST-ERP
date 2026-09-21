import { Module } from '@nestjs/common';
import { SsoAuthController } from './sso-auth.controller';
import { SsoController } from './sso.controller';
import { SsoService } from './sso.service';

@Module({
  controllers: [SsoAuthController, SsoController],
  providers: [SsoService],
  exports: [SsoService],
})
export class SsoModule {}
