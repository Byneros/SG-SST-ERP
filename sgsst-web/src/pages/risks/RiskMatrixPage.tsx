import { useEffect, useMemo, useState } from 'react'
import { Add, Delete, ExpandLess, ExpandMore, Edit, Percent, TrendingUp } from '@mui/icons-material'
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem,
  Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material'
import { api, readApiError } from '../../api/client'
import { ViewBreadcrumb, ActiveCompanyBanner } from '../../components/TablePieces'
import { riskLevelLabels } from '../../constants/catalogs'
import type {
  HazardControlSource, HazardType, RiskGtcLevel, RiskLevel, RiskProcessItem, Site,
} from '../../types'

const HAZARD_TYPES: HazardType[] = [
  'FISICO', 'QUIMICO', 'BIOLOGICO', 'BIOMECANICO', 'PSICOSOCIAL', 'LOCATIVO', 'TECNOLOGICO', 'FENOMENOS_NATURALES',
]
const HAZARD_TYPE_LABELS: Record<HazardType, string> = {
  FISICO: 'Físico', QUIMICO: 'Químico', BIOLOGICO: 'Biológico', BIOMECANICO: 'Biomecánico',
  PSICOSOCIAL: 'Psicosocial', LOCATIVO: 'Locativo', TECNOLOGICO: 'Tecnológico', FENOMENOS_NATURALES: 'Fenómenos naturales',
}
const CONTROL_SOURCES: HazardControlSource[] = ['ADMINISTRATIVO', 'OPERACIONAL', 'COMPORTAMIENTO', 'EPP']
const CONTROL_SOURCE_LABELS: Record<HazardControlSource, string> = {
  ADMINISTRATIVO: 'Administrativo', OPERACIONAL: 'Operacional', COMPORTAMIENTO: 'Comportamiento', EPP: 'EPP',
}

/** Umbral GTC-45: score = probabilidad × severidad; nivel derivado en cliente
 *  solo para preview; el backend es la fuente de verdad. */
export function deriveGtcLevel(probability: number, severity: number): RiskGtcLevel {
  const score = probability * severity
  if (score <= 4) return 'I'
  if (score <= 9) return 'II'
  if (score <= 19) return 'III'
  return 'IV'
}

const GTC_LABELS: Record<RiskGtcLevel, string> = { I: 'I · Trivial', II: 'II · Moderado', III: 'III · Grave', IV: 'IV · Crítico' }
const GTC_COLORS: Record<RiskGtcLevel, 'success' | 'info' | 'warning' | 'error'> = {
  I: 'success', II: 'info', III: 'warning', IV: 'error',
}
const RISK_FROM_GTC: Record<RiskGtcLevel, RiskLevel> = { I: 'LOW', II: 'MEDIUM', III: 'HIGH', IV: 'CRITICAL' }

type DialogMode =
  | { kind: 'process'; id?: string }
  | { kind: 'activity'; processId: string; id?: string }
  | { kind: 'hazard'; activityId: string; id?: string }
  | { kind: 'valoracion'; hazardId: string }
  | { kind: 'control'; hazardId: string; id?: string }
  | { kind: 'risk'; hazardId: string }
  | null

const EMPTY_TEXT = { name: '', description: '' }

