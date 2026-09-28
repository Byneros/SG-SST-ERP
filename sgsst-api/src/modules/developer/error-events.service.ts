import { Injectable } from '@nestjs/common';

export type TechnicalErrorEvent = {
  /** Momento del evento (ISO 8601). */
  timestamp: string;
  /** Nivel del evento: solo error/warn llegan aqui. */
  level: 'error' | 'warn';
  /** Contexto del logger (clase/servicio que lo emitio). */
  context: string;
  /** Mensaje ya enmascarado por SensitiveDataLogger (sin secretos). */
  message: string;
  /** Stack truncado, ya enmascarado (opcional). */
  trace?: string;
  /** Id del request si el evento ocurrio durante una peticion HTTP. */
  requestId?: string;
};

const MAX_EVENTS = 200;
const MAX_MESSAGE_LENGTH = 2_000;
const MAX_TRACE_LENGTH = 4_000;

/**
 * Ring buffer en memoria de los ultimos eventos tecnicos (error/warn) de la
 * aplicacion. Se llena desde el logger global (main.ts ya instala
 * SensitiveDataLogger, que enmascara secretos antes de imprimir): aqui solo
 * se guarda lo ya enmascarado, por lo que el endpoint nunca expone secretos.
 *
 * Es deliberadamente un buffer en memoria (por proceso): diagnostico rapido,
 * sin persistencia ni PII de tenants. Reiniciar la app la limpia.
 */
@Injectable()
export class ErrorEventsService {
  private readonly events: TechnicalErrorEvent[] = [];

  /** Punto unico de captura: llamado por DeveloperLoggerService. */
  record(event: Omit<TechnicalErrorEvent, 'timestamp'> & { timestamp?: string }) {
    const trimmed: TechnicalErrorEvent = {
      timestamp: event.timestamp ?? new Date().toISOString(),
      level: event.level,
      context: this.truncate(event.context || 'app', 200),
      message: this.truncate(event.message || '(sin mensaje)', MAX_MESSAGE_LENGTH),
      trace: event.trace ? this.truncate(event.trace, MAX_TRACE_LENGTH) : undefined,
      requestId: event.requestId,
    };
    this.events.push(trimmed);
    if (this.events.length > MAX_EVENTS) {
      this.events.splice(0, this.events.length - MAX_EVENTS);
    }
  }

  /** Ultimos eventos, el mas reciente primero. */
  latest(limit = 100): TechnicalErrorEvent[] {
    return [...this.events]
      .reverse()
      .slice(0, Math.min(Math.max(limit, 1), MAX_EVENTS));
  }

  /** Total de eventos retenidos actualmente (para el resumen del panel). */
  count(): number {
    return this.events.length;
  }

  private truncate(value: string, maxLength: number) {
    return value.length > maxLength
      ? `${value.slice(0, maxLength)}…`
      : value;
  }
}
