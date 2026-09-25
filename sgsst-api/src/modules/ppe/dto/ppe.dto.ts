import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreatePpeItemDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  type?: string;

  /** Norma tecnica / certificacion del EPP. */
  @IsOptional()
  @IsString()
  standard?: string;

  @IsOptional()
  @IsString()
  size?: string;

  /** Vida util en dias para programar la reposicion. */
  @IsOptional()
  @IsInt()
  @Min(1)
  usefulLifeDays?: number;

  /** Stock minimo para alertas de reposicion. */
  @IsOptional()
  @IsInt()
  @Min(0)
  stockMin?: number;

  /** Existencias iniciales. */
  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  @IsUUID()
  companyId!: string;
}

export class UpdatePpeItemDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  standard?: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  usefulLifeDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  stockMin?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreatePpeDeliveryDto {
  @IsUUID()
  itemId!: string;

  /** Trabajador que recibe el EPP (de la misma empresa). */
  @IsUUID()
  employeeId!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsDateString()
  deliveredAt?: string;

  @IsOptional()
  @IsString()
  signature?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsUUID()
  companyId!: string;
}
