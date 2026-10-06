import {
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class AssistantQueryDto {
  @IsString()
  @MaxLength(4000)
  message!: string;

  /** Identificador de conversacion del cliente (agrupacion de historial en UI). */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  conversationId?: string;

  /** Historial breve enviado por la UI para dar continuidad a la conversacion. */
  @IsOptional()
  @IsArray()
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;

  /** Fase C: asistente especializado solicitado (default: 'central'). */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  assistantId?: string;

  /** Fase C: herramienta del asistente (whitelist en el registro). */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  toolName?: string;

  /** Fase C: parametros de la herramienta, validados contra paramsSchema. */
  @IsOptional()
  @IsObject()
  toolParams?: Record<string, unknown>;
}
