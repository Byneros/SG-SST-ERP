import { Type } from 'class-transformer';
import {
  IsOptional,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { ListQueryDto } from '../../../common/dto/list-query.dto';

/**
 * Listado de documentos: extiende la paginacion comun con el filtro por sede.
 * 'none' filtra los documentos sin sede; cualquier otro valor debe ser un
 * UUID de sede del scope del actor (el service lo valida con 404).
 */
export class DocumentListQueryDto extends ListQueryDto {
  @IsOptional()
  @ValidateIf((o) => o.siteId !== 'none')
  @IsUUID()
  @Type(() => String)
  siteId?: string;
}
