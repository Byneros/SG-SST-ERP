import { ConsoleLogger, LoggerService } from '@nestjs/common';
import { redactSensitive } from '../utils/sanitize';

/**
 * Logger global de la app: delega en el ConsoleLogger por defecto de Nest
 * (mismo formato y niveles) pero redacta datos sensibles de cada mensaje
 * antes de imprimirlo. Cero dependencias nuevas.
 */
export class SensitiveDataLogger
  extends ConsoleLogger
  implements LoggerService
{
  override log(message: unknown, context?: string): void {
    super.log(redactSensitive(message), context);
  }

  override error(message: unknown, trace?: string, context?: string): void {
    super.error(
      redactSensitive(message),
      redactSensitive(trace ?? ''),
      context,
    );
  }

  override warn(message: unknown, context?: string): void {
    super.warn(redactSensitive(message), context);
  }

  override debug(message: unknown, context?: string): void {
    super.debug(redactSensitive(message), context);
  }

  override verbose(message: unknown, context?: string): void {
    super.verbose(redactSensitive(message), context);
  }
}
