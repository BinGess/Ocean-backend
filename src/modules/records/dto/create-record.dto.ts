import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  IsDateString,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RecordType, ProcessingMode } from '../entities/record.entity';

class FeelingDto {
  @IsString()
  @IsNotEmpty()
  feeling: string;

  @IsNumber()
  @Min(1)
  @Max(5)
  intensity: number;
}

class NeedDto {
  @IsString()
  @IsNotEmpty()
  need: string;

  @IsString()
  @IsNotEmpty()
  reason: string;
}

class NVCAnalysisDto {
  @IsString()
  @IsNotEmpty()
  observation: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FeelingDto)
  feelings: FeelingDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NeedDto)
  needs: NeedDto[];

  @IsString()
  @IsOptional()
  request?: string;

  @IsString()
  @IsOptional()
  insight?: string;

  @IsDateString()
  analyzedAt: string;
}

export class CreateRecordDto {
  @IsEnum(RecordType)
  type: RecordType;

  @IsString()
  @IsNotEmpty()
  transcription: string;

  @IsString()
  @IsOptional()
  audioUrl?: string;

  @IsNumber()
  @IsOptional()
  duration?: number;

  @IsEnum(ProcessingMode)
  @IsOptional()
  processingMode?: ProcessingMode;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  moods?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  needs?: string[];

  @ValidateNested()
  @Type(() => NVCAnalysisDto)
  @IsOptional()
  nvcAnalysis?: NVCAnalysisDto;

  // 日记字段
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  summary?: string;

  @IsDateString()
  @IsOptional()
  date?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  referencedFragments?: string[];

  // 周记字段
  @IsString()
  @IsOptional()
  weekRange?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  referencedRecords?: string[];
}
