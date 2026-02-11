import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { SyncLog } from './entities/sync-log.entity';
import { Record } from '../records/entities/record.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SyncLog, Record])],
  controllers: [SyncController],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}
