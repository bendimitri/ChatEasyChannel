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
  @Length(1, 500)
  // require_tld: false — senão http://localhost:3000/... e IPs locais falham na validação
  // e o gateway não emite newMessage (cliente fica em "Enviando..." até timeout).
  @IsUrl({
    require_protocol: true,
    require_tld: false,
    allow_underscores: true,
  })
  imageUrl?: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  clientMessageId?: string;
}

