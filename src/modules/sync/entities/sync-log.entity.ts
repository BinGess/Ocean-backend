import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { Device } from '../../auth/entities/device.entity';

export enum SyncOperation {
  PULL = 'pull',
  PUSH = 'push',
  CONFLICT_RESOLVED = 'conflict_resolved',
  BULK_MIGRATE = 'bulk_migrate',
}

export enum SyncStatus {
  SUCCESS = 'success',
  FAILED = 'failed',
  PARTIAL = 'partial',
}

@Entity('sync_logs')
export class SyncLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'uuid', name: 'device_id', nullable: true })
  deviceId: string | null;

  @Column({
    type: 'enum',
    enum: SyncOperation,
  })
  operation: SyncOperation;

  @Column({
    type: 'enum',
    enum: SyncStatus,
  })
  status: SyncStatus;

  @Column({ type: 'jsonb', name: 'sync_details', nullable: true })
  syncDetails: {
    recordsCreated?: number;
    recordsUpdated?: number;
    recordsDeleted?: number;
    conflictsDetected?: number;
    conflictsResolved?: number;
    errors?: string[];
  } | null;

  @Column({ type: 'timestamp', name: 'started_at' })
  startedAt: Date;

  @Column({ type: 'timestamp', name: 'completed_at', nullable: true })
  completedAt: Date | null;

  @Column({ type: 'int', name: 'duration_ms', nullable: true })
  durationMs: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Device, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'device_id' })
  device: Device | null;
}
