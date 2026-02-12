import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User } from './entities/user.entity';
import { Device } from './entities/device.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { DeviceInfoDto } from './dto/device-info.dto';
import { CryptoUtil } from '../../utils/crypto.util';

export interface AuthResponse {
  user: {
    id: string;
    phone: string | null;
    email: string | null;
    username: string | null;
    createdAt: Date;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number; // 秒
  };
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Device)
    private deviceRepository: Repository<Device>,
    @InjectRepository(RefreshToken)
    private refreshTokenRepository: Repository<RefreshToken>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  /**
   * 用户注册
   */
  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    const { phone, email, password, deviceInfo } = registerDto;

    // 验证至少提供 phone 或 email
    if (!phone && !email) {
      throw new BadRequestException('手机号或邮箱至少提供一个');
    }

    // 检查用户是否已存在
    const existingUser = await this.userRepository.findOne({
      where: [
        { phone, deletedAt: null as any },
        { email, deletedAt: null as any },
      ].filter(Boolean),
    });

    if (existingUser) {
      throw new ConflictException(
        phone ? '手机号已被注册' : '邮箱已被注册',
      );
    }

    // 加密密码
    const passwordHash = await CryptoUtil.hashPassword(password);

    // 创建用户
    const user = this.userRepository.create({
      phone,
      email,
      passwordHash,
    });

    await this.userRepository.save(user);

    // 创建设备
    const device = await this.createOrUpdateDevice(user.id, deviceInfo);

    // 生成 Token
    const tokens = await this.generateTokens(user.id, device.id);

    return {
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        username: user.username,
        createdAt: user.createdAt,
      },
      tokens,
    };
  }

  /**
   * 用户登录
   */
  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const { identifier, password, deviceInfo } = loginDto;

    // 查找用户（通过 phone 或 email）
    const user = await this.userRepository.findOne({
      where: [
        { phone: identifier, deletedAt: null as any },
        { email: identifier, deletedAt: null as any },
      ],
    });

    if (!user) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    // 检查账号是否被锁定
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException(
        `账号已被锁定，请在 ${user.lockedUntil.toLocaleString()} 后重试`,
      );
    }

    // 验证密码
    const isPasswordValid = await CryptoUtil.comparePassword(
      password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      // 增加失败次数
      user.loginAttempts += 1;

      // 5 次失败后锁定 1 分钟
      if (user.loginAttempts >= 5) {
        user.lockedUntil = new Date(Date.now() + 60 * 1000); // 1 分钟后解锁
        user.loginAttempts = 0;
      }

      await this.userRepository.save(user);

      throw new UnauthorizedException('用户名或密码错误');
    }

    // 登录成功，重置失败次数
    user.loginAttempts = 0;
    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    // 创建或更新设备
    const device = await this.createOrUpdateDevice(user.id, deviceInfo);

    // 生成 Token
    const tokens = await this.generateTokens(user.id, device.id);

    return {
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        username: user.username,
        createdAt: user.createdAt,
      },
      tokens,
    };
  }

  /**
   * 刷新 Access Token
   */
  async refreshAccessToken(refreshToken: string): Promise<string> {
    try {
      // 验证 Refresh Token
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      // 查找 Refresh Token
      const tokenHash = await CryptoUtil.hashToken(refreshToken);
      const storedToken = await this.refreshTokenRepository.findOne({
        where: { tokenHash, revokedAt: null as any },
      });

      if (!storedToken) {
        throw new UnauthorizedException('Refresh Token 无效');
      }

      // 检查是否过期
      if (storedToken.expiresAt < new Date()) {
        throw new UnauthorizedException('Refresh Token 已过期');
      }

      // 生成新的 Access Token
      const newAccessToken = this.jwtService.sign(
        { sub: payload.sub, deviceId: payload.deviceId },
        {
          secret: this.configService.get<string>('JWT_SECRET') || 'default-jwt-secret-please-change-in-production',
          expiresIn: (this.configService.get<string>('JWT_EXPIRES_IN') || '7d') as any,
        },
      );

      return newAccessToken;
    } catch (error) {
      throw new UnauthorizedException('Refresh Token 无效或已过期');
    }
  }

  /**
   * 登出（撤销 Refresh Token）
   */
  async logout(refreshToken: string): Promise<void> {
    const tokenHash = await CryptoUtil.hashToken(refreshToken);

    await this.refreshTokenRepository.update(
      { tokenHash },
      { revokedAt: new Date() },
    );
  }

  /**
   * 获取用户的所有设备
   */
  async getUserDevices(userId: string): Promise<Device[]> {
    return this.deviceRepository.find({
      where: { userId },
      order: { lastActiveAt: 'DESC' },
    });
  }

  /**
   * 删除指定设备（远程登出）
   */
  async deleteDevice(userId: string, deviceId: string): Promise<void> {
    // 撤销该设备的所有 Refresh Token
    await this.refreshTokenRepository.update(
      { userId, deviceId },
      { revokedAt: new Date() },
    );

    // 删除设备
    await this.deviceRepository.delete({ id: deviceId, userId });
  }

  /**
   * 创建或更新设备
   */
  private async createOrUpdateDevice(
    userId: string,
    deviceInfo: DeviceInfoDto,
  ): Promise<Device> {
    let device = await this.deviceRepository.findOne({
      where: { userId, deviceId: deviceInfo.deviceId },
    });

    if (device) {
      // 更新设备信息
      device.deviceName = deviceInfo.deviceName || device.deviceName;
      device.osVersion = deviceInfo.osVersion || device.osVersion;
      device.appVersion = deviceInfo.appVersion || device.appVersion;
      device.fcmToken = deviceInfo.fcmToken || device.fcmToken;
      device.lastActiveAt = new Date();
    } else {
      // 创建新设备
      device = this.deviceRepository.create({
        userId,
        deviceId: deviceInfo.deviceId,
        deviceName: deviceInfo.deviceName,
        platform: deviceInfo.platform,
        osVersion: deviceInfo.osVersion,
        appVersion: deviceInfo.appVersion,
        fcmToken: deviceInfo.fcmToken,
      });
    }

    return this.deviceRepository.save(device);
  }

  /**
   * 生成 Access Token 和 Refresh Token
   */
  private async generateTokens(
    userId: string,
    deviceId: string,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    const payload = { sub: userId, deviceId };

    // 生成 Access Token
    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET') || 'default-jwt-secret-please-change-in-production',
      expiresIn: (this.configService.get<string>('JWT_EXPIRES_IN') || '7d') as any,
    });

    // 生成 Refresh Token
    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET') || 'default-jwt-refresh-secret-please-change-in-production',
      expiresIn: (this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') || '30d') as any,
    });

    // 存储 Refresh Token
    const tokenHash = await CryptoUtil.hashToken(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 天后过期

    await this.refreshTokenRepository.save({
      userId,
      deviceId,
      tokenHash,
      expiresAt,
    });

    // 计算过期时间（秒）
    const expiresIn = 7 * 24 * 60 * 60; // 7 天

    return { accessToken, refreshToken, expiresIn };
  }
}
