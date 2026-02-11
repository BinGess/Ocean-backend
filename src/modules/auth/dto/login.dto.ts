import {
  IsString,
  IsNotEmpty,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DeviceInfoDto } from './device-info.dto';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  identifier: string; // phone 或 email

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  password: string;

  @ValidateNested()
  @Type(() => DeviceInfoDto)
  @IsNotEmpty()
  deviceInfo: DeviceInfoDto;
}
