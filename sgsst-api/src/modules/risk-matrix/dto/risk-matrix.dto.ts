import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** Matriz GTC-45 estructurada (#57): DTOs por nivel de la jerarquía.
 *  El alcance multi-tenant lo resuelve el servicio por la cadena de padres;
 *  solo el proceso exige companyId (patrón de los demás módulos). */

const HAZARD_TYPES = [
  'FISICO',
  'QUIMICO',
  'BIOLOGICO',
  'BIOMECANICO',
  'PSICOSOCIAL',
  'LOCATIVO',
  'TECNOLOGICO',
  'FENOMENOS_NATURALES',
] as const;

const CONTROL_SOURCES = [
  'ADMINISTRATIVO',
  'OPERACIONAL',
  'COMPORTAMIENTO',
  'EPP',
] as const;

export class CreateRiskProcessDto {
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;

  @IsUUID()
  companyId!: string;
}

export class UpdateRiskProcessDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;
}

export class CreateRiskActivityDto {
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;
}

export class UpdateRiskActivityDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(160)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string | null;
}

export class CreateRiskHazardDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  name!: string;

  /** Numeral 3 de la GTC-45: clasificación del peligro. */
  @IsIn(HAZARD_TYPES)
  hazardType!: (typeof HAZARD_TYPES)[number];
}

export class UpdateRiskHazardDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsIn(HAZARD_TYPES)
  hazardType?: (typeof HAZARD_TYPES)[number];
}

/** Valoración GTC-45: probabilidad × severidad (matriz 5x5); el nivel I–IV
 *  se deriva en el servicio, el cliente no lo envía. */
export class UpsertValoracionDto {
  @IsInt()
  @Min(1)
  @Max(5)
  probability!: number;

  @IsInt()
  @Min(1)
  @Max(5)
  severity!: number;
}

/** Numeral 5 de la GTC-45: controles existentes por fuente. */
export class CreateHazardControlDto {
  @IsIn(CONTROL_SOURCES)
  source!: (typeof CONTROL_SOURCES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  type?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  effectiveness?: string | null;
}

export class UpdateHazardControlDto {
  @IsOptional()
  @IsIn(CONTROL_SOURCES)
  source?: (typeof CONTROL_SOURCES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(200)
  type?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  effectiveness?: string | null;
}

/** Riesgo (resultado final) desde el peligro: el nivel se toma de la
 *  valoración vigente; sin valoración el service rechaza (400). */
export class CreateLinkedRiskDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @IsUUID()
  siteId?: string | null;
}
