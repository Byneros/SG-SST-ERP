import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { env } from '../../config/env';
import { AssistantResult } from './ai-assistant.types';

/**
 * Cliente del proveedor de IA (OpenAI-compatible: /v1/chat/completions).
 *
 * - La API key vive SOLO en el backend (env.aiApiKey); nunca viaja al frontend.
 * - Timeout y manejo de errores: si el proveedor no esta disponible el ERP
 *   sigue funcionando; el endpoint del asistente responde 503 acotado.
 * - No se registran mensajes en logs (proteccion de datos).
 */
@Injectable()
export class AiProviderClient {
  async complete(params: {
    systemPrompt: string;
    messages: Array<{ role: 'user' | 'assistant'; content: string }>;
    temperature?: number;
    maxTokens?: number;
  }): Promise<AssistantResult> {
    if (!env.aiEnabled || !env.aiApiKey || !env.aiBaseUrl) {
      throw new ServiceUnavailableException(
        'AI assistant is not configured. Set AI_ENABLED, AI_API_KEY and AI_BASE_URL.',
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      env.aiRequestTimeoutMs,
    );

    try {
      const response = await fetch(
        `${env.aiBaseUrl.replace(/\/$/, '')}/chat/completions`,
        {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.aiApiKey}`,
          },
          body: JSON.stringify({
            model: env.aiModel,
            temperature: params.temperature ?? env.aiTemperature,
            max_tokens: params.maxTokens ?? env.aiMaxTokens,
            messages: [
              { role: 'system', content: params.systemPrompt },
              ...params.messages.slice(-env.aiHistoryMaxMessages),
            ],
          }),
        },
      );

      if (!response.ok) {
        // No se registra el cuerpo (podria contener eco del mensaje del usuario).
        throw new ServiceUnavailableException(
          `AI provider rejected the request (HTTP ${response.status}).`,
        );
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = payload.choices?.[0]?.message?.content?.trim();
      if (!content) {
        throw new ServiceUnavailableException(
          'AI provider returned an empty response.',
        );
      }
      return { content };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }
      const aborted = error instanceof Error && error.name === 'AbortError';
      throw new ServiceUnavailableException(
        aborted
          ? `AI provider timed out after ${env.aiRequestTimeoutMs}ms.`
          : 'AI provider is unavailable.',
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
