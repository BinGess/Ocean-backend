import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, In } from 'typeorm';
import { Record } from '../records/entities/record.entity';
import { SyncLog, SyncOperation, SyncStatus } from './entities/sync-log.entity';
import {
  PullSyncDto,
  PullSyncResponse,
  SyncEntityType,
} from './dto/pull-sync.dto';
import {
  PushSyncDto,
  PushSyncResponse,
  ConflictInfo,
} from './dto/push-sync.dto';
import {
  ResolveConflictDto,
  ResolveConflictResponse,
  ConflictResolution,
} from './dto/resolve-conflict.dto';
import {
  BulkMigrateDto,
  BulkMigrateResponse,
} from './dto/bulk-migrate.dto';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    @InjectRepository(Record)
    private readonly recordRepository: Repository<Record>,
    @InjectRepository(SyncLog)
    private readonly syncLogRepository: Repository<SyncLog>,
  ) {}

  /**
   * 增量拉取 - 获取服务端自上次同步以来的所有变更
   */
  async pullChanges(
    userId: string,
    pullDto: PullSyncDto,
  ): Promise<PullSyncResponse> {
    const startTime = Date.now();
    const { lastSyncTimestamp, entityTypes = [SyncEntityType.RECORDS] } =
      pullDto;

    try {
      const changes: PullSyncResponse['changes'] = {};
      const syncTime = new Date();

      // 拉取记录变更
      if (entityTypes.includes(SyncEntityType.RECORDS)) {
        const allRecords = await this.recordRepository.find({
          where: {
            userId,
            updatedAt: MoreThan(new Date(lastSyncTimestamp)),
          },
          order: { updatedAt: 'ASC' },
        });

        const created = allRecords.filter(
          (r) =>
            r.createdAt > new Date(lastSyncTimestamp) && r.deletedAt === null,
        );
        const updated = allRecords.filter(
          (r) =>
            r.createdAt <= new Date(lastSyncTimestamp) && r.deletedAt === null,
        );
        const deleted = allRecords
          .filter((r) => r.deletedAt !== null)
          .map((r) => r.id);

        changes.records = {
          created: created.map((r) => this.sanitizeRecord(r)),
          updated: updated.map((r) => this.sanitizeRecord(r)),
          deleted,
        };
      }

      // TODO: 拉取周报变更（暂未实现 WeeklyInsight 实体）

      // 记录同步日志
      await this.createSyncLog({
        userId,
        operation: SyncOperation.PULL,
        status: SyncStatus.SUCCESS,
        startedAt: new Date(startTime),
        completedAt: new Date(),
        syncDetails: {
          recordsCreated: changes.records?.created.length || 0,
          recordsUpdated: changes.records?.updated.length || 0,
          recordsDeleted: changes.records?.deleted.length || 0,
        },
      });

      return {
        changes,
        syncTimestamp: syncTime.toISOString(),
        hasMore: false, // 当前实现返回所有数据，未分页
      };
    } catch (error) {
      this.logger.error(
        `Pull sync failed for user ${userId}:`,
        error.stack,
      );

      await this.createSyncLog({
        userId,
        operation: SyncOperation.PULL,
        status: SyncStatus.FAILED,
        startedAt: new Date(startTime),
        completedAt: new Date(),
        syncDetails: { errors: [error.message] },
      });

      throw error;
    }
  }

  /**
   * 批量推送 - 接收客户端变更并检测冲突
   */
  async pushChanges(
    userId: string,
    pushDto: PushSyncDto,
    deviceId?: string,
  ): Promise<PushSyncResponse> {
    const startTime = Date.now();
    const { records } = pushDto;

    try {
      const results: PushSyncResponse['results'] = {};
      const conflicts: ConflictInfo[] = [];
      const syncTime = new Date();

      // 处理记录变更
      if (records) {
        const recordResults = {
          created: [] as Array<{
            clientId: string;
            serverId: string;
            data: any;
          }>,
          updated: [] as Array<{ id: string; data: any }>,
          deleted: [] as string[],
        };

        // 处理新建记录
        if (records.created && records.created.length > 0) {
          for (const item of records.created) {
            const { clientId, ...recordData } = item;

            const newRecord = this.recordRepository.create({
              ...recordData,
              userId,
              version: 1,
            });

            const saved = await this.recordRepository.save(newRecord);

            recordResults.created.push({
              clientId,
              serverId: saved.id,
              data: this.sanitizeRecord(saved),
            });
          }
        }

        // 处理更新记录（含乐观锁冲突检测）
        if (records.updated && records.updated.length > 0) {
          for (const item of records.updated) {
            const { id, version, ...updateData } = item;

            const existing = await this.recordRepository.findOne({
              where: { id, userId },
            });

            if (!existing) {
              this.logger.warn(
                `Record ${id} not found for update, skipping`,
              );
              continue;
            }

            // 乐观锁检测
            if (existing.version !== version) {
              conflicts.push({
                entityType: 'record',
                entityId: id,
                clientVersion: version,
                serverVersion: existing.version,
                serverData: this.sanitizeRecord(existing),
              });
              continue; // 跳过此更新
            }

            // 无冲突，执行更新
            Object.assign(existing, updateData);
            existing.version += 1;
            existing.updatedAt = new Date();

            const updated = await this.recordRepository.save(existing);

            recordResults.updated.push({
              id: updated.id,
              data: this.sanitizeRecord(updated),
            });
          }
        }

        // 处理删除记录（软删除）
        if (records.deleted && records.deleted.length > 0) {
          const recordsToDelete = await this.recordRepository.find({
            where: { id: In(records.deleted), userId },
          });

          for (const record of recordsToDelete) {
            record.deletedAt = new Date();
            await this.recordRepository.save(record);
          }

          recordResults.deleted = records.deleted;
        }

        results.records = recordResults;
      }

      // TODO: 处理周报变更（暂未实现）

      // 记录同步日志
      await this.createSyncLog({
        userId,
        deviceId,
        operation: SyncOperation.PUSH,
        status: conflicts.length > 0 ? SyncStatus.PARTIAL : SyncStatus.SUCCESS,
        startedAt: new Date(startTime),
        completedAt: new Date(),
        syncDetails: {
          recordsCreated: results.records?.created.length || 0,
          recordsUpdated: results.records?.updated.length || 0,
          recordsDeleted: results.records?.deleted.length || 0,
          conflictsDetected: conflicts.length,
        },
      });

      return {
        results,
        conflicts,
        syncTimestamp: syncTime.toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Push sync failed for user ${userId}:`,
        error.stack,
      );

      await this.createSyncLog({
        userId,
        deviceId,
        operation: SyncOperation.PUSH,
        status: SyncStatus.FAILED,
        startedAt: new Date(startTime),
        completedAt: new Date(),
        syncDetails: { errors: [error.message] },
      });

      throw error;
    }
  }

  /**
   * 冲突解决 - 根据策略解决数据冲突
   */
  async resolveConflict(
    userId: string,
    resolveDto: ResolveConflictDto,
  ): Promise<ResolveConflictResponse> {
    const { entityId, entityType, resolution, mergedData } = resolveDto;

    if (entityType === 'record') {
      const record = await this.recordRepository.findOne({
        where: { id: entityId, userId },
      });

      if (!record) {
        throw new NotFoundException(`Record ${entityId} not found`);
      }

      switch (resolution) {
        case ConflictResolution.SERVER_WINS:
          // 服务端优先：不做任何更改，返回服务端数据
          return {
            entityId: record.id,
            entityType: 'record',
            version: record.version,
            data: this.sanitizeRecord(record),
            resolvedAt: new Date().toISOString(),
          };

        case ConflictResolution.CLIENT_WINS:
          // 客户端优先：需要客户端重新提交完整数据（通过 Push 接口）
          throw new BadRequestException(
            'CLIENT_WINS resolution requires re-pushing data with force flag',
          );

        case ConflictResolution.MERGE:
          // 合并策略：使用客户端提供的 mergedData
          if (!mergedData) {
            throw new BadRequestException(
              'mergedData is required for MERGE resolution',
            );
          }

          Object.assign(record, mergedData);
          record.version += 1;
          record.updatedAt = new Date();

          const merged = await this.recordRepository.save(record);

          return {
            entityId: merged.id,
            entityType: 'record',
            version: merged.version,
            data: this.sanitizeRecord(merged),
            resolvedAt: new Date().toISOString(),
          };

        default:
          throw new BadRequestException(`Unknown resolution: ${resolution}`);
      }
    }

    // TODO: 处理周报冲突（暂未实现）
    throw new BadRequestException(`Unsupported entity type: ${entityType}`);
  }

  /**
   * 首次迁移 - 批量导入本地 Hive 数据
   */
  async bulkMigrate(
    userId: string,
    migrateDto: BulkMigrateDto,
    deviceId?: string,
  ): Promise<BulkMigrateResponse> {
    const startTime = Date.now();
    const { records } = migrateDto;

    try {
      const results = {
        records: [] as Array<{
          clientId: string;
          serverId: string;
          data: any;
        }>,
      };
      const errors: Array<{ clientId: string; error: string }> = [];

      // 批量插入记录（每批 500 条）
      const BATCH_SIZE = 500;
      for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE);

        for (const item of batch) {
          try {
            const { clientId, ...recordData } = item;

            const newRecord = this.recordRepository.create({
              ...recordData,
              userId,
              version: 1,
            });

            const saved = await this.recordRepository.save(newRecord);

            results.records.push({
              clientId,
              serverId: saved.id,
              data: this.sanitizeRecord(saved),
            });
          } catch (error) {
            this.logger.error(
              `Failed to migrate record ${item.clientId}:`,
              error.stack,
            );
            errors.push({
              clientId: item.clientId,
              error: error.message,
            });
          }
        }
      }

      // TODO: 批量插入周报（暂未实现）

      // 记录同步日志
      await this.createSyncLog({
        userId,
        deviceId,
        operation: SyncOperation.BULK_MIGRATE,
        status: errors.length > 0 ? SyncStatus.PARTIAL : SyncStatus.SUCCESS,
        startedAt: new Date(startTime),
        completedAt: new Date(),
        syncDetails: {
          recordsCreated: results.records.length,
          errors: errors.map((e) => `${e.clientId}: ${e.error}`),
        },
      });

      return {
        results,
        totalProcessed: records.length,
        totalErrors: errors.length,
        errors: errors.length > 0 ? errors : undefined,
        syncTimestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Bulk migration failed for user ${userId}:`,
        error.stack,
      );

      await this.createSyncLog({
        userId,
        deviceId,
        operation: SyncOperation.BULK_MIGRATE,
        status: SyncStatus.FAILED,
        startedAt: new Date(startTime),
        completedAt: new Date(),
        syncDetails: { errors: [error.message] },
      });

      throw error;
    }
  }

  /**
   * 创建同步日志
   */
  private async createSyncLog(data: {
    userId: string;
    deviceId?: string;
    operation: SyncOperation;
    status: SyncStatus;
    startedAt: Date;
    completedAt: Date;
    syncDetails?: any;
  }): Promise<void> {
    const log = this.syncLogRepository.create({
      ...data,
      durationMs: data.completedAt.getTime() - data.startedAt.getTime(),
    });

    await this.syncLogRepository.save(log);
  }

  /**
   * 清理记录敏感字段（如果有的话）
   */
  private sanitizeRecord(record: Record): any {
    const { user, ...rest } = record as any;
    return rest;
  }
}
