import { IsEnum, IsUUID, IsObject, IsOptional, IsIn } from 'class-validator';

export enum ConflictResolution {
  SERVER_WINS = 'server_wins',
  CLIENT_WINS = 'client_wins',
  MERGE = 'merge',
}

export class ResolveConflictDto {
  @IsUUID('4')
  entityId: string;

  @IsIn(['record', 'weekly_insight'])
  entityType: 'record' | 'weekly_insight';

  @IsEnum(ConflictResolution)
  resolution: ConflictResolution;

  @IsObject()
  @IsOptional()
  mergedData?: any;
}

export interface ResolveConflictResponse {
  entityId: string;
  entityType: 'record' | 'weekly_insight';
  version: number;
  data: any;
  resolvedAt: string;
}
