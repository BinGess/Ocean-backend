import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class AppController {
  /**
   * 健康检查端点（不需要认证）
   * GET /api/v1/health
   */
  @Public()
  @Get('health')
  healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'MindFlow Backend',
      version: '1.0.0',
    };
  }
}
