import { ServiceUnavailableException } from '@nestjs/common';
import { env } from '../../config/env';
import { AiProviderClient } from './ai-provider.client';

/**
 * Pruebas unitarias del cliente del proveedor de IA (Sprint 16, tarea 16.6).
 *
 * - Sin configuracion (AI_ENABLED/AI_API_KEY/AI_BASE_URL) responde 503 acotado:
 *   el ERP sigue funcionando aunque el asistente no este disponible.
 * - La API key viaja solo en el header Authorization del backend.
 * - Errores HTTP, respuestas vacias, errores de red y timeout degradan a 503.
 */
describe('AiProviderClient', () => {
  const client = new AiProviderClient();
  const fetchMock = jest.fn();

  beforeAll(() => {
    env.aiEnabled = true;
    env.aiApiKey = 'test-key';
    env.aiBaseUrl = 'http://provider.test/v1';
    env.aiRequestTimeoutMs = 5000;
  });

  afterAll(() => {
    env.aiEnabled = false;
    env.aiApiKey = '';
    env.aiBaseUrl = '';
    env.aiRequestTimeoutMs = 20_000;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = fetchMock as never;
  });

  const params = {
    systemPrompt: 'system',
    messages: [{ role: 'user' as const, content: 'hola' }],
  };

  function okResponse(content: string) {
    return {
      ok: true,
      status: 200,
      json: () => Promise.resolve({ choices: [{ message: { content } }] }),
    };
  }

  it('sin configuracion lanza 503 acotado sin llamar a la red', async () => {
    const previous = { enabled: env.aiEnabled, key: env.aiApiKey };
    env.aiEnabled = false;
    env.aiApiKey = '';
    try {
      await expect(client.complete(params)).rejects.toThrow(
        'AI assistant is not configured',
      );
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      env.aiEnabled = previous.enabled;
      env.aiApiKey = previous.key;
    }
  });

  it('envia el sistema, el historial y la API key en el header (nunca en el cuerpo)', async () => {
    fetchMock.mockResolvedValue(okResponse('respuesta'));

    const result = await client.complete({
      ...params,
      temperature: 0.5,
      maxTokens: 100,
    });

    expect(result).toEqual({ content: 'respuesta' });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://provider.test/v1/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer test-key',
    );
    const body = JSON.parse(init.body as string) as {
      model: string;
      temperature: number;
      max_tokens: number;
      messages: Array<{ role: string }>;
    };
    expect(body.model).toBe(env.aiModel);
    expect(body.temperature).toBe(0.5);
    expect(body.max_tokens).toBe(100);
    expect(body.messages[0]).toEqual({ role: 'system', content: 'system' });
    expect(body.messages[1]).toEqual({ role: 'user', content: 'hola' });
    expect(init.body as string).not.toContain('test-key');
  });

  it('rechazo HTTP del proveedor degrada a 503 sin filtrar el cuerpo', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 429,
      json: () => Promise.resolve({ error: 'user message echo' }),
    });

    await expect(client.complete(params)).rejects.toThrow(
      'AI provider rejected the request (HTTP 429).',
    );
  });

  it('respuesta vacia del proveedor degrada a 503', async () => {
    fetchMock.mockResolvedValue(okResponse('   '));

    await expect(client.complete(params)).rejects.toThrow(
      'AI provider returned an empty response.',
    );
  });

  it('error de red degrada a 503 "AI provider is unavailable"', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    await expect(client.complete(params)).rejects.toThrow(
      'AI provider is unavailable.',
    );
  });

  it('timeout del proveedor degrada a 503 con el ms configurado', async () => {
    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';
    fetchMock.mockRejectedValue(abortError);

    await expect(client.complete(params)).rejects.toThrow(
      `AI provider timed out after ${env.aiRequestTimeoutMs}ms.`,
    );
  });

  it('propaga el 503 ya acotado sin reenvolverlo', async () => {
    fetchMock.mockRejectedValue(new ServiceUnavailableException('Ya acotado'));

    await expect(client.complete(params)).rejects.toThrow('Ya acotado');
  });
});
