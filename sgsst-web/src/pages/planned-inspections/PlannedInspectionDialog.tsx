import { AddTask, Add, Save } from '@mui/icons-material'
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useEffect, useState } from 'react'
import type {
  Company,
  PlannedInspection,
  PlannedInspectionFormValues,
  Site,
  SystemUser,
} from '../../types'

const inspectionTypes = ['LOCATIVE', 'EPP', 'EQUIPMENT', 'TOOLS', 'ORDER_CLEANING', 'EMERGENCY']
const inspectionStatuses: PlannedInspection['status'][] = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']

const typeLabels: Record<string, string> = {
  LOCATIVE: 'Locativa',
  EPP: 'EPP',
  EQUIPMENT: 'Equipos',
  TOOLS: 'Herramientas',
  ORDER_CLEANING: 'Orden y aseo',
  EMERGENCY: 'Emergencias',
}

const statusLabels: Record<PlannedInspection['status'], string> = {
  PLANNED: 'Planeada',
  IN_PROGRESS: 'En ejecucion',
  COMPLETED: 'Ejecutada',
  CANCELLED: 'Cancelada',
}

export function PlannedInspectionDialog(props: {
  open: boolean
  editing: boolean
  values: PlannedInspectionFormValues
  companies: Company[]
  sites: Site[]
  users: SystemUser[]
  item?: PlannedInspection
  loading: boolean
  canPickCompany: boolean
  canRespond: boolean
  onChange: (values: PlannedInspectionFormValues) => void
  onClose: () => void
  onSave: () => void
  onUpdateItem: (inspectionId: string, itemId: string, payload: { answer: string; notes?: string }) => void
  onAddItem: (inspectionId: string, question: string) => void
  onAddFinding: (inspectionId: string, description: string, severity: string) => void
  onAddAction: (findingId: string) => void
}) {
  const [newQuestion, setNewQuestion] = useState('')
  const [newFinding, setNewFinding] = useState({ description: '', severity: 'MINOR' })

  const items = props.item?.items ?? []
  const findings = props.item?.findings ?? []
  // Version del backend (id + updatedAt): reinicia los borradores al recargar.
  const version = `${props.item?.id ?? ''}:${props.item?.updatedAt ?? ''}`
  const [drafts, setDrafts] = useState<Record<string, { answer: string; notes: string }>>({})

  useEffect(() => {
    const next: Record<string, { answer: string; notes: string }> = {}
    for (const item of items) {
      next[item.id] = { answer: item.answer ?? '', notes: item.notes ?? '' }
    }
    setDrafts(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])

  const siteOptions = props.sites.filter((site) => site.companyId === props.values.companyId)
  const userOptions = props.users.filter((u) => u.companyId === props.values.companyId)

  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="md" fullWidth>
      <DialogTitle>{props.editing ? 'Editar inspeccion' : 'Nueva inspeccion planeada'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Titulo"
            value={props.values.title}
            onChange={(event) => props.onChange({ ...props.values, title: event.target.value })}
            required
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              select label="Tipo" sx={{ maxWidth: 200 }}
              value={props.values.type}
              onChange={(event) => props.onChange({ ...props.values, type: event.target.value })}
            >
              {inspectionTypes.map((type) => (
                <MenuItem key={type} value={type}>{typeLabels[type]}</MenuItem>
              ))}
            </TextField>
            <TextField
              type="date" label="Programada" InputLabelProps={{ shrink: true }}
              value={props.values.scheduledAt}
              onChange={(event) => props.onChange({ ...props.values, scheduledAt: event.target.value })}
              required
            />
            <TextField
              label="Frecuencia" placeholder="Mensual, Trimestral..."
              value={props.values.frequency}
              onChange={(event) => props.onChange({ ...props.values, frequency: event.target.value })}
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              select label="Sede" value={props.values.siteId}
              onChange={(event) => props.onChange({ ...props.values, siteId: event.target.value })}
              helperText={siteOptions.length === 0 ? 'Sin sedes registradas' : undefined}
            >
              <MenuItem value="">Sin sede</MenuItem>
              {siteOptions.map((site) => (
                <MenuItem key={site.id} value={site.id}>{site.name}</MenuItem>
              ))}
            </TextField>
            <TextField
              select label="Inspector" value={props.values.inspectorId}
              onChange={(event) => props.onChange({ ...props.values, inspectorId: event.target.value })}
            >
              <MenuItem value="">Sin inspector</MenuItem>
              {userOptions.map((u) => (
                <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>
              ))}
            </TextField>
            <TextField
              select label="Empresa" value={props.values.companyId}
              disabled={!props.canPickCompany}
              onChange={(event) => props.onChange({ ...props.values, companyId: event.target.value })}
              required
            >
              {props.companies.map((company) => (
                <MenuItem key={company.id} value={company.id}>{company.name}</MenuItem>
              ))}
            </TextField>
          </Stack>
          {props.editing && (
            <TextField
              select label="Estado" value={props.values.status}
              onChange={(event) => props.onChange({ ...props.values, status: event.target.value as PlannedInspection['status'] })}
              sx={{ maxWidth: 220 }}
            >
              {inspectionStatuses.map((status) => (
                <MenuItem key={status} value={status}>{statusLabels[status]}</MenuItem>
              ))}
            </TextField>
          )}

          {props.editing && props.item && (
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="subtitle2">Checklist</Typography>
                <Chip size="small" variant="outlined" label={`${items.filter((i) => i.answer).length}/${items.length}`} />
              </Stack>
              {!props.canRespond && items.length === 0 && (
                <Typography variant="body2" color="text.secondary">El checklist aun no tiene preguntas.</Typography>
              )}
              {props.canRespond && (
                <Stack direction="row" spacing={1} sx={{ mb: 1 }} component="form" onSubmit={(event) => { event.preventDefault(); setNewQuestion('') }}>
                  <TextField
                    size="small" label="Nueva pregunta del checklist" required sx={{ flex: 1 }}
                    value={newQuestion}
                    onChange={(event) => setNewQuestion(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && newQuestion.trim()) {
                        props.onAddItem?.(props.item!.id, newQuestion.trim())
                        setNewQuestion('')
                      }
                    }}
                  />
                  <Button
                    variant="outlined" startIcon={<Add />}
                    disabled={props.loading || !newQuestion.trim()}
                    onClick={() => {
                      props.onAddItem?.(props.item!.id, newQuestion.trim())
                      setNewQuestion('')
                    }}
                  >
                    Agregar
                  </Button>
                </Stack>
              )}
              {items.map((item) => {
                const draft = drafts[item.id] ?? { answer: item.answer ?? '', notes: item.notes ?? '' }
                return (
                  <Box key={item.id} sx={{ py: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                    <Typography variant="body2">{item.question}</Typography>
                    {props.canRespond && (
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 0.5 }} alignItems={{ sm: 'center' }}>
                        <TextField
                          size="small" select label="Respuesta" sx={{ maxWidth: 200 }}
                          value={draft.answer}
                          onChange={(event) => setDrafts((c) => ({ ...c, [item.id]: { ...draft, answer: event.target.value } }))}
                        >
                          <MenuItem value="">Sin responder</MenuItem>
                          <MenuItem value="CUMPLE">Cumple</MenuItem>
                          <MenuItem value="NO_CUMPLE">No cumple</MenuItem>
                          <MenuItem value="NA">No aplica</MenuItem>
                        </TextField>
                        <TextField
                          size="small" label="Observacion" sx={{ flex: 1 }}
                          value={draft.notes}
                          onChange={(event) => setDrafts((c) => ({ ...c, [item.id]: { ...draft, notes: event.target.value } }))}
                        />
                        <Button
                          size="small" startIcon={<Save />} disabled={props.loading}
                          onClick={() => props.onUpdateItem(props.item!.id, item.id, { answer: draft.answer, notes: draft.notes })}
                        >
                          Guardar
                        </Button>
                      </Stack>
                    )}
                  </Box>
                )
              })}

              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2, mb: 1 }}>
                <Typography variant="subtitle2">Hallazgos</Typography>
                <Chip size="small" variant="outlined" label={String(findings.length)} />
              </Stack>
              {props.canRespond && (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 1 }} alignItems={{ sm: 'center' }}>
                  <TextField
                    size="small" label="Descripcion del hallazgo" required sx={{ flex: 1 }}
                    value={newFinding.description}
                    onChange={(event) => setNewFinding((c) => ({ ...c, description: event.target.value }))}
                  />
                  <TextField
                    size="small" select label="Severidad" sx={{ maxWidth: 150 }}
                    value={newFinding.severity}
                    onChange={(event) => setNewFinding((c) => ({ ...c, severity: event.target.value }))}
                  >
                    <MenuItem value="MINOR">Menor</MenuItem>
                    <MenuItem value="MAJOR">Mayor</MenuItem>
                    <MenuItem value="CRITICAL">Critico</MenuItem>
                  </TextField>
                  <Button
                    variant="outlined" startIcon={<AddTask />}
                    disabled={props.loading || !newFinding.description.trim()}
                    onClick={() => {
                      props.onAddFinding(props.item!.id, newFinding.description.trim(), newFinding.severity)
                      setNewFinding({ description: '', severity: 'MINOR' })
                    }}
                  >
                    Registrar
                  </Button>
                </Stack>
              )}
              {findings.map((finding) => (
                <Box key={finding.id} sx={{ py: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip
                      size="small"
                      color={finding.severity === 'CRITICAL' ? 'error' : finding.severity === 'MAJOR' ? 'warning' : 'default'}
                      label={finding.severity}
                    />
                    <Typography variant="body2" sx={{ flex: 1 }}>{finding.description}</Typography>
                    {props.canRespond && !finding.action && (
                      <Button
                        size="small"
                        disabled={props.loading}
                        onClick={() => props.onAddAction(finding.id)}
                      >
                        Crear accion
                      </Button>
                    )}
                  </Stack>
                  {finding.action && (
                    <Typography variant="caption" color="text.secondary">
                      Accion: {finding.action.title} - Responsable: {finding.action.responsible} - Vence: {finding.action.dueDate.slice(0, 10)} - {finding.action.status}
                    </Typography>
                  )}
                </Box>
              ))}
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cancelar</Button>
        <Button variant="contained" disabled={props.loading} onClick={props.onSave}>
          {props.editing ? 'Guardar' : 'Crear'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
