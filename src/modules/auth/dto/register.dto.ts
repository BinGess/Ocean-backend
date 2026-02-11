import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsOptional,
  MinLength,
  MaxLength,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { DeviceInfoDto } from './device-info.dto';

export class RegisterDto {
  @IsString()
  @IsOptional()
  @MaxLength(20)
  @ValidateIf((o) => !o.email) // phone 或 email 至少提供一个
  phone?: string;

  @IsEmail()
  @IsOptional()
  @MaxLength(255)
  @ValidateIf((o) => !o.phone)
  email?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8, { message: '密码长度至少 8 位' })
  @MaxLength(100)
  password: string;

  @ValidateNested()
  @Type(() => DeviceInfoDto)
  @IsNotEmpty()
  deviceInfo: DeviceInfoDto;
}
