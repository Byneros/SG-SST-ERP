import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

/** Periodo con formato libre pero sugerido: "2026", "2026-03", "2026-W12". */
export class UpsertIndicatorTargetDto {
  @IsString()
  period!: string;

  @IsNumber()
  target!: number;
}

/** Reemplaza todas las metas del indicador (o agrega/actualiza las enviadas). */
export class SetIndicatorTargetsDto {
  @IsArray()
  targets!: UpsertIndicatorTargetDto[];
}

export class UpsertIndicatorMeasurementDto {
  @IsString()
  period!: string;

  @IsNumber()
  value!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class AddIndicatorMeasurementsDto {
  @IsArray()
  measurements!: UpsertIndicatorMeasurementDto[];
}