export function RiskMatrixPage(props: {
  canManage: boolean
  sites: Site[]
  activeCompanyId?: string
  activeCompanyName?: string
  onOpenAssistant?: (view: 'risks', assistantId: string) => void
}) {
  const [tree, setTree] = useState<RiskProcessItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [dialog, setDialog] = useState<DialogMode>(null)
  const [text, setText] = useState(EMPTY_TEXT)
  const [hazardType, setHazardType] = useState<HazardType>('FISICO')
  const [probability, setProbability] = useState(1)
  const [severity, setSeverity] = useState(1)
  const [source, setSource] = useState<HazardControlSource>('EPP')
  const [controlType, setControlType] = useState('')
  const [effective, setEffective] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadTree() {
    setLoading(true)
    setError('')
    try {
      const response = await api.get<RiskProcessItem[]>('/risk-matrix')
      setTree(Array.isArray(response.data) ? response.data : [])
    } catch (err) {
      setError(readApiError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadTree()
  }, [])

  const openDialog = (mode: NonNullable<DialogMode>, seed?: { name?: string; description?: string }) => {
    setText({ name: seed?.name ?? '', description: seed?.description ?? '' })
    setDialog(mode)
  }

  async function submit() {
    if (!dialog || !text.name.trim()) return
    setSaving(true)
    setError('')
    const payload: Record<string, unknown> = { name: text.name.trim() }
    if (text.description.trim()) payload.description = text.description.trim()
    try {
      if (dialog.kind === 'process') {
        if (dialog.id) await api.patch(`/risk-matrix/processes/${dialog.id}`, payload)
        else {
          payload.companyId = props.activeCompanyId
          const created = await api.post<{ id: string }>('/risk-matrix/processes', payload)
          setExpanded((prev) => ({ ...prev, [created.data.id]: true }))
        }
      } else if (dialog.kind === 'activity') {
        if (dialog.id) await api.patch(`/risk-matrix/activities/${dialog.id}`, payload)
        else await api.post(`/risk-matrix/processes/${dialog.processId}/activities`, payload)
      } else if (dialog.kind === 'hazard') {
        if (dialog.id) await api.patch(`/risk-matrix/hazards/${dialog.id}`, { ...payload, hazardType })
        else await api.post(`/risk-matrix/activities/${dialog.activityId}/hazards`, { name: payload.name, hazardType })
      } else if (dialog.kind === 'valoracion') {
        await api.put(`/risk-matrix/hazards/${dialog.hazardId}/valoracion`, { probability, severity })
      } else if (dialog.kind === 'control') {
        const body = { source, type: controlType.trim() || undefined, effectiveness: effective.trim() || undefined }
        if (dialog.id) await api.patch(`/risk-matrix/controls/${dialog.id}`, body)
        else await api.post(`/risk-matrix/hazards/${dialog.hazardId}/controls`, body)
      } else if (dialog.kind === 'risk') {
        await api.post(`/risk-matrix/hazards/${dialog.hazardId}/risk`, { title: text.name.trim() })
      }
      setDialog(null)
      await loadTree()
    } catch (err) {
      setError(readApiError(err))
    } finally {
      setSaving(false)
    }
  }

  async function remove(kind: 'processes' | 'activities' | 'hazards' | 'controls', id: string) {
    setError('')
    try {
      await api.delete(`/risk-matrix/${kind}/${id}`)
      await loadTree()
    } catch (err) {
      setError(readApiError(err))
    }
  }

  const stats = useMemo(() => {
    const hazards = tree.flatMap((p) => p.activities.flatMap((a) => a.hazards))
    const valorados = hazards.filter((h) => h.valorations.length > 0)
    const byLevel = { I: 0, II: 0, III: 0, IV: 0 } as Record<RiskGtcLevel, number>
    valorados.forEach((h) => {
      const level = h.valorations[0]?.riskLevel
      if (level) byLevel[level] += 1
    })
    return { processes: tree.length, hazards: hazards.length, valorados: valorados.length, byLevel }
  }, [tree])

  const renderProcessNameInput = () => (
    <Stack spacing={2} sx={{ mt: 1 }}>
      <TextField
        autoFocus label="Nombre" value={text.name} required multiline minRows={1}
        onChange={(event) => setText({ ...text, name: event.target.value })}
      />
      {(dialog?.kind === 'process' || dialog?.kind === 'activity') && (
        <TextField
          label="Descripción" value={text.description} multiline minRows={2}
          onChange={(event) => setText({ ...text, description: event.target.value })}
        />
      )}
      {dialog?.kind === 'hazard' && (
        <TextField select label="Tipo de peligro (numeral 3 GTC-45)" value={hazardType} onChange={(event) => setHazardType(event.target.value as HazardType)}>
          {HAZARD_TYPES.map((t) => (
            <MenuItem key={t} value={t}>{HAZARD_TYPE_LABELS[t]}</MenuItem>
          ))}
        </TextField>
      )}
    </Stack>
  )

  const dialogTitle = () => {
    switch (dialog?.kind) {
      case 'process': return dialog.id ? 'Editar proceso' : 'Nuevo proceso'
      case 'activity': return dialog.id ? 'Editar actividad' : 'Nueva actividad'
      case 'hazard': return dialog.id ? 'Editar peligro' : 'Nuevo peligro'
      case 'valoracion': return 'Valoración (probabilidad × severidad)'
      case 'control': return dialog.id ? 'Editar control' : 'Nuevo control existente'
      case 'risk': return 'Generar riesgo (numeral 6 GTC-45)'
      default: return ''
    }
  }

  return (
    <Paper className="panel" variant="outlined">
      <ActiveCompanyBanner name={props.activeCompanyName} />
      <ViewBreadcrumb view="Matriz GTC-45" />
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={1.5} sx={{ mb: 2 }}>
        <Typography variant="subtitle1">Reconocimiento y valoración de peligros (GTC-45)</Typography>
        {props.canManage && (
          <Button variant="contained" startIcon={<Add />} onClick={() => openDialog({ kind: 'process' })}>
            Nuevo proceso
          </Button>
        )}
      </Stack>
      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
        <Chip size="small" label={`${stats.processes} procesos`} variant="outlined" />
        <Chip size="small" label={`${stats.hazards} peligros`} variant="outlined" />
        <Chip size="small" label={`${stats.valorados} valorados`} variant="outlined" />
        {(['I', 'II', 'III', 'IV'] as RiskGtcLevel[]).map((level) => (
          <Chip key={level} size="small" color={GTC_COLORS[level]} variant="outlined" label={`${GTC_LABELS[level]}: ${stats.byLevel[level]}`} />
        ))}
      </Stack>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading ? (
        <Typography color="text.secondary">Cargando matriz…</Typography>
      ) : tree.length === 0 ? (
        <Typography color="text.secondary">
          Sin procesos registrados. Crea el primer proceso para iniciar la matriz estructurada.
        </Typography>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Cadena proceso → actividad → peligro</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell>Valoración</TableCell>
                <TableCell>Controles</TableCell>
                <TableCell>Riesgo vinculado</TableCell>
                {props.canManage && <TableCell align="right">Acciones</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {tree.flatMap((process) => [
                <TableRow key={`p-${process.id}`} hover sx={{ backgroundColor: 'action.hover' }}>
                  <TableCell>
                    <Stack direction="row" alignItems="center" spacing={0.5}>
                      <IconButton size="small" onClick={() => setExpanded((prev) => ({ ...prev, [process.id]: !prev[process.id] }))}>
                        {expanded[process.id] ? <ExpandLess /> : <ExpandMore />}
                      </IconButton>
                      <Typography variant="body2" fontWeight="bold">{process.name}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell colSpan={4} />
                  {props.canManage && (
                    <TableCell align="right">
                      <IconButton size="small" title="Añadir actividad" onClick={() => openDialog({ kind: 'activity', processId: process.id })}>
                        <Add />
                      </IconButton>
                      <IconButton size="small" title="Editar proceso" onClick={() => openDialog({ kind: 'process', id: process.id }, process)}>
                        <Edit />
                      </IconButton>
                      <IconButton size="small" color="error" title="Eliminar proceso (cascada)" onClick={() => void remove('processes', process.id)}>
                        <Delete />
                      </IconButton>
                    </TableCell>
                  )}
                </TableRow>,
                ...(expanded[process.id] ? process.activities.flatMap((activity) => [
                  <TableRow key={`a-${activity.id}`} hover>
                    <TableCell sx={{ pl: 6 }}>{activity.name}</TableCell>
                    <TableCell colSpan={4} />
                    {props.canManage && (
                      <TableCell align="right">
                        <IconButton size="small" title="Añadir peligro" onClick={() => openDialog({ kind: 'hazard', activityId: activity.id })}>
                          <Add />
                        </IconButton>
                        <IconButton size="small" title="Eliminar actividad" color="error" onClick={() => void remove('activities', activity.id)}>
                          <Delete />
                        </IconButton>
                      </TableCell>
                    )}
                  </TableRow>,
                  ...activity.hazards.map((hazard) => {
                    const val = hazard.valorations[0]
                    return (
                      <TableRow key={`h-${hazard.id}`} hover>
                        <TableCell sx={{ pl: 10 }}>{hazard.name}</TableCell>
                        <TableCell>
                          <Chip size="small" label={HAZARD_TYPE_LABELS[hazard.hazardType]} variant="outlined" />
                        </TableCell>
                        <TableCell>
                          {val ? (
                            <Chip size="small" color={GTC_COLORS[val.riskLevel]} label={`${GTC_LABELS[val.riskLevel]} (${val.probability}×${val.severity})`} />
                          ) : (
                            <Chip size="small" label="Sin valorar" variant="outlined" />
                          )}
                        </TableCell>
                        <TableCell>
                          {hazard.controls.map((control) => (
                            <Chip key={control.id} size="small" sx={{ mr: 0.5 }} label={CONTROL_SOURCE_LABELS[control.source]} variant="outlined" />
                          ))}
                        </TableCell>
                        <TableCell>
                          {hazard.risk ? (
                            <Chip size="small" color={hazard.risk.level === 'CRITICAL' ? 'error' : hazard.risk.level === 'HIGH' ? 'warning' : hazard.risk.level === 'MEDIUM' ? 'info' : 'success'} label={`${hazard.risk.title} · ${riskLevelLabels[hazard.risk.level]}`} />
                          ) : (
                            <Typography variant="caption" color="text.secondary">-</Typography>
                          )}
                        </TableCell>
                        {props.canManage && (
                          <TableCell align="right">
                            <IconButton size="small" title="Valorar (prob × sev)" onClick={() => { setProbability(val?.probability ?? 1); setSeverity(val?.severity ?? 1); setDialog({ kind: 'valoracion', hazardId: hazard.id }) }}>
                              <Percent />
                            </IconButton>
                            <IconButton size="small" title="Añadir control" onClick={() => { setSource('EPP'); setControlType(''); setEffective(''); setDialog({ kind: 'control', hazardId: hazard.id }) }}>
                              <Add />
                            </IconButton>
                            <IconButton
                              size="small" title="Generar riesgo" disabled={!val || !!hazard.risk}
                              onClick={() => { setText({ name: hazard.name, description: '' }); setDialog({ kind: 'risk', hazardId: hazard.id }) }}
                            >
                              <TrendingUp />
                            </IconButton>
                            <IconButton size="small" color="error" title="Eliminar peligro" onClick={() => void remove('hazards', hazard.id)}>
                              <Delete />
                            </IconButton>
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  }),
                ]) : [])])}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={!!dialog} onClose={() => setDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{dialogTitle()}</DialogTitle>
        <DialogContent dividers>
          {(dialog?.kind === 'process' || dialog?.kind === 'activity' || dialog?.kind === 'hazard' || dialog?.kind === 'risk') && (dialog.kind === 'risk' ? (
            <TextField autoFocus label="Título del riesgo" value={text.name} onChange={(event) => setText({ ...text, name: event.target.value })} sx={{ mt: 1 }} />
          ) : renderProcessNameInput())}
          {dialog?.kind === 'valoracion' && (
            <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
              <TextField select label="Probabilidad 1–5" value={probability} onChange={(event) => setProbability(Number(event.target.value))}>
                {[1, 2, 3, 4, 5].map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
              </TextField>
              <TextField select label="Severidad 1–5" value={severity} onChange={(event) => setSeverity(Number(event.target.value))}>
                {[1, 2, 3, 4, 5].map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
              </TextField>
            </Stack>
          )}
          {dialog?.kind === 'control' && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField select label="Fuente (numeral 5 GTC-45)" value={source} onChange={(event) => setSource(event.target.value as HazardControlSource)}>
                {CONTROL_SOURCES.map((s) => <MenuItem key={s} value={s}>{CONTROL_SOURCE_LABELS[s]}</MenuItem>)}
              </TextField>
              <TextField label="Tipo" value={controlType} onChange={(event) => setControlType(event.target.value)} />
              <TextField label="Efectividad" value={effective} onChange={(event) => setEffective(event.target.value)} />
            </Stack>
          )}
          {dialog?.kind === 'valoracion' && (
            <Box sx={{ mt: 2 }}>
              <Chip color={GTC_COLORS[deriveGtcLevel(probability, severity)]} label={`Nivel derivado: ${GTC_LABELS[deriveGtcLevel(probability, severity)]} → riesgo ${riskLevelLabels[RISK_FROM_GTC[deriveGtcLevel(probability, severity)]]}`} />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(null)}>Cancelar</Button>
          <Button variant="contained" disabled={saving || !text.name.trim()} onClick={() => void submit()}>Guardar</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  )
}
