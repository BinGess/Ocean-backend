import {
  IsOptional,
  IsEnum,
  IsDateString,
  IsString,
  IsInt,
  Min,
  Max,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { RecordType } from '../entities/record.entity';

export class QueryRecordsDto {
  @IsEnum(RecordType)
  @IsOptional()
  type?: RecordType;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  moods?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  needs?: string[];

  @IsString()
  @IsOptional()
  weekRange?: string;

  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  @IsOptional()
  limit?: number = 50;

  @IsInt()
  @Min(0)
  @Type(() => Number)
  @IsOptional()
  offset?: number = 0;
}
