import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /api/v1/auth/register
   * 用户注册
   */
  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  /**
   * POST /api/v1/auth/login
   * 用户登录
   */
  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  /**
   * POST /api/v1/auth/refresh
   * 刷新 Access Token
   */
  @Post('refresh')
  async refreshToken(@Body('refreshToken') refreshToken: string) {
    const newAccessToken =
      await this.authService.refreshAccessToken(refreshToken);

    return {
      accessToken: newAccessToken,
      expiresIn: 7 * 24 * 60 * 60, // 7 天（秒）
    };
  }

  /**
   * POST /api/v1/auth/logout
   * 登出（撤销 Refresh Token）
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Body('refreshToken') refreshToken: string) {
    await this.authService.logout(refreshToken);
    return { message: '登出成功' };
  }

  /**
   * GET /api/v1/auth/me
   * 获取当前用户信息
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@CurrentUser() user: any) {
    return user;
  }

  /**
   * GET /api/v1/auth/devices
   * 获取当前用户的所有设备
   */
  @Get('devices')
  @UseGuards(JwtAuthGuard)
  async getDevices(@CurrentUser('id') userId: string) {
    return this.authService.getUserDevices(userId);
  }

  /**
   * DELETE /api/v1/auth/devices/:deviceId
   * 删除指定设备（远程登出）
   */
  @Delete('devices/:deviceId')
  @UseGuards(JwtAuthGuard)
  async deleteDevice(
    @CurrentUser('id') userId: string,
    @Param('deviceId') deviceId: string,
  ) {
    await this.authService.deleteDevice(userId, deviceId);
    return { message: '设备已删除' };
  }
}
