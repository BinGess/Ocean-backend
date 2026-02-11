import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
  Headers,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SyncService } from './sync.service';
import { PullSyncDto, PullSyncResponse } from './dto/pull-sync.dto';
import { PushSyncDto, PushSyncResponse } from './dto/push-sync.dto';
import {
  ResolveConflictDto,
  ResolveConflictResponse,
} from './dto/resolve-conflict.dto';
import { BulkMigrateDto, BulkMigrateResponse } from './dto/bulk-migrate.dto';

@Controller('sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  /**
   * GET /api/v1/sync/pull
   * 增量拉取服务端变更
   */
  @Get('pull')
  @Throttle({ global: { limit: 60, ttl: 60000 } }) // 60 次/分钟
  @UsePipes(new ValidationPipe({ transform: true }))
  async pullChanges(
    @CurrentUser('id') userId: string,
    @Query() pullDto: PullSyncDto,
  ): Promise<PullSyncResponse> {
    return this.syncService.pullChanges(userId, pullDto);
  }

  /**
   * POST /api/v1/sync/push
   * 批量推送客户端变更（含冲突检测）
   */
  @Post('push')
  @Throttle({ global: { limit: 30, ttl: 60000 } }) // 30 次/分钟
  @UsePipes(new ValidationPipe({ transform: true }))
  async pushChanges(
    @CurrentUser('id') userId: string,
    @Body() pushDto: PushSyncDto,
    @Headers('X-Device-Id') deviceId?: string,
  ): Promise<PushSyncResponse> {
    return this.syncService.pushChanges(userId, pushDto, deviceId);
  }

  /**
   * POST /api/v1/sync/resolve-conflict
   * 手动解决数据冲突
   */
  @Post('resolve-conflict')
  @Throttle({ global: { limit: 30, ttl: 60000 } }) // 30 次/分钟
  @UsePipes(new ValidationPipe({ transform: true }))
  async resolveConflict(
    @CurrentUser('id') userId: string,
    @Body() resolveDto: ResolveConflictDto,
  ): Promise<ResolveConflictResponse> {
    return this.syncService.resolveConflict(userId, resolveDto);
  }

  /**
   * POST /api/v1/sync/bulk-migrate
   * 首次迁移（批量导入本地数据）
   */
  @Post('bulk-migrate')
  @Throttle({ global: { limit: 10, ttl: 60000 } }) // 10 次/分钟（避免滥用）
  @UsePipes(new ValidationPipe({ transform: true }))
  async bulkMigrate(
    @CurrentUser('id') userId: string,
    @Body() migrateDto: BulkMigrateDto,
    @Headers('X-Device-Id') deviceId?: string,
  ): Promise<BulkMigrateResponse> {
    return this.syncService.bulkMigrate(userId, migrateDto, deviceId);
  }
}
