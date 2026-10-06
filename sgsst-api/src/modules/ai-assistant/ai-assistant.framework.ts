import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import type { AuditService } from '../audit/audit.service';

/**
 * Contratos del framework de asistentes (S16 extendido, Fase C).
 *
 * Diseno en docs/plan-s16-framework-asistentes.md (§2-§3). Reglas fijas:
 * - El companyId vive SOLO en ToolContext (resuelto con resolveCompanyScope
 *   en el orquestador): ninguna herramienta lo acepta del cliente.
 * - tools es una whitelist cerrada por asistente: fuera de ella => 403.
 * - Herramientas READ en esta fase; la escritura usara el flujo de
 *   confirmacion del §7 del plan (fase posterior).
 */

export type AssistantRole = 'SUPER_ADMIN' | 'ADMIN' | 'SST' | 'AUDITOR';

export type ToolParamType = 'string' | 'number' | 'boolean';

export interface ToolContext {
  /** Ya resuelto en backend; nunca proviene del cliente. */
  companyId: string;
  user: AuthenticatedUser;
  auditService: AuditService;
}

export interface AssistantToolDefinition {
  /** Nombre unico dentro del asistente (ej: 'critical_without_actions'). */
  name: string;
  description: string;
  kind: 'READ';
  /** Roles con acceso; si se omite hereda los del asistente. */
  allowedRoles?: AssistantRole[];
  /** Whitelist de asistentes que pueden invocarla (vacío = solo su dueño). */
  callableBy?: string[];
  run: (
    ctx: ToolContext,
    params: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
  /** Validacion simple de params antes de ejecutar (rechazo 400). */
  paramsSchema?: Record<string, ToolParamType>;
}

export interface AssistantDefinition {
  /** Identificador estable usado por el router y la auditoria. */
  id: string;
  name: string;
  /** Vista del ERP a la que sirve (hash routing de sgsst-web). */
  module: string;
  description: string;
  /** Se ANADE al system prompt base cuando el asistente esta activo. */
  systemPromptAddendum: string;
  /** Whitelist explicita e inalterable en runtime. */
  tools: AssistantToolDefinition[];
  /** Roles minimos; se evaluan ademas de ASSISTANT_ALLOWED_ROLES del guard. */
  allowedRoles: AssistantRole[];
  /** Disparadores del router por palabras clave. */
  keywords: string[];
  /** Asistentes consultables; los asistentes hoja no delegan. */
  delegateTo?: string[];
}

export function isAssistantRole(role: string): role is AssistantRole {
  return (
    role === 'SUPER_ADMIN' ||
    role === 'ADMIN' ||
    role === 'SST' ||
    role === 'AUDITOR'
  );
}

/** El usuario puede invocar el asistente (rol declarativo, sin codigo suelto). */
export function canUseAssistant(
  definition: AssistantDefinition,
  user: AuthenticatedUser,
): boolean {
  return (
    isAssistantRole(user.role) && definition.allowedRoles.includes(user.role)
  );
}

/** El asistente puede invocar la herramienta (whitelist por callableBy). */
export function canInvokeTool(
  definition: AssistantDefinition,
  tool: AssistantToolDefinition,
  user: AuthenticatedUser,
): boolean {
  if (!canUseAssistant(definition, user)) return false;
  const toolRoles = tool.allowedRoles ?? definition.allowedRoles;
  if (!toolRoles.includes(user.role as AssistantRole)) return false;
  if (tool.callableBy && !tool.callableBy.includes(definition.id)) {
    return false;
  }
  return true;
}

/** Validacion minima de params contra paramsSchema (400 si no cumple). */
export function validateToolParams(
  tool: AssistantToolDefinition,
  params: Record<string, unknown>,
): void {
  if (!tool.paramsSchema) return;
  for (const [key, expected] of Object.entries(tool.paramsSchema)) {
    const value = params[key];
    if (value === undefined) continue;
    if (expected === 'number' && typeof value !== 'number') {
      throw new TypeError(`Param ${key} must be a number`);
    }
    if (expected === 'boolean' && typeof value !== 'boolean') {
      throw new TypeError(`Param ${key} must be a boolean`);
    }
    if (expected === 'string' && typeof value !== 'string') {
      throw new TypeError(`Param ${key} must be a string`);
    }
  }
}
