import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * 从 JWT Payload 中提取当前用户信息
 * 使用示例：
 * @Get('profile')
 * getProfile(@CurrentUser() user) { return user; }
 *
 * @Get('profile')
 * getProfile(@CurrentUser('id') userId: string) { return userId; }
 */
export const CurrentUser = createParamDecorator(
  (data: string, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);
