import { ForbiddenException } from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import type { AuditService } from '../audit/audit.service';
import type { AssistantDefinition } from './ai-assistant.framework';
import type { AssistantRegistry } from './assistant-registry';
import type { AssistantQueryDto } from './dto/assistant-query.dto';

/**
 * Orquestador multi-asistente (Fase K, S16 extendido).
 *
 * Diseno en docs/plan-s16-framework-asistentes.md (§4):
 * - El ROUTER es determinista (keywords + score, sin LLM): auditable y
 *   reproducible. El LLM solo redacta la sintesis final.
 * - Tope de asistentes por consulta (MAX_ASSISTANTS) y de datos por
 *   herramienta ya garantizado por cada definicion.
 * - Si el usuario no tiene permiso para un asistente elegido, se omite y la
   respuesta lo declara (nunca filtra que la informacion existe).
 * - Cada herramienta ejecutada queda auditada por runTool -> AI_ASSISTANT_DATA_QUERY.
 */

const MAX_ASSISTANTS = 4;

interface RoutedTool {
  assistantId: string;
  assistantName: string;
  toolName: string;
  toolDescription: string;
}

export interface OrchestrationResult {
  content: string;
  usedTools: Array<{ assistant: string; tool: string }>;
  omitted: string[];
}

/** Normaliza texto: minusculas y sin acentos (comparaciones estables). */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Router determinista: elige asistentes por keywords y score.
 * Score = suma de coincidencias de keywords del asistente en el mensaje
 * (keywords mas largas pesan mas: match de frase > palabra).
 * Devuelve los asistentes permitidos para el rol, ordenados por score.
 */
export function routeAssistants(
  message: string,
  registry: AssistantRegistry,
  user: AuthenticatedUser,
): { chosen: AssistantDefinition[]; omitted: string[] } {
  const normalized = normalize(message);
  const scored: Array<{ assistant: AssistantDefinition; score: number }> = [];
  const omitted: string[] = [];

  for (const assistant of registry.all()) {
    if (assistant.id === 'central') continue;
    let score = 0;
    for (const keyword of assistant.keywords) {
      const needle = normalize(keyword);
      if (needle && normalized.includes(needle)) {
        score += needle.includes(' ') ? 3 : 1;
      }
    }
    if (score > 0) {
      const allowed = assistant.allowedRoles.includes(
        user.role as AssistantDefinition['allowedRoles'][number],
      );
      if (allowed) {
        scored.push({ assistant, score });
      } else {
        // Sin fuga: se declara la omision, no la existencia del modulo.
        omitted.push(assistant.id);
      }
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return {
    chosen: scored.slice(0, MAX_ASSISTANTS).map((entry) => entry.assistant),
    omitted,
  };
}

/**
 * Elige por asistente hasta 2 herramientas READ cuya descripcion/palabras
 * clave coincidan con el mensaje (determinista, sin LLM).
 */
export function selectTools(
  assistant: AssistantDefinition,
  message: string,
): string[] {
  const normalized = normalize(message);
  // Keywords del asistente presentes en el MENSAJE del usuario: solo esas
  // pueden puntuar herramientas (evita que la descripcion del tool siempre
  // coincida con sus propias keywords).
  const messageKeywords = assistant.keywords
    .map((keyword) => normalize(keyword))
    .filter((needle) => needle && normalized.includes(needle));
  const scored: Array<{ name: string; score: number }> = [];
  if (messageKeywords.length > 0) {
    for (const tool of assistant.tools) {
      const haystack = normalize(`${tool.name} ${tool.description}`);
      let score = 0;
      for (const needle of messageKeywords) {
        if (haystack.includes(needle)) {
          score += needle.includes(' ') ? 3 : 1;
        }
      }
      if (score > 0) scored.push({ name: tool.name, score });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  // Con coincidencias: hasta 2 por ranking. Sin coincidencias: solo la
  // primera (resumen general del modulo), sin inventar otras.
  if (scored.length === 0) {
    const first = assistant.tools[0]?.name;
    return first ? [first] : [];
  }
  const picked = scored
    .slice(0, 2)
    .map((entry) => entry.name)
    .filter((name): name is string => Boolean(name));
  return Array.from(new Set(picked));
}

/** Bloque de datos etiquetado por modulo para la sintesis final. */
function dataBlock(
  routed: Array<{ assistant: AssistantDefinition; data: unknown }>,
): string {
  return routed
    .map(
      (entry) =>
        `DATOS ${entry.assistant.module.toUpperCase()} (${entry.assistant.id}):\n${JSON.stringify(entry.data)}`,
    )
    .join('\n\n');
}

export class AiAssistantOrchestrator {
  constructor(private readonly registry: AssistantRegistry) {}

  /**
   * Ejecuta el flujo §4 del plan sobre el mensaje del usuario y devuelve los
   * datos etiquetados + instrucciones de sintesis para el proveedor LLM.
   * Lanza 503-acotable si ninguna herramienta produce datos (sin mensaje
   * conversacional: eso lo decide el service con su flujo de ayuda).
   */
  async orchestrate(
    user: AuthenticatedUser,
    dto: AssistantQueryDto,
    auditService: AuditService,
  ): Promise<
    | { kind: 'NO_MATCH' }
    | {
        kind: 'OK';
        routedTools: RoutedTool[];
        omitted: string[];
        dataPrompt: string;
        data: Array<{ assistantId: string; toolName: string; data: unknown }>;
      }
  > {
    const { chosen, omitted } = routeAssistants(
      dto.message,
      this.registry,
      user,
    );
    if (chosen.length === 0) {
      return { kind: 'NO_MATCH' };
    }

    const routed: Array<{
      assistant: AssistantDefinition;
      tool: AssistantDefinition['tools'][number];
      data: unknown;
    }> = [];
    const routedTools: RoutedTool[] = [];
    const data: Array<{
      assistantId: string;
      toolName: string;
      data: unknown;
    }> = [];

    for (const assistant of chosen) {
      const toolNames = selectTools(assistant, dto.message);
      for (const toolName of toolNames) {
        // runTool valida rol por asistente/herramienta, whitelist y params,
        // resuelve el companyId en backend y audita la consulta.
        const resolved = await this.registry.runTool(
          assistant.id,
          toolName,
          user,
          auditService,
        );
        routed.push({ assistant, tool: resolved.tool, data: resolved.data });
        routedTools.push({
          assistantId: assistant.id,
          assistantName: assistant.name,
          toolName,
          toolDescription: resolved.tool.description,
        });
        data.push({ assistantId: assistant.id, toolName, data: resolved.data });
      }
    }

    if (routed.length === 0) {
      throw new ForbiddenException('No tool was executed for this query');
    }

    const dataPrompt =
      `Eres el orquestador del asistente del ERP SG-SST. El usuario hizo una ` +
      `consulta que fue atendida por varios asistentes especializados. ` +
      `Responde en espanol, en un maximo de 12 lineas, integrando EXCLUSIVAMENTE ` +
      `los datos JSON siguientes, etiquetados por modulo. Cita el modulo de ` +
      `origen de cada cifra (ej: "segun datos de riesgos..."). Si un dato no ` +
      `viene en los JSON, di que no tienes esa informacion; nunca inventes ` +
      `cifras.\n${dataBlock(routed)}`;

    return { kind: 'OK', routedTools, omitted, dataPrompt, data };
  }
}
