import {
  BadRequestException,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import { env } from '../../config/env';
import { AuditService } from '../audit/audit.service';
import {
  buildHelpContext,
  findNormSources,
  HELP_TOPICS,
} from './ai-assistant.knowledge';
import { AiProviderClient } from './ai-provider.client';
import { AssistantRegistry } from './assistant-registry';
import {
  ASSISTANT_ALLOWED_ROLES,
  ASSISTANT_CAPABILITIES,
  AssistantResult,
} from './ai-assistant.types';
import { AssistantToolName, AiAssistantTools } from './ai-assistant.tools';
import { AssistantQueryDto } from './dto/assistant-query.dto';

const TOOL_TRIGGER_PREFIX = '@datos';

/**
 * Servicio del asistente inteligente (Sprint 16, fase 1).
 *
 * - Respuestas de ayuda sobre el ERP con el contexto de capabilities.
 * - Consulta de datos SOLO via AiAssistantTools (herramientas autorizadas
 *   con resolveCompanyScope). El modelo nunca genera SQL ni recibe datos
 *   de otras empresas.
 * - Cada consulta con datos queda en AuditLog (trazabilidad).
 * - Si el proveedor falla, se lanza 503 acotado: el ERP sigue funcionando.
 */
@Injectable()
export class AiAssistantService {
  private readonly logger = new Logger(AiAssistantService.name);

  constructor(
    private readonly providerClient: AiProviderClient,
    private readonly tools: AiAssistantTools,
    private readonly auditService: AuditService,
    // Fase C: registro de asistentes. Opcional para no romper los tests que
    // construyen el servicio a mano; el modulo siempre lo provee.
    @Optional() private readonly registry?: AssistantRegistry,
  ) {}

  async ask(
    user: AuthenticatedUser,
    dto: AssistantQueryDto,
  ): Promise<AssistantResult> {
    const message = dto.message.trim();
    if (!message) {
      throw new BadRequestException('Message is required');
    }

    // Fase 1: consulta de datos explicita con @datos <herramienta|modulo>.
    if (message.startsWith(TOOL_TRIGGER_PREFIX)) {
      return this.runDataTool(user, message, dto);
    }

    // Ayuda conversacional estandar, con contexto curado del modulo preguntado
    // (tarea 16.4) y fuentes normativas verificadas (tarea 16.5). El contexto
    // es de solo lectura y sin datos de tenant.
    const result = await this.providerClient.complete({
      systemPrompt: this.buildSystemPrompt(message),
      messages: this.buildMessages(dto),
    });
    const sources = findNormSources(message)
      .filter((norm) => norm.status === 'vigente')
      .map((norm) => norm.name);
    return sources.length > 0 ? { ...result, sources } : result;
  }

  capabilities(user?: AuthenticatedUser) {
    // Fase C: asistentes del registro. Con usuario se filtran por rol; sin
    // usuario (compatibilidad con tests) se listan todos con sus roles.
    const assistants = this.registry
      ? (user ? this.registry.forRole(user.role) : this.registry.all()).map(
          (assistant) => ({
            id: assistant.id,
            name: assistant.name,
            module: assistant.module,
            description: assistant.description,
            ...(user ? {} : { allowedRoles: assistant.allowedRoles }),
          }),
        )
      : [];
    return {
      enabled: env.aiEnabled && Boolean(env.aiApiKey),
      roles: ASSISTANT_ALLOWED_ROLES,
      dataTools: this.toolsList(),
      assistants,
      helpTopics: HELP_TOPICS.map((topic) => topic.title),
      capabilities: ASSISTANT_CAPABILITIES,
      limits: {
        maxMessageLength: 4000,
        historyMessages: env.aiHistoryMaxMessages,
        timeoutMs: env.aiRequestTimeoutMs,
      },
    };
  }

  /** Ejecuta una herramienta del asistente indicado (framework Fase C).
   *
   * Ruta nueva para assistantId != 'central' o params; para compatibilidad
   * total con la fase 1, 'central' sin params delega en el mismo flujo de
   * runDataTool (mismas auditoria y formato de respuesta).
   */
  async askAssistant(
    user: AuthenticatedUser,
    dto: AssistantQueryDto,
  ): Promise<AssistantResult> {
    const assistantId = dto.assistantId?.trim() || 'central';
    if (!this.registry) {
      // Sin registry (tests a mano): degradar al flujo clasico.
      return this.ask(user, dto);
    }
    const assistant = this.registry.get(assistantId);
    if (!assistant) {
      throw new BadRequestException(`Unknown assistant: ${assistantId}`);
    }
    if (assistantId === 'central' && !dto.toolName) {
      // Compatibilidad: el central mantiene el comportamiento de la fase 1.
      return this.ask(user, dto);
    }

    const toolName = dto.toolName;
    if (!toolName) {
      throw new BadRequestException(
        `toolName is required for assistant ${assistantId}. ` +
          `Available: ${assistant.tools.map((tool) => tool.name).join(', ')}`,
      );
    }

    const { tool, data } = await this.registry.runTool(
      assistantId,
      toolName,
      user,
      this.auditService,
      dto.toolParams ?? {},
    );

    await this.auditService.log({
      user,
      action: 'AI_ASSISTANT_DATA_QUERY',
      entity: 'AiAssistant',
      entityId: `${assistantId}:${tool.name}`,
    });

    const result = await this.providerClient.complete({
      systemPrompt:
        `${this.buildSystemPrompt('')}\n\n${assistant.systemPromptAddendum}\n\n` +
        `Eres el asistente "${assistant.name}". El usuario consulto la ` +
        `herramienta autorizada "${tool.name}" (${tool.description}). ` +
        `Responde en espanol, en un maximo de 8 lineas, usando EXCLUSIVAMENTE ` +
        `los datos JSON siguientes. Si un dato no viene en el JSON, di que no ` +
        `tienes esa informacion; nunca inventes cifras.\n` +
        `DATOS:\n${JSON.stringify(data)}`,
      messages: this.buildMessages(dto),
    });
    return {
      ...result,
      usedTool: `${assistantId}:${tool.name}`,
      sources: undefined,
    };
  }

  private async runDataTool(
    user: AuthenticatedUser,
    message: string,
    dto: AssistantQueryDto,
  ) {
    const requested = message
      .slice(TOOL_TRIGGER_PREFIX.length)
      .trim()
      .toLowerCase();

    const tool = this.matchTool(requested);
    if (!tool) {
      return {
        content:
          `No reconozco esa consulta de datos. Herramientas disponibles: ` +
          `${this.toolsList().join(', ')}. ` +
          `Ejemplo: "@datos resumen de riesgos".`,
      };
    }

    // Trazabilidad: quien consulto datos asistidos y cuando.
    await this.auditService.log({
      user,
      action: 'AI_ASSISTANT_DATA_QUERY',
      entity: 'AiAssistant',
      entityId: tool,
    });

    const data = await this.tools.run(tool, user);

    // El modelo solo recibe datos YA filtrados por empresa.
    const result = await this.providerClient.complete({
      systemPrompt:
        `${this.buildSystemPrompt('')}\n\n` +
        `El usuario consulto la herramienta autorizada "${tool}". ` +
        `Responde en espanol, en un maximo de 8 lineas, usando EXCLUSIVAMENTE ` +
        `los datos JSON siguientes. Si un dato no viene en el JSON, di que no ` +
        `tienes esa informacion; nunca inventes cifras.\n` +
        `DATOS:\n${JSON.stringify(data)}`,
      messages: this.buildMessages(dto),
    });
    return { ...result, usedTool: tool, sources: undefined };
  }

  private matchTool(requested: string): AssistantToolName | null {
    const normalized = requested
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    if (/(empresa|company)/.test(normalized)) return 'company_summary';
    if (/(sede|site)/.test(normalized)) return 'sites_summary';
    if (/(empleado|employee|trabajador)/.test(normalized))
      return 'employees_summary';
    if (/(riesgo|risk|gtc)/.test(normalized)) return 'risks_summary';
    if (/(incidente|accidente|incident)/.test(normalized))
      return 'incidents_summary';
    if (/(capacitacion|training|curso)/.test(normalized))
      return 'trainings_summary';
    return null;
  }

  private toolsList(): string[] {
    return [
      'company_summary',
      'sites_summary',
      'employees_summary',
      'risks_summary',
      'incidents_summary',
      'trainings_summary',
    ];
  } /**
   * Prompt de sistema (tarea 16.4): reglas fijas + contexto curado del modulo
   * preguntado. El contexto se elige por palabras clave sobre el mensaje.
   */
  private buildSystemPrompt(message: string): string {
    return (
      'Eres el asistente del ERP SG-SST para gestion de seguridad y salud en ' +
      'el trabajo en Colombia. Ayudas a los usuarios a usar los modulos del ' +
      'sistema. ' +
      'Reglas: (1) responde en espanol, breve y accionable; ' +
      '(2) si no sabes algo o el modulo no existe, dilo claramente y no ' +
      'inventes funcionalidades ni datos; (3) no entregues instrucciones de ' +
      'diagnostico medico ni interpretes resultados de examenes; ' +
      '(4) cuando hagas afirmaciones normativas nombralas como fuente y ' +
      'distingue norma de recomendacion; (5) nunca reveles datos de otras ' +
      'empresas; (6) usa solo los modulos y normas del contexto entregado, ' +
      'sin inventar menus ni rutas.\n\n' +
      buildHelpContext(message)
    );
  }

  private buildMessages(dto: AssistantQueryDto) {
    const history = (dto.history ?? [])
      .filter(
        (item) =>
          (item.role === 'user' || item.role === 'assistant') &&
          typeof item.content === 'string' &&
          item.content.trim().length > 0,
      )
      .slice(-env.aiHistoryMaxMessages)
      .map((item) => ({
        role: item.role,
        content: item.content.slice(0, 2000),
      }));

    return [...history, { role: 'user' as const, content: dto.message.trim() }];
  }
}
