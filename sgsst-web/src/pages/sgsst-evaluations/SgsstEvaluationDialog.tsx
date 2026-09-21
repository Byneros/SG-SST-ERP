import { AddTask, Save } from '@mui/icons-material'
import { Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, LinearProgress, MenuItem, Stack, TextField, Tooltip, Typography } from '@mui/material'
import { useEffect, useState } from 'react'
import type { Company, EvaluationItemStatus, SgsstEvaluation, SgsstEvaluationFormValues } from '../../types'

const itemStatuses: EvaluationItemStatus[] = ['PENDING', 'COMPLIANT', 'PARTIAL', 'NON_COMPLIANT', 'NOT_APPLICABLE']
const riskClasses = ['I', 'II', 'III', 'IV', 'V']

export function SgsstEvaluationDialog(props: {
  open: boolean
  editing: boolean
  values: SgsstEvaluationFormValues
  companies: Company[]
  item?: SgsstEvaluation
  loading: boolean
  canPickCompany: boolean
  canRespond: boolean
  onChange: (values: SgsstEvaluationFormValues) => void
  onClose: () => void
  onSave: () => void
  onUpdateItem: (itemId: string, payload: { status: EvaluationItemStatus; notes?: string }) => void
  onAddItem: (evaluationId: string, payload: { numeral?: string; section?: string; question: string; maxScore?: number }) => void
}) {
  const [drafts, setDrafts] = useState<Record<string, { status: EvaluationItemStatus; notes: string }>>({})
  const [newItem, setNewItem] = useState({ numeral: '', section: '', question: '', maxScore: '' })

  const items = props.item?.items ?? []
  const compliance = props.item?.compliancePercent
  // Version del backend (id + updatedAt): reinicia los borradores al abrir el
  // dialogo o cuando un guardado trae items recalculados desde el servidor.
  const itemsVersion = `${props.item?.id ?? ''}:${props.item?.updatedAt ?? ''}`

  useEffect(() => {
    const next: Record<string, { status: EvaluationItemStatus; notes: string }> = {}
    for (const evaluationItem of items) {
      next[evaluationItem.id] = { status: evaluationItem.status, notes: evaluationItem.notes ?? '' }
    }
    setDrafts(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsVersion])

  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{props.editing ? 'Editar evaluacion' : 'Nueva evaluacion Res. 0312'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Nombre" value={props.values.name} onChange={(event) => props.onChange({ ...props.values, name: event.target.value })} required />
          <TextField select label="Clase de riesgo" value={props.values.riskClass} onChange={(event) => props.onChange({ ...props.values, riskClass: event.target.value })} required>
            {riskClasses.map((riskClass) => <MenuItem key={riskClass} value={riskClass}>Clase {riskClass}</MenuItem>)}
          </TextField>
          <TextField label="Periodo" value={props.values.period} onChange={(event) => props.onChange({ ...props.values, period: event.target.value })} />
          <TextField label="Notas" value={props.values.notes} onChange={(event) => props.onChange({ ...props.values, notes: event.target.value })} multiline minRows={2} />
          <TextField select label="Empresa" value={props.values.companyId} disabled={!props.canPickCompany} onChange={(event) => props.onChange({ ...props.values, companyId: event.target.value })} required>
            {props.companies.map((company) => <MenuItem key={company.id} value={company.id}>{company.name}</MenuItem>)}
          </TextField>
          {props.editing && (
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="subtitle2">Items de la evaluacion</Typography>
                <Chip size="small" label={String(items.length)} variant="outlined" />
                {compliance !== null && compliance !== undefined && (
                  <Chip size="small" color="primary" label={`${compliance}% cumplimiento`} />
                )}
              </Stack>
              {compliance !== null && compliance !== undefined && (
                <LinearProgress variant="determinate" value={compliance} sx={{ mb: 1 }} />
              )}
              {items.length === 0 && (
                <Typography variant="body2" color="text.secondary">La evaluacion aun no tiene items.</Typography>
              )}
              {props.editing && props.canRespond && (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1 }} alignItems={{ sm: 'center' }}>
                  <TextField size="small" label="Numeral" value={newItem.numeral} sx={{ maxWidth: 110 }} onChange={(event) => setNewItem((current) => ({ ...current, numeral: event.target.value }))} />
                  <TextField size="small" label="Seccion" value={newItem.section} sx={{ maxWidth: 140 }} onChange={(event) => setNewItem((current) => ({ ...current, section: event.target.value }))} />
                  <TextField size="small" label="Pregunta" value={newItem.question} required sx={{ flex: 1 }} onChange={(event) => setNewItem((current) => ({ ...current, question: event.target.value }))} />
                  <TextField size="small" type="number" label="Puntaje max." value={newItem.maxScore} sx={{ maxWidth: 120 }} onChange={(event) => setNewItem((current) => ({ ...current, maxScore: event.target.value }))} />
                  <Button
                    variant="outlined"
                    startIcon={<AddTask />}
                    disabled={props.loading || !newItem.question.trim()}
                    onClick={() => {
                      props.onAddItem(props.item!.id, {
                        numeral: newItem.numeral.trim() || undefined,
                        section: newItem.section.trim() || undefined,
                        question: newItem.question.trim(),
                        maxScore: newItem.maxScore === '' ? undefined : Number(newItem.maxScore),
                      })
                      setNewItem({ numeral: '', section: '', question: '', maxScore: '' })
                    }}
                  >
                    Agregar
                  </Button>
                </Stack>
              )}
              {items.map((evaluationItem) => {
                const draft = drafts[evaluationItem.id] ?? { status: evaluationItem.status, notes: evaluationItem.notes ?? '' }
                const dirty = draft.status !== evaluationItem.status || draft.notes !== (evaluationItem.notes ?? '')
                return (
                  <Box key={evaluationItem.id} sx={{ py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="subtitle2">{evaluationItem.numeral ? `${evaluationItem.numeral} - ` : ''}{evaluationItem.question}</Typography>
                    {evaluationItem.section && <Typography variant="caption" color="text.secondary">{evaluationItem.section}</Typography>}
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1 }} alignItems={{ sm: 'center' }}>
                      <TextField
                        select
                        size="small"
                        label="Estado"
                        value={draft.status}
                        disabled={!props.canRespond}
                        sx={{ minWidth: 170 }}
                        onChange={(event) => setDrafts((current) => ({ ...current, [evaluationItem.id]: { ...draft, status: event.target.value as EvaluationItemStatus } }))}
                      >
                        {itemStatuses.map((status) => <MenuItem key={status} value={status}>{status}</MenuItem>)}
                      </TextField>
                      <TextField
                        size="small"
                        label="Notas"
                        value={draft.notes}
                        disabled={!props.canRespond}
                        sx={{ flex: 1 }}
                        onChange={(event) => setDrafts((current) => ({ ...current, [evaluationItem.id]: { ...draft, notes: event.target.value } }))}
                      />
                      <Tooltip title="Guardar item">
                        <span>
                          <IconButton
                            disabled={!props.canRespond || props.loading || !dirty}
                            onClick={() => props.onUpdateItem(evaluationItem.id, { status: draft.status, notes: draft.notes.trim() || undefined })}
                          >
                            <Save />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Stack>
                  </Box>
                )
              })}
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cerrar</Button>
        <Button variant="contained" disabled={props.loading || !props.values.name || !props.values.companyId} onClick={props.onSave}>Guardar</Button>
      </DialogActions>
    </Dialog>
  )
}
