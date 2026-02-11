import { PartialType } from '@nestjs/mapped-types';
import { IsInt, IsOptional, Min } from 'class-validator';
import { CreateRecordDto } from './create-record.dto';

export class UpdateRecordDto extends PartialType(CreateRecordDto) {
  @IsInt()
  @Min(1)
  version: number; // 乐观锁版本号（必须）

  @IsOptional()
  patternFeedback?: 'like' | 'dislike' | 'uncertain';
}
