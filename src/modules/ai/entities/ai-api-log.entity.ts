import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';

export enum AiApiType {
  DOUBAO_ASR = 'doubao_asr',
  DOUBAO_LLM = 'doubao_llm',
  COZE_NVC = 'coze_nvc',
  COZE_INSIGHT = 'coze_insight',
}

@Entity('ai_api_logs')
export class AiApiLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true, name: 'user_id' })
  userId: string | null;

  @Column({ type: 'enum', enum: AiApiType, name: 'api_type' })
  apiType: AiApiType;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'request_id' })
  requestId: string | null;

  // 请求信息
  @Column({ type: 'int', nullable: true, name: 'input_tokens' })
  inputTokens: number | null;

  @Column({ type: 'int', nullable: true, name: 'output_tokens' })
  outputTokens: number | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    name: 'audio_duration',
  })
  audioDuration: number | null;

  // 响应信息
  @Column({ type: 'int', nullable: true, name: 'status_code' })
  statusCode: number | null;

  @Column({ type: 'int', nullable: true, name: 'response_time_ms' })
  responseTimeMs: number | null;

  @Column({ type: 'text', nullable: true, name: 'error_message' })
  errorMessage: string | null;

  // 成本计算（单位：分）
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 4,
    nullable: true,
    name: 'estimated_cost',
  })
  estimatedCost: number | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'called_at' })
  calledAt: Date;

  // 关系
  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;
}
