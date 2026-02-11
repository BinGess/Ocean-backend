import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // 全局验证管道（DTO 自动验证）
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // 自动删除未定义的属性
      forbidNonWhitelisted: true, // 抛出错误如果有未定义的属性
      transform: true, // 自动类型转换
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // 全局路由前缀
  app.setGlobalPrefix('api/v1');

  // CORS 配置（生产环境需要限制域名）
  app.enableCors({
    origin:
      configService.get<string>('NODE_ENV') === 'production'
        ? ['https://mindflow.example.com'] // 替换为实际域名
        : '*',
    credentials: true,
  });

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);

  console.log(`🚀 MindFlow Backend is running on http://localhost:${port}/api/v1`);
  console.log(`📚 Environment: ${configService.get<string>('NODE_ENV')}`);
}

bootstrap();
