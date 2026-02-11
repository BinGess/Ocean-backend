import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('devices')
export class Device {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 255, name: 'device_id' })
  deviceId: string; // 客户端生成的唯一标识

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'device_name' })
  deviceName: string | null; // "iPhone 15 Pro"

  @Column({ type: 'varchar', length: 50 })
  platform: string; // "ios", "android"

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'os_version' })
  osVersion: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'app_version' })
  appVersion: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'fcm_token' })
  fcmToken: string | null; // Firebase Cloud Messaging Token

  @Column({ type: 'timestamptz', nullable: true, name: 'last_sync_at' })
  lastSyncAt: Date | null;

  @Column({ type: 'timestamptz', name: 'last_active_at', default: () => 'NOW()' })
  lastActiveAt: Date;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  // 关系
  @ManyToOne(() => User, (user) => user.devices, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
