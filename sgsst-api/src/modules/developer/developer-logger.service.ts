import { ConsoleLogger, LoggerService } from '@nestjs/common';
import { redactSensitive } from '../../common/utils/sanitize';
import { ErrorEventsService } from './error-events.service';

/**
 * Logger global de la app. Extiende el comportamiento de
 * SensitiveDataLogger (mismo enmascaramiento, mismo formato) y ademas
 * alimenta el ring buffer de eventos tecnicos con cada error/warn,
 * de modo que el panel de desarrollador refleja errores REALES de la
 * aplicacion, ya enmascarados (sin secretos ni datos de tenants).
 *
 * El log/warn/debug no se tocan aparte de delegar: solo error y warn
 * interesan al buffer.
 */
export class DeveloperLoggerService
  extends ConsoleLogger
  implements LoggerService
{
  constructor(private readonly errorEvents: ErrorEventsService) {
    super();
  }

  override log(message: unknown, context?: string): void {
    super.log(this.mask(message), context);
  }

  override error(message: unknown, trace?: string, context?: string): void {
    const maskedMessage = this.mask(message);
    const maskedTrace = trace ? this.mask(trace) : undefined;
    this.errorEvents.record({
      level: 'error',
      context: context ?? 'app',
      message: maskedMessage,
      trace: maskedTrace,
    });
    super.error(maskedMessage, maskedTrace, context);
  }

  override warn(message: unknown, context?: string): void {
    const maskedMessage = this.mask(message);
    this.errorEvents.record({
      level: 'warn',
      context: context ?? 'app',
      message: maskedMessage,
    });
    super.warn(maskedMessage, context);
  }

  override debug(message: unknown, context?: string): void {
    super.debug(this.mask(message), context);
  }

  override verbose(message: unknown, context?: string): void {
    super.verbose(this.mask(message), context);
  }

  private mask(value: unknown): string {
    try {
      const masked = redactSensitive(value);
      if (typeof masked === 'string') return masked;
      if (masked instanceof Error) return masked.message;
      return JSON.stringify(masked);
    } catch {
      return String(value);
    }
  }
}
