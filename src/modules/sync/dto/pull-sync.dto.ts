import { IsDateString, IsOptional, IsArray, IsEnum } from 'class-validator';

export enum SyncEntityType {
  RECORDS = 'records',
  WEEKLY_INSIGHTS = 'weekly_insights',
}

export class PullSyncDto {
  @IsDateString()
  lastSyncTimestamp: string;

  @IsOptional()
  @IsArray()
  @IsEnum(SyncEntityType, { each: true })
  entityTypes?: SyncEntityType[];
}

export interface PullSyncResponse {
  changes: {
    records?: {
      created: any[];
      updated: any[];
      deleted: string[];
    };
    weeklyInsights?: {
      created: any[];
      updated: any[];
      deleted: string[];
    };
  };
  syncTimestamp: string;
  hasMore: boolean;
}
