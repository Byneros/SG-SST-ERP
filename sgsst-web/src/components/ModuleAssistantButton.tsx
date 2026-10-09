import { SmartToy } from '@mui/icons-material'
import { Button, Tooltip } from '@mui/material'
import type { View } from '../types'

/**
 * Entry point contextual del asistente especializado (Fase L, S16 extendido).
 *
 * Diseno en docs/plan-s16-framework-asistentes.md (section 9). Colocado en el
 * header de cada modulo; navega a la vista del asistente con `?assistant=<id>`.
 *
 * El `assistantId` llega de la paleta generada de `capabilities.assistants`
 * (backend filtra por rol, ver AssistantChatPage); si la vista destino no
 * existe o el usuario no tiene permiso, selectView/openAssistant lo bloquea
 * y el backend 403 sigue siendo la autoridad final.
 */
export function ModuleAssistantButton({
  assistantId,
  onOpen,
  disabled = false,
}: {
  /** Id estable del asistente en el registro del backend (ej: 'risks'). */
  assistantId: string
  /** Navega a la vista del asistente con el query param ?assistant=. */
  onOpen: (view: View, assistantId: string) => void
  /** Oculto si el usuario no puede usar el asistente (canUseAssistant). */
  disabled?: boolean
}) {
  return (
    <Tooltip title="Preguntar al asistente de este modulo">
      <Button
        startIcon={<SmartToy />}
        variant="outlined"
        size="small"
        disabled={disabled}
        onClick={() => onOpen('aiAssistant', assistantId)}
      >
        Preguntar al asistente
      </Button>
    </Tooltip>
  )
}
