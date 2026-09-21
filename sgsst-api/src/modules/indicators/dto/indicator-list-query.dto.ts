import { IsUUID } from 'class-validator';
import { ListQueryDto } from '../../../common/dto/list-query.dto';

/** El ValidationPipe global rechaza query params no declarados; aquí declaramos siteId. */
export class IndicatorListQueryDto extends ListQueryDto {
  /** Filtra por sede (UUID) o por "none" (sin sede asignada). */
  @IsUUID()
  siteId?: string;
}
