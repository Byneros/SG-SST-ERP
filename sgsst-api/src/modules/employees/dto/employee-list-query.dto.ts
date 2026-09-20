import { Type } from 'class-transformer';
import {
  IsOptional,
  IsUUID,
  ValidateIf,
} from 'class-validator';
import { ListQueryDto } from '../../../common/dto/list-query.dto';

/**
 * Listado de empleados: extiende la paginacion comun con el filtro por sede.
 * 'none' filtra los empleados sin sede asignada; cualquier otro valor debe
 * ser un UUID de sede del scope del actor (el service lo valida con 404).
 */
export class EmployeeListQueryDto extends ListQueryDto {
  @IsOptional()
  @ValidateIf((o) => o.siteId !== 'none')
  @IsUUID()
  @Type(() => String)
  siteId?: string;
}
