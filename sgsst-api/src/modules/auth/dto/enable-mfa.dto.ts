import { IsString, Length } from 'class-validator';

export class EnableMfaDto {
  @IsString()
  @Length(6, 6)
  code!: string;
}
