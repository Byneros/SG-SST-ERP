import { Type } from 'class-transformer';
import { IsOptional, IsUUID, ValidateIf } from 'class-validator';
import { ListQueryDto } from '../../../common/dto/list-query.dto';

/**
 * Listado de incidentes: extiende la paginacion comun con el filtro por sede.
 * 'none' filtra los incidentes sin sede asignada; cualquier otro valor debe
 * ser un UUID de sede del scope del actor (el service lo valida con 404).
 */
export class IncidentListQueryDto extends ListQueryDto {
  @IsOptional()
  @ValidateIf((o: { siteId?: string }) => o.siteId !== 'none')
  @IsUUID()
  @Type(() => String)
  siteId?: string;
}
