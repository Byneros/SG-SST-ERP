import { IsOptional, IsUUID } from 'class-validator';

export class SwitchActiveCompanyDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;
}
