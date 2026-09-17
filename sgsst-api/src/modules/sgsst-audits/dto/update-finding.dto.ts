import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateFindingDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(['MINOR', 'MAJOR', 'CRITICAL'])
  severity?: string;

  @IsOptional()
  @IsIn(['OPEN', 'IN_PROGRESS', 'CLOSED'])
  status?: string;
}
