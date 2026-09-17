import { IsIn, IsOptional, IsString } from 'class-validator';

export class CreateFindingDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['MINOR', 'MAJOR', 'CRITICAL'])
  severity?: string;
}
