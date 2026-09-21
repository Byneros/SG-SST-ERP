import { Add, Save } from '@mui/icons-material'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { useEffect, useState } from 'react'
import type { Company, Indicator, IndicatorDirection, IndicatorFormValues, Site } from '../../types'

const directions: IndicatorDirection[] = ['LOWER_IS_BETTER', 'HIGHER_IS_BETTER']

type TargetDraft = { id?: string; period: string; target: string }
type MeasurementDraft = { id?: string; period: string; value: string; notes: string }

export function IndicatorDialog(props: {
  open: boolean
  editing: boolean
  values: IndicatorFormValues
  companies: Company[]
  sites: Site[]
  indicator?: Indicator
  loading: boolean
  canPickCompany: boolean
  canManage: boolean
  onChange: (values: IndicatorFormValues) => void
  onClose: () => void
  onSave: () => void
  onSetTargets: (indicatorId: string, targets: { period: string; target: number }[]) => void
  onAddMeasurement: (indicatorId: string, payload: { measurements: { period: string; value: number; notes?: string }[] }) => void
}) {
  const [targets, setTargets] = useState<TargetDraft[]>([])
  const [measurements, setMeasurements] = useState<MeasurementDraft[]>([])
  const [measurementDraft, setMeasurementDraft] = useState({ period: '', value: '', notes: '' })

  // Version del backend (id + updatedAt): reinicia los borradores al abrir el
  // dialogo o cuando un guardado trae metas/mediciones nuevas del servidor.
  const indicatorVersion = `${props.indicator?.id ?? ''}:${props.indicator?.updatedAt ?? ''}`
  useEffect(() => {
    setTargets((props.indicator?.targets ?? []).map((target) => ({ id: target.id, period: target.period, target: String(target.target) })))
    setMeasurements((props.indicator?.measurements ?? []).map((measurement) => ({ id: measurement.id, period: measurement.period, value: String(measurement.value), notes: measurement.notes ?? '' })))
    setMeasurementDraft({ period: '', value: '', notes: '' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicatorVersion])

  const indicatorId = props.indicator?.id ?? ''

  /** Upsert de metas: reenvia existentes + agrega filas nuevas. */
  function pushTargets() {
    if (!indicatorId) return
    const payload = targets
      .filter((row) => row.period.trim() !== '' && row.target.trim() !== '')
      .map((row) => ({ period: row.period.trim(), target: Number(row.target) }))
    if (payload.length === 0) return
    props.onSetTargets(indicatorId, payload)
  }

  /** Upsert de mediciones: filas existentes modificadas + filas nuevas. */
  function pushMeasurements() {
    if (!indicatorId) return
    const payload = measurements
      .filter((row) => row.period.trim() !== '' && row.value.trim() !== '')
      .map((row) => ({ period: row.period.trim(), value: Number(row.value), notes: row.notes.trim() || undefined }))
    if (payload.length === 0) return
    props.onAddMeasurement(indicatorId, { measurements: payload })
  }

  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{props.editing ? 'Editar indicador' : 'Nuevo indicador SG-SST'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Nombre" value={props.values.name} onChange={(event) => props.onChange({ ...props.values, name: event.target.value })} required />
          <TextField label="Codigo" value={props.values.code} onChange={(event) => props.onChange({ ...props.values, code: event.target.value })} />
          <TextField label="Unidad" value={props.values.unit} onChange={(event) => props.onChange({ ...props.values, unit: event.target.value })} />
          <TextField label="Formula" value={props.values.formulaDefinition} onChange={(event) => props.onChange({ ...props.values, formulaDefinition: event.target.value })} />
          <TextField select label="Direccion" value={props.values.direction} onChange={(event) => props.onChange({ ...props.values, direction: event.target.value as IndicatorDirection })}>
            {directions.map((direction) => (
              <MenuItem key={direction} value={direction}>{direction === 'HIGHER_IS_BETTER' ? 'Mayor es mejor' : 'Menor es mejor'}</MenuItem>
            ))}
          </TextField>
          <TextField label="Descripcion" value={props.values.description} onChange={(event) => props.onChange({ ...props.values, description: event.target.value })} multiline minRows={2} />
          <TextField
            select
            label="Sede"
            value={props.values.siteId}
            onChange={(event) => props.onChange({ ...props.values, siteId: event.target.value })}
          >
            <MenuItem value="">Sin sede (toda la empresa)</MenuItem>
            {props.sites.map((site) => (
              <MenuItem key={site.id} value={site.id}>{site.name}</MenuItem>
            ))}
          </TextField>
          <TextField select label="Empresa" value={props.values.companyId} disabled={!props.canPickCompany} onChange={(event) => props.onChange({ ...props.values, companyId: event.target.value })} required>
            {props.companies.map((company) => (
              <MenuItem key={company.id} value={company.id}>{company.name}</MenuItem>
            ))}
          </TextField>

          {props.editing && (
            <Box>
              <Divider sx={{ mb: 1.5 }} />
              <Typography variant="subtitle2">Metas por periodo</Typography>
              {targets.map((row, index) => (
                <Stack key={row.id ?? `target-${index}`} direction="row" spacing={1} sx={{ mt: 1 }}>
                  <TextField size="small" label="Periodo" value={row.period} sx={{ flex: 1 }} onChange={(event) => setTargets((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, period: event.target.value } : item)))} />
                  <TextField size="small" type="number" label="Meta" value={row.target} sx={{ maxWidth: 120 }} onChange={(event) => setTargets((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, target: event.target.value } : item)))} />
                </Stack>
              ))}
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Button size="small" startIcon={<Add />} disabled={!props.canManage} onClick={() => setTargets((current) => [...current, { period: '', target: '' }])}>Agregar meta</Button>
                <Button size="small" startIcon={<Save />} disabled={props.loading || !props.canManage} onClick={pushTargets}>Guardar metas</Button>
                <Tooltip title="El upsert reemplaza la meta de cada periodo enviado">
                  <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>upsert por periodo</Typography>
                </Tooltip>
              </Stack>

              <Divider sx={{ mt: 2.5, mb: 1.5 }} />
              <Typography variant="subtitle2">Mediciones</Typography>
              {measurements.map((row, index) => (
                <Stack key={row.id ?? `measurement-${index}`} direction="row" spacing={1} sx={{ mt: 1 }}>
                  <TextField size="small" label="Periodo" value={row.period} sx={{ flex: 1 }} onChange={(event) => setMeasurements((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, period: event.target.value } : item)))} />
                  <TextField size="small" type="number" label="Valor" value={row.value} sx={{ maxWidth: 110 }} onChange={(event) => setMeasurements((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, value: event.target.value } : item)))} />
                  <TextField size="small" label="Notas" value={row.notes} sx={{ flex: 2 }} onChange={(event) => setMeasurements((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, notes: event.target.value } : item)))} />
                </Stack>
              ))}
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                <Button size="small" startIcon={<Add />} disabled={!props.canManage} onClick={() => setMeasurements((current) => [...current, { period: '', value: '', notes: '' }])}>Agregar fila</Button>
                <Button size="small" startIcon={<Save />} disabled={props.loading || !props.canManage} onClick={pushMeasurements}>Guardar mediciones</Button>
              </Stack>

              <Divider sx={{ mt: 2.5, mb: 1.5 }} />
              <Typography variant="subtitle2">Registrar medicion rapida</Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1 }}>
                <TextField size="small" label="Periodo" value={measurementDraft.period} onChange={(event) => setMeasurementDraft((current) => ({ ...current, period: event.target.value }))} />
                <TextField size="small" type="number" label="Valor" value={measurementDraft.value} onChange={(event) => setMeasurementDraft((current) => ({ ...current, value: event.target.value }))} />
                <TextField size="small" label="Notas" value={measurementDraft.notes} sx={{ flex: 1 }} onChange={(event) => setMeasurementDraft((current) => ({ ...current, notes: event.target.value }))} />
                <Button
                  variant="outlined"
                  disabled={props.loading || !props.canManage || !measurementDraft.period.trim() || measurementDraft.value === ''}
                  onClick={() => {
                    props.onAddMeasurement(indicatorId, {
                      measurements: [{ period: measurementDraft.period.trim(), value: Number(measurementDraft.value), notes: measurementDraft.notes.trim() || undefined }],
                    })
                    setMeasurementDraft({ period: '', value: '', notes: '' })
                  }}
                >
                  Registrar
                </Button>
              </Stack>
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
