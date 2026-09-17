import { IsIn, IsOptional, IsUUID } from 'class-validator';
import { ListQueryDto } from '../../../common/dto/list-query.dto';

export class LegalRequirementsQueryDto extends ListQueryDto {
  @IsOptional()
  @IsUUID()
  normId?: string;

  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  riskLevel?: string;

  @IsOptional()
  @IsIn(['ONCE', 'ANNUAL', 'SEMIANNUAL', 'QUARTERLY', 'MONTHLY', 'EVENT_BASED', 'CONTINUOUS'])
  frequency?: string;
}
