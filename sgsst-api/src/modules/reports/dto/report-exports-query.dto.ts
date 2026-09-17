import { IsDateString, IsIn, IsOptional, IsUUID } from 'class-validator';
import { ListQueryDto } from '../../../common/dto/list-query.dto';

export class ReportExportsQueryDto extends ListQueryDto {
  @IsOptional()
  @IsIn(['QUEUED', 'PROCESSING', 'READY', 'FAILED', 'EXPIRED'])
  status?: string;

  @IsOptional()
  @IsUUID()
  requestedById?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
