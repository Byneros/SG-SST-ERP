import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { ListQueryDto } from '../../../common/dto/list-query.dto';

export class CompanyLegalRequirementsQueryDto extends ListQueryDto {
  @IsOptional()
  @IsIn(['PENDING', 'COMPLIES', 'PARTIAL', 'NON_COMPLIANT', 'NOT_APPLICABLE'])
  status?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === undefined ? undefined : value === true || value === 'true',
  )
  @IsBoolean()
  applies?: boolean;
}
