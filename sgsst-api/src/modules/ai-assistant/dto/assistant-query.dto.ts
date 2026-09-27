import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

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
}
