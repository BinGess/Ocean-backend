import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';

export class DeviceInfoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  deviceId: string; // 客户端生成的唯一设备标识

  @IsString()
  @IsOptional()
  @MaxLength(100)
  deviceName?: string; // "iPhone 15 Pro"

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  platform: string; // "ios", "android"

  @IsString()
  @IsOptional()
  @MaxLength(50)
  osVersion?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  appVersion?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  fcmToken?: string; // Firebase Cloud Messaging Token
}
