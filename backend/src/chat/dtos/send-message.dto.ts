import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Min,
  ValidateIf,
} from 'class-validator';

export class SendMessageDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  roomId: number;

  @IsOptional()
  @IsIn(['text', 'image'])
  type?: 'text' | 'image';

  @ValidateIf((o) => (o.type || 'text') === 'text')
  @IsString()
  @Length(1, 4000)
  content?: string;

  @ValidateIf((o) => o.type === 'image')
  @IsString()
  @IsUrl({ require_protocol: true })
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  clientMessageId?: string;
}

