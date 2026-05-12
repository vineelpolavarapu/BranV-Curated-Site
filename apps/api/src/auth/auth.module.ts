import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { TwoFactorService } from './two-factor.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, PasswordService, TokenService, TwoFactorService],
  exports: [AuthService, TokenService],
})
export class AuthModule {}
