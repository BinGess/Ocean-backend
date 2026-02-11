import { SetMetadata } from '@nestjs/common';

/**
 * 标记接口为公开（不需要 JWT 认证）
 * 使用示例：
 * @Public()
 * @Get('health')
 * healthCheck() { return 'OK'; }
 */
export const Public = () => SetMetadata('isPublic', true);
