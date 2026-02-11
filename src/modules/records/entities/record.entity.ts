import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { Device } from '../../auth/entities/device.entity';

export enum RecordType {
  QUICK_NOTE = 'quick_note',
  JOURNAL = 'journal',
  WEEKLY = 'weekly',
}

export enum ProcessingMode {
  ONLY_RECORD = 'only_record',
  WITH_MOOD = 'with_mood',
  WITH_NVC = 'with_nvc',
}

@Entity('records')
export class Record {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  // 基础字段
  @Column({
    type: 'enum',
    enum: RecordType,
    default: RecordType.QUICK_NOTE,
  })
  type: RecordType;

  @Column({ type: 'text' })
  transcription: string;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'audio_url' })
  audioUrl: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  duration: number | null;

  @Column({
    type: 'enum',
    enum: ProcessingMode,
    nullable: true,
    name: 'processing_mode',
  })
  processingMode: ProcessingMode | null;

  // 情绪与需求（数组）
  @Column({ type: 'text', array: true, nullable: true })
  moods: string[] | null;

  @Column({ type: 'text', array: true, nullable: true })
  needs: string[] | null;

  // NVC 分析（JSONB）
  @Column({ type: 'jsonb', nullable: true, name: 'nvc_analysis' })
  nvcAnalysis: NVCAnalysisData | null;

  // 日记特定字段
  @Column({ type: 'varchar', length: 255, nullable: true })
  title: string | null;

  @Column({ type: 'text', nullable: true })
  summary: string | null;

  @Column({ type: 'date', nullable: true })
  date: Date | null;

  @Column({
    type: 'text',
    array: true,
    nullable: true,
    name: 'referenced_fragments',
  })
  referencedFragments: string[] | null;

  // 周记特定字段
  @Column({ type: 'varchar', length: 50, nullable: true, name: 'week_range' })
  weekRange: string | null;

  @Column({
    type: 'text',
    array: true,
    nullable: true,
    name: 'referenced_records',
  })
  referencedRecords: string[] | null;

  // 用户反馈
  @Column({
    type: 'varchar',
    length: 20,
    nullable: true,
    name: 'pattern_feedback',
  })
  patternFeedback: string | null; // 'like', 'dislike', 'uncertain'

  // 版本控制（乐观锁）
  @Column({ type: 'int', default: 1 })
  version: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;

  @Column({ type: 'timestamptz', nullable: true, name: 'deleted_at' })
  deletedAt: Date | null;

  // 同步元数据
  @Column({ type: 'uuid', nullable: true, name: 'created_device_id' })
  createdDeviceId: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'last_modified_device_id' })
  lastModifiedDeviceId: string | null;

  // 关系
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Device, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_device_id' })
  createdDevice: Device | null;

  @ManyToOne(() => Device, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'last_modified_device_id' })
  lastModifiedDevice: Device | null;
}

// NVC 分析数据结构
export interface NVCAnalysisData {
  observation: string;
  feelings: Array<{
    feeling: string;
    intensity: number; // 1-5
  }>;
  needs: Array<{
    need: string;
    reason: string;
  }>;
  request?: string;
  insight?: string;
  analyzedAt: string;
}
