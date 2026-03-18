import { IsString, Length } from 'class-validator';

export class DeleteRoomDto {
  @IsString()
  @Length(1, 60)
  confirmName: string;
}

