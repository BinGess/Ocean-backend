import {
  IsArray,
  IsOptional,
  ValidateNested,
  IsUUID,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateRecordDto } from '../../records/dto/create-record.dto';
import { UpdateRecordDto } from '../../records/dto/update-record.dto';

class RecordChanges {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRecordDto)
  @IsOptional()
  created?: Array<CreateRecordDto & { clientId: string }>;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateRecordDto)
  @IsOptional()
  updated?: Array<UpdateRecordDto & { id: string }>;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  deleted?: string[];
}

class WeeklyInsightChanges {
  @IsArray()
  @ValidateNested({ each: true })
  @IsOptional()
  created?: Array<any & { clientId: string }>;

  @IsArray()
  @ValidateNested({ each: true })
  @IsOptional()
  updated?: Array<any & { id: string; version: number }>;

  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  deleted?: string[];
}

export class PushSyncDto {
  @ValidateNested()
  @Type(() => RecordChanges)
  @IsOptional()
  records?: RecordChanges;

  @ValidateNested()
  @Type(() => WeeklyInsightChanges)
  @IsOptional()
  weeklyInsights?: WeeklyInsightChanges;

  @IsString()
  @IsOptional()
  deviceId?: string;
}

export interface ConflictInfo {
  entityType: 'record' | 'weekly_insight';
  entityId: string;
  clientVersion: number;
  serverVersion: number;
  serverData: any;
}

export interface PushSyncResponse {
  results: {
    records?: {
      created: Array<{ clientId: string; serverId: string; data: any }>;
      updated: Array<{ id: string; data: any }>;
      deleted: string[];
    };
    weeklyInsights?: {
      created: Array<{ clientId: string; serverId: string; data: any }>;
      updated: Array<{ id: string; data: any }>;
      deleted: string[];
    };
  };
  conflicts: ConflictInfo[];
  syncTimestamp: string;
}
