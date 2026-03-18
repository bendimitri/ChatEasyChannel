import { IsString, Length } from 'class-validator';

export class UpdateDisplayNameDto {
  @IsString()
  @Length(2, 30)
  displayName: string;
}

