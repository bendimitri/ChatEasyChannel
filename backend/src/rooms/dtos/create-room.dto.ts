import { IsOptional, IsString, Length } from 'class-validator';

export class CreateRoomDto {
  @IsString()
  @Length(1, 60)
  name: string;

  @IsOptional()
  @IsString()
  @Length(0, 255)
  description?: string;
}

