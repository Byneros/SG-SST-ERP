import {
  ArrayMaxSize,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateTrainingAttendeeDto } from './training-attendee.dto';

export class CreateTrainingDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  date!: string;

  @IsOptional()
  @IsUUID()
  companyId?: string;

  /** Sede donde se realiza la capacitacion (opcional, de la misma empresa). */
  @IsOptional()
  @IsUUID()
  siteId?: string;

  /** Instructor/facilitador de la capacitación (#58). */
  @IsOptional()
  @IsString()
  @MaxLength(160)
  instructor?: string;

  /** Meses de vigencia del certificado; deriva el vencimiento por asistente. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(120)
  validityMonths?: number;

  /** Asistentes de alta inline (#58); también se pueden gestionar por endpoint. */
  @IsOptional()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CreateTrainingAttendeeDto)
  attendees?: CreateTrainingAttendeeDto[];
}
