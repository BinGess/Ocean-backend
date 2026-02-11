import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { getDatabaseConfig } from './config/database.config';
import { AuthModule } from './modules/auth/auth.module';
import { RecordsModule } from './modules/records/records.module';
import { AiModule } from './modules/ai/ai.module';
import { SyncModule } from './modules/sync/sync.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

@Module({
  imports: [
    // 配置模块（全局）
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // 数据库连接
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: getDatabaseConfig,
      inject: [ConfigService],
    }),

    // 限流模块
    ThrottlerModule.forRoot([
      {
        name: 'global',
        ttl: 60000, // 1 分钟
        limit: 100, // 100 次请求
      },
      {
        name: 'ai-api',
        ttl: 60000,
        limit: 10, // AI API 限流更严格
      },
    ]),

    // 业务模块
    AuthModule,
    RecordsModule,
    AiModule,
    SyncModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // 全局应用 JWT 认证守卫
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
