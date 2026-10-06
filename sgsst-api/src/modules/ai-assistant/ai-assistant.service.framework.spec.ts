import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AiAssistantService } from './ai-assistant.service';
import { AssistantRegistry } from './assistant-registry';
import { AiAssistantTools } from './ai-assistant.tools';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';
import type { AuditService } from '../audit/audit.service';
import { AssistantQueryDto } from './dto/assistant-query.dto';

type ProviderCall = {
  systemPrompt: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
};

const providerClient = {
  complete: jest.fn<Promise<{ content: string }>, [ProviderCall]>(),
};

/**
 * Pruebas del servicio integrado con el framework (Fase C).
 *
 * - askAssistant con assistantId/toolName pasa por el registro (whitelist).
 * - Sin registry (construccion a mano, como los tests de la fase 1) el
 *   servicio clasico sigue funcionando identico.
 */
describe('AiAssistantService (framework Fase C)', () => {
  const tools = { run: jest.fn() };
  const auditService = { log: jest.fn().mockResolvedValue(undefined) };
  const legacyTools = { run: jest.fn().mockResolvedValue({ total: 7 }) };
  let registry: AssistantRegistry;
  let service: AiAssistantService;

  const admin: AuthenticatedUser = {
    sub: 'admin-a',
    email: 'admin-a@test.com',
    role: 'ADMIN',
    companyId: 'company-a',
  };

  function dto(data: Partial<AssistantQueryDto>) {
    return Object.assign(new AssistantQueryDto(), data);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    providerClient.complete.mockResolvedValue({ content: 'respuesta' });
    registry = new AssistantRegistry(
      legacyTools as unknown as AiAssistantTools,
    );
    service = new AiAssistantService(
      providerClient,
      tools as never,
      auditService as unknown as AuditService,
      registry,
    );
  });

  it('askAssistant con toolName delega en el registro y audita assistant:tool', async () => {
    const result = await service.askAssistant(
      admin,
      dto({
        message: 'riesgos',
        assistantId: 'central',
        toolName: 'risks_summary',
      }),
    );

    expect(legacyTools.run).toHaveBeenCalledWith('risks_summary', admin);
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'AI_ASSISTANT_DATA_QUERY',
        entityId: 'central:risks_summary',
      }),
    );
    expect(result.usedTool).toBe('central:risks_summary');
    const call = providerClient.complete.mock.calls[0][0];
    expect(call.systemPrompt).toContain('Asistente IA del ERP');
    expect(call.systemPrompt).toContain('EXCLUSIVAMENTE');
  });

  it('askAssistant rechaza 400 una herramienta fuera de la whitelist del asistente', async () => {
    await expect(
      service.askAssistant(
        admin,
        dto({ message: 'x', assistantId: 'central', toolName: 'no_existe' }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(providerClient.complete).not.toHaveBeenCalled();
  });

  it('askAssistant rechaza 400 un asistente desconocido', async () => {
    await expect(
      service.askAssistant(
        admin,
        dto({
          message: 'x',
          assistantId: 'fantasma',
          toolName: 'risks_summary',
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('askAssistant exige toolName para asistentes no-centrales', async () => {
    // Stub de asistente especializado (las fases E+ anadiran definiciones reales).
    registry.all().push({
      id: 'risks',
      name: 'Asistente de Riesgos',
      module: 'risks',
      description: 'stub',
      systemPromptAddendum: '',
      allowedRoles: ['ADMIN'],
      keywords: [],
      tools: [
        {
          name: 'matrix_summary',
          description: 'stub',
          kind: 'READ',
          run: () => Promise.resolve({}),
        },
      ],
    });

    await expect(
      service.askAssistant(admin, dto({ message: 'x', assistantId: 'risks' })),
    ).rejects.toThrow('toolName is required');
  });

  it('central sin toolName conserva el flujo clasico de la fase 1 (@datos incluido)', async () => {
    tools.run.mockResolvedValue({ total: 3 });
    const result = await service.askAssistant(
      admin,
      dto({ message: '@datos resumen de riesgos' }),
    );
    expect(tools.run).toHaveBeenCalledWith('risks_summary', admin);
    expect(result.usedTool).toBe('risks_summary');
  });

  it('capabilities lista los asistentes del registro con usuario', () => {
    const capabilities = service.capabilities(admin);
    expect(capabilities.assistants).toEqual([
      expect.objectContaining({ id: 'central', module: 'dashboard' }),
    ]);
  });

  it('capabilities sin usuario incluye allowedRoles (compatibilidad)', () => {
    const capabilities = service.capabilities();
    expect(capabilities.assistants[0]).toHaveProperty('allowedRoles');
  });

  it('sin registry el servicio clasico no se rompe (construccion a mano de tests antiguos)', async () => {
    const bare = new AiAssistantService(
      providerClient,
      tools as never,
      auditService as unknown as AuditService,
    );
    const result = await bare.ask(admin, dto({ message: 'hola' }));
    expect(result.content).toBe('respuesta');
    expect(bare.capabilities().assistants).toEqual([]);
  });
});
