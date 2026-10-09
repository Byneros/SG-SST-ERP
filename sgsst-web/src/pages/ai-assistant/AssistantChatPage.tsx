import { DeleteOutline, Send, SmartToy } from '@mui/icons-material'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useEffect, useMemo, useRef, useState } from 'react'
import { api, readApiError } from '../../api/client'

/**
 * Panel de chat del asistente inteligente (Sprint 16, tarea 16.2).
 *
 * - Consume GET /ai-assistant/capabilities para reflejar el estado real
 *   (si el proveedor de IA no esta configurado, lo informa y el ERP sigue
 *   operando; cada envio muestra el error acotado del backend, p. ej. 503).
 * - El historial lo mantiene la UI (Array<{role, content}>) y viaja en cada
 *   peticion; el backend lo sanea y recorta (ver AssistantQueryDto).
 * - Consultas de datos con el prefijo @datos: el backend resuelve el alcance
 *   de empresa; la UI nunca envia companyId.
 * - Fase L: `assistantId` (query param ?assistant=) activa un asistente
 *   especializado del registro; solo se ofrecen los permitidos por rol.
 */
type ChatMessage = {
  role: 'user' | 'assistant'
  content: string
  /** Herramienta usada por el backend cuando la consulta fue @datos. */
  usedTool?: string
  /** Fuentes normativas vigentes verificadas en backend (tarea 16.5). */
  sources?: string[]
  /** Errores de transporte (p. ej. 503 sin proveedor); no viajan en historial. */
  isError?: boolean
}

type AssistantCapabilities = {
  enabled: boolean
  roles: string[]
  dataTools: string[]
  capabilities: string[]
  assistants?: Array<{
    id: string
    name: string
    module: string
    description: string
  }>
  limits: {
    maxMessageLength: number
    historyMessages: number
    timeoutMs: number
  }
}

const QUICK_PROMPTS = [
  '@datos resumen de riesgos',
  '@datos empleados',
  '@datos sedes',
  '@datos capacitaciones',
  '¿Que modulos tiene el ERP?',
]

const WELCOME: ChatMessage = {
  role: 'assistant',
  content:
    'Hola. Soy el asistente del ERP SG-SST. Puedo ayudarte a usar los modulos ' +
    'del sistema y, si escribes una consulta con el prefijo @datos (por ejemplo ' +
    '"@datos resumen de riesgos"), te resumo los datos de tu empresa. ' +
    'Si un dato no esta disponible te lo dire claramente.',
}

/** Mensaje de bienvenida con el asistente especializado activo (Fase L). */
function welcomeFor(assistant?: { name: string; description: string }): ChatMessage {
  if (!assistant) {
    return WELCOME
  }
  return {
    role: 'assistant',
    content:
      `Hola. Estás hablando con el ${assistant.name}. ${assistant.description} ` +
      'Pregunta con tus propias palabras: eligiré las herramientas de este ' +
      'módulo y solo responderé con los datos de tu empresa.',
  }
}

