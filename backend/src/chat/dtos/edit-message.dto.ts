import { Type } from 'class-transformer';
import { IsInt, IsString, Length, Min } from 'class-validator';

export class EditMessageDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  roomId: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  messageId: number;

  @IsString()
  @Length(1, 4000)
  content: string;
}

