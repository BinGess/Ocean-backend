import { JwtModuleOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

export const getJwtConfig = (
  configService: ConfigService,
): JwtModuleOptions => ({
  secret: configService.get<string>('JWT_SECRET') || 'default-jwt-secret-please-change-in-production',
  signOptions: {
    expiresIn: (configService.get<string>('JWT_EXPIRES_IN') || '7d') as any,
  },
});

export const getJwtRefreshConfig = (
  configService: ConfigService,
): JwtModuleOptions => ({
  secret: configService.get<string>('JWT_REFRESH_SECRET') || 'default-jwt-refresh-secret-please-change-in-production',
  signOptions: {
    expiresIn: (configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '30d') as any,
  },
});
