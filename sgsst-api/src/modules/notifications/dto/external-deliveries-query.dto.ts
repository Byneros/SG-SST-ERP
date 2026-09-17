import { IsIn, IsOptional } from 'class-validator';
import { ListQueryDto } from '../../../common/dto/list-query.dto';

export class ExternalDeliveriesQueryDto extends ListQueryDto {
  @IsOptional()
  @IsIn(['WHATSAPP', 'EMAIL', 'TEAMS', 'SLACK'])
  provider?: string;

  @IsOptional()
  @IsIn(['PENDING', 'SENT', 'FAILED', 'SKIPPED'])
  status?: string;
}
