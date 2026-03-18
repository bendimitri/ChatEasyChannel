import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class DeleteMessageDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  roomId: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  messageId: number;
}