export function AssistantChatPage({
  assistantId,
  onClearAssistant,
}: {
  /** Asistente especializado activo, del query param ?assistant= (Fase L). */
  assistantId?: string
  /** Pide volver al asistente central (Limpiar / asistente no disponible). */
  onClearAssistant?: () => void
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [capabilities, setCapabilities] = useState<AssistantCapabilities | null>(null)
  const [capabilitiesError, setCapabilitiesError] = useState('')
  const conversationIdRef = useRef(crypto.randomUUID())
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let active = true
    api
      .get<AssistantCapabilities>('/ai-assistant/capabilities')
      .then((response) => {
        if (active) setCapabilities(response.data)
      })
      .catch((error) => {
        if (active) setCapabilitiesError(readApiError(error))
      })
    return () => {
      active = false
    }
  }, [])

  const activeAssistant = useMemo(
    () =>
      assistantId && capabilities
        ? (capabilities.assistants?.find((entry) => entry.id === assistantId) ?? null)
        : null,
    [assistantId, capabilities],
  )

  // El asistente activo solo puede ser uno del registro permitido para el
  // rol (capabilities ya viene filtrado por el backend). Un id invalido o no
  // permitido degrada al asistente central sin error de transporte.
  useEffect(() => {
    if (assistantId && capabilities && !activeAssistant) {
      onClearAssistant?.()
      return
    }
    if (assistantId && capabilitiesError) {
      onClearAssistant?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assistantId, capabilities, activeAssistant, capabilitiesError])

  // Nuevo asistente activo => conversacion nueva (contexto distinto).
  useEffect(() => {
    conversationIdRef.current = crypto.randomUUID()
    setMessages([welcomeFor(activeAssistant ?? undefined)])
    setInput('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assistantId])

  // El panel siempre muestra el ultimo mensaje (comportamiento de chat).
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages, sending])

  function historyPayload(current: ChatMessage[]) {
    const limit = capabilities?.limits.historyMessages ?? 8
    return current
      .filter((message) => !message.isError)
      .slice(-limit)
      .map(({ role, content }) => ({ role, content }))
  }

  async function send(rawMessage: string) {
    const message = rawMessage.trim()
    const maxLength = capabilities?.limits.maxMessageLength ?? 4000
    if (!message || sending || message.length > maxLength) {
      return
    }
    const current = messages
    setMessages([...current, { role: 'user', content: message }])
    setInput('')
    setSending(true)
    try {
      if (activeAssistant) {
        // Fase L: consulta al asistente especializado (orquestador del
        // backend elige herramientas READ del registro por keywords).
        const response = await api.post<{
          content: string
          usedTools?: Array<{ assistant: string; tool: string }>
          omittedAssistants?: string[]
        }>('/ai-assistant/ask', {
          message,
          conversationId: conversationIdRef.current,
          history: historyPayload(current),
          assistantId: activeAssistant.id,
        })
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: response.data.content,
            usedTool: response.data.usedTools
              ?.map((entry) => `${entry.assistant}:${entry.tool}`)
              .join(', '),
          },
        ])
        return
      }
      const response = await api.post<{
        content: string
        usedTool?: string
        sources?: string[]
      }>('/ai-assistant/ask', {
        message,
        conversationId: conversationIdRef.current,
        history: historyPayload(current),
      })
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: response.data.content,
          usedTool: response.data.usedTool,
          sources: response.data.sources,
        },
      ])
    } catch (error) {
      // Error acotado del backend (p. ej. 503 sin proveedor): el chat sigue vivo.
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: readApiError(error), isError: true },
      ])
    } finally {
      setSending(false)
    }
  }

  function clearConversation() {
    if (activeAssistant) {
      onClearAssistant?.()
      return
    }
    conversationIdRef.current = crypto.randomUUID()
    setMessages([WELCOME])
    setInput('')
  }

  const maxLength = capabilities?.limits.maxMessageLength ?? 4000
  const headerTitle = activeAssistant ? activeAssistant.name : 'Asistente inteligente'
  const headerSubtitle = activeAssistant
    ? activeAssistant.description
    : 'Ayuda del ERP y consulta de datos de tu empresa con @datos'
  const prompts = activeAssistant
    ? [
        `Resumen de ${activeAssistant.module === 'risks' ? 'la matriz de riesgos' : activeAssistant.module}`,
        '¿Que datos tienes de mi empresa?',
        '¿Que herramientas usas?',
      ]
    : QUICK_PROMPTS

  return (
    <Container maxWidth="md" disableGutters sx={{ width: '100%' }}>
      <Paper variant="outlined" sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 190px)', minHeight: 420 }}>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
          <SmartToy color="primary" />
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="subtitle1">{headerTitle}</Typography>
            <Typography variant="caption" color="text.secondary">
              {headerSubtitle}
            </Typography>
          </Box>
          <Button size="small" startIcon={<DeleteOutline />} onClick={clearConversation}>
            Limpiar
          </Button>
        </Stack>

        {capabilities && !capabilities.enabled && (
          <Alert severity="info" sx={{ mx: 2, mt: 2 }}>
            El asistente no tiene proveedor de IA configurado (AI_ENABLED, AI_API_KEY,
            AI_BASE_URL en el backend). El resto del ERP funciona con normalidad.
          </Alert>
        )}
        {capabilitiesError && <Alert severity="warning" sx={{ mx: 2, mt: 2 }}>{capabilitiesError}</Alert>}

        <Box ref={scrollRef} sx={{ flexGrow: 1, overflowY: 'auto', px: 2, py: 2 }}>
          <Stack spacing={1.5}>
            {messages.map((message, index) => (
              <ChatBubble key={index} message={message} />
            ))}
            {sending && (
              <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'text.secondary' }}>
                <CircularProgress size={16} />
                <Typography variant="caption">Pensando...</Typography>
              </Stack>
            )}
          </Stack>
        </Box>

        <Box sx={{ px: 2, pb: 1 }}>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 0.5 }}>
            {prompts.map((prompt) => (
              <Chip
                key={prompt}
                label={prompt}
                size="small"
                onClick={() => void send(prompt)}
                disabled={sending}
              />
            ))}
          </Stack>
        </Box>

        <Divider />
        <Stack direction="row" spacing={1.5} sx={{ p: 2 }} alignItems="flex-end">
          <TextField
            fullWidth
            multiline
            maxRows={4}
            placeholder={
              activeAssistant
                ? `Pregunta al ${activeAssistant.name}...`
                : 'Escribe tu consulta... usa @datos para datos de tu empresa'
            }
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void send(input)
              }
            }}
            inputProps={{ maxLength }}
            disabled={sending}
            size="small"
          />
          <Button
            variant="contained"
            endIcon={<Send />}
            onClick={() => void send(input)}
            disabled={sending || !input.trim()}
          >
            Enviar
          </Button>
        </Stack>
      </Paper>
    </Container>
  )
}

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  return (
    <Box sx={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      <Paper
        variant="outlined"
        sx={{
          maxWidth: '78%',
          px: 1.75,
          py: 1.25,
          bgcolor: message.isError ? 'warning.light' : isUser ? 'primary.light' : 'background.paper',
          color: message.isError ? 'warning.dark' : 'text.primary',
        }}
      >
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
          {message.content}
        </Typography>
        {message.usedTool && (
          <Chip
            label={`Datos: ${message.usedTool}`}
            size="small"
            variant="outlined"
            sx={{ mt: 1 }}
          />
        )}
        {message.sources && message.sources.length > 0 && (
          <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap', rowGap: 0.5, mt: 1 }}>
            {message.sources.map((source) => (
              <Chip key={source} label={source} size="small" color="primary" variant="outlined" />
            ))}
          </Stack>
        )}
      </Paper>
    </Box>
  )
}
