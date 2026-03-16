import { IsNotEmpty, IsNumber, IsOptional, IsString } from "class-validator";

export class TelegramAuthDto {
  @IsNotEmpty()
  @IsString()
  id: string;

  @IsNotEmpty()
  @IsString()
  first_name: string;

  @IsOptional()
  @IsString()
  last_name?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  photo_url?: string;

  @IsNotEmpty()
  @IsNumber()
  auth_date: number;

  @IsNotEmpty()
  @IsString()
  hash: string;
}
