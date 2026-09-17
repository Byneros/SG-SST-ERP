import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { env } from '../../config/env';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TotpService } from './totp.service';

@Global()
@Module({
  imports: [
    UsersModule,
    JwtModule.register({
  secret: env.jwtSecret,
  signOptions: {
    expiresIn: '1d',},
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, TotpService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
