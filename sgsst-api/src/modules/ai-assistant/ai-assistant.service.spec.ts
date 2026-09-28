import { BadRequestException } from '@nestjs/common';
import { env } from '../../config/env';
import { AssistantQueryDto } from './dto/assistant-query.dto';
import { AiAssistantService } from './ai-assistant.service';
import type { AssistantResult } from './ai-assistant.types';
import type { AuthenticatedUser } from '../../common/types/authenticated-request';

/**
 * Pruebas unitarias del asistente (Sprint 16, tarea 16.6).
 *
 * - El enrutamiento @datos -> herramientas autorizadas, con auditoria.
 * - Anti-alucinacion: el modelo solo recibe datos ya filtrados por empresa.
 * - Historial saneado (roles validos, recorte al limite configurado).
 * - Capabilities refleja el estado real de configuracion.
 */
describe('AiAssistantService', () => {
  type CompleteParams = {
    systemPrompt: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  };
  const providerClient = {
    complete: jest.fn<Promise<AssistantResult>, [CompleteParams]>(),
  };
  const tools = { run: jest.fn() };
  const auditService = { log: jest.fn() };
  let service: AiAssistantService;

  const admin: AuthenticatedUser = {
    sub: 'admin-a',
    email: 'admin-a@test.com',
    role: 'ADMIN',
    companyId: 'company-a',
  };

  beforeAll(() => {
    // Proveedor "configurado" para las pruebas de enrutamiento.
    env.aiEnabled = true;
    env.aiApiKey = 'test-key';
    env.aiBaseUrl = 'http://provider.test/v1';
    env.aiHistoryMaxMessages = 8;
  });

  afterAll(() => {
    // Restaurar estado por defecto (asistente deshabilitado en tests).
    env.aiEnabled = false;
    env.aiApiKey = '';
    env.aiBaseUrl = '';
    env.aiHistoryMaxMessages = 8;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AiAssistantService(
      providerClient,
      tools as never,
      auditService as never,
    );
  });

  function dto(data: Partial<AssistantQueryDto>) {
    return Object.assign(new AssistantQueryDto(), data);
  }

  it('rechaza mensajes vacios con 400 sin llamar al proveedor', async () => {
    await expect(
      service.ask(admin, dto({ message: '   ' })),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(providerClient.complete).not.toHaveBeenCalled();
  });

  it('pasa el mensaje al proveedor con prompt anti-alucinacion y contexto curado (16.4)', async () => {
    providerClient.complete.mockResolvedValue({ content: 'respuesta' });

    const result = await service.ask(
      admin,
      dto({ message: 'como creo un riesgo?' }),
    );

    expect(result).toEqual({ content: 'respuesta' });
    const call = providerClient.complete.mock.calls[0][0];
    // Contexto del modulo recuperado por keywords + normas citables.
    expect(call.systemPrompt).toContain('Riesgos y matriz de peligros');
    expect(call.systemPrompt).toContain('Decreto 1072');
    expect(call.systemPrompt).toContain(
      'no cites normas que no esten en esta lista',
    );
    expect(call.messages).toEqual([
      { role: 'user', content: 'como creo un riesgo?' },
    ]);
    expect(tools.run).not.toHaveBeenCalled();
    expect(auditService.log).not.toHaveBeenCalled();
  });

  it('respuestas normativas citan solo fuentes vigentes verificadas (16.5)', async () => {
    providerClient.complete.mockResolvedValue({ content: 'respuesta' });

    const result = await service.ask(
      admin,
      dto({ message: 'que norma regula el plan anual de trabajo?' }),
    );

    // El indice verifica vigencia: la 2346 derogada nunca aparece.
    expect(result.sources).toContain('Decreto 1072 de 2015');
    expect(result.sources).not.toContain('Resolucion 2346 de 2007');

    // Con contexto de examen ocupacional, la fuente vigente es la 1843 de 2025.
    const examenes = await service.ask(
      admin,
      dto({ message: 'cada cuando me toca el examen ocupacional?' }),
    );
    expect(examenes.sources).toContain('Resolucion 1843 de 2025');
    expect(examenes.sources).not.toContain('Resolucion 2346 de 2007');
  });

  it('no devuelve sources cuando la consulta no es normativa', async () => {
    providerClient.complete.mockResolvedValue({ content: 'respuesta' });

    const result = await service.ask(
      admin,
      dto({ message: 'como cambio mi contrasena?' }),
    );

    expect(result.sources).toBeUndefined();
  });

  it('no inyecta modulos no implementados del ERP en el contexto', async () => {
    providerClient.complete.mockResolvedValue({ content: 'respuesta' });

    await service.ask(
      admin,
      dto({ message: 'como configuro el plan de emergencias?' }),
    );

    const call = providerClient.complete.mock.calls[0][0];
    expect(call.systemPrompt).not.toContain('emergencias.');
    expect(call.systemPrompt).toContain(
      'el sistema no cuenta con esa funcionalidad hoy',
    );
  });

  it('@datos enruta a la herramienta, audita y entrega solo JSON ya filtrado por empresa', async () => {
    tools.run.mockResolvedValue({ total: 3, byLevel: { MEDIUM: 3 } });

    const result = await service.ask(
      admin,
      dto({ message: '@datos resumen de riesgos' }),
    );

    expect(tools.run).toHaveBeenCalledWith('risks_summary', admin);
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'AI_ASSISTANT_DATA_QUERY',
        entity: 'AiAssistant',
        entityId: 'risks_summary',
      }),
    );
    // El modelo solo puede usar el JSON entregado (datos del tenant del actor).
    const call = providerClient.complete.mock.calls[0][0];
    expect(call.systemPrompt).toContain('EXCLUSIVAMENTE');
    expect(call.systemPrompt).toContain('"total":3');
    expect(result.usedTool).toBe('risks_summary');
  });

  it('@datos con herramienta desconocida responde orientacion sin llamar al proveedor ni auditar', async () => {
    const result = await service.ask(
      admin,
      dto({ message: '@datos como esta el clima' }),
    );

    expect(result.content).toContain('Herramientas disponibles');
    expect(tools.run).not.toHaveBeenCalled();
    expect(providerClient.complete).not.toHaveBeenCalled();
    expect(auditService.log).not.toHaveBeenCalled();
  });

  it.each([
    ['@datos empresa', 'company_summary'],
    ['@datos sedes', 'sites_summary'],
    ['@datos empleados', 'employees_summary'],
    ['@datos capacitación', 'trainings_summary'],
    ['@datos incidentes', 'incidents_summary'],
  ])(
    'matchTool resuelve sinonimos y acentos: "%s" -> %s',
    async (message, expected) => {
      tools.run.mockResolvedValue({ total: 0 });

      const result = await service.ask(admin, dto({ message }));

      expect(tools.run).toHaveBeenCalledWith(expected, admin);
      expect(result.usedTool).toBe(expected);
    },
  );

  it('sanea el historial: roles invalidos y vacios se descartan y se recorta al limite', async () => {
    env.aiHistoryMaxMessages = 2;
    try {
      providerClient.complete.mockResolvedValue({ content: 'ok' });

      await service.ask(
        admin,
        dto({
          message: 'hola',
          history: [
            { role: 'system', content: 'inyeccion' },
            { role: 'user', content: 'a' },
            { role: 'assistant', content: 'b' },
            { role: 'assistant', content: '   ' },
          ] as never,
        }),
      );

      const call = providerClient.complete.mock.calls[0][0];
      expect(call.messages).toEqual([
        { role: 'user', content: 'a' },
        { role: 'assistant', content: 'b' },
        { role: 'user', content: 'hola' },
      ]);
    } finally {
      env.aiHistoryMaxMessages = 8;
    }
  });

  it('recorta cada mensaje del historial a 2000 caracteres', async () => {
    providerClient.complete.mockResolvedValue({ content: 'ok' });

    await service.ask(
      admin,
      dto({
        message: 'hola',
        history: [{ role: 'user', content: 'x'.repeat(3000) }],
      }),
    );

    const call = providerClient.complete.mock.calls[0][0];
    expect(call.messages[0].content).toHaveLength(2000);
  });

  it('capabilities refleja la configuracion real y las herramientas habilitadas', () => {
    const capabilities = service.capabilities();

    expect(capabilities.enabled).toBe(true);
    expect(capabilities.roles).toContain('ADMIN');
    expect(capabilities.roles).not.toContain('EMPLOYEE');
    expect(capabilities.dataTools).toContain('risks_summary');
    expect(Array.isArray(capabilities.helpTopics)).toBe(true);
    expect(capabilities.helpTopics.length).toBeGreaterThanOrEqual(12);
    expect(capabilities.limits.maxMessageLength).toBe(4000);
  });
});
