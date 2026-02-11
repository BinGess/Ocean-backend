import { IsArray, ValidateNested, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateRecordDto } from '../../records/dto/create-record.dto';

export class BulkMigrateDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRecordDto)
  records: Array<CreateRecordDto & { clientId: string }>;

  @IsArray()
  @ValidateNested({ each: true })
  @IsOptional()
  weeklyInsights?: Array<any & { clientId: string }>;

  @IsString()
  @IsOptional()
  deviceId?: string;
}

export interface BulkMigrateResponse {
  results: {
    records: Array<{ clientId: string; serverId: string; data: any }>;
    weeklyInsights?: Array<{ clientId: string; serverId: string; data: any }>;
  };
  totalProcessed: number;
  totalErrors: number;
  errors?: Array<{ clientId: string; error: string }>;
  syncTimestamp: string;
}
