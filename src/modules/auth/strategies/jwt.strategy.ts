import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

export interface JwtPayload {
  sub: string; // userId
  deviceId: string;
  iat?: number;
  exp?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private configService: ConfigService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'default-jwt-secret-please-change-in-production',
    });
  }

  /**
   * 验证 JWT Payload
   * 此方法会在 JWT 验证通过后自动调用
   */
  async validate(payload: JwtPayload) {
    const { sub: userId } = payload;

    // 查找用户（确保用户存在且未被删除）
    const user = await this.userRepository.findOne({
      where: { id: userId, deletedAt: null as any },
      select: ['id', 'phone', 'email', 'username', 'createdAt'],
    });

    if (!user) {
      throw new UnauthorizedException('用户不存在或已被删除');
    }

    // 返回的对象会被注入到 request.user
    return {
      id: user.id,
      phone: user.phone,
      email: user.email,
      username: user.username,
      deviceId: payload.deviceId,
    };
  }
}
