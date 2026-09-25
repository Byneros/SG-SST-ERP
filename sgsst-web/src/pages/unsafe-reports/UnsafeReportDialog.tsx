import { Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, Switch, TextField, FormControlLabel, Typography } from '@mui/material'
import type { Company, Site, UnsafeReportFormValues } from '../../types'

export function UnsafeReportDialog(props: {
  open: boolean
  editing: boolean
  values: UnsafeReportFormValues
  companies: Company[]
  sites: Site[]
  loading: boolean
  canPickCompany: boolean
  canManage: boolean
  onChange: (values: UnsafeReportFormValues) => void
  onClose: () => void
  onSave: () => void
}) {
  const siteOptions = props.sites.filter((site) => site.companyId === props.values.companyId)

  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{props.editing ? 'Editar reporte' : 'Reportar acto o condicion insegura'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            select
            label="Tipo"
            value={props.values.kind}
            disabled={props.editing}
            onChange={(event) => props.onChange({ ...props.values, kind: event.target.value as UnsafeReportFormValues['kind'] })}
          >
            <MenuItem value="UNSAFE_ACT">Acto inseguro (comportamiento)</MenuItem>
            <MenuItem value="UNSAFE_CONDITION">Condicion insegura (lugar/equipo)</MenuItem>
          </TextField>
          <TextField
            label="Descripcion"
            value={props.values.description}
            onChange={(event) => props.onChange({ ...props.values, description: event.target.value })}
            required
            multiline
            minRows={3}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              select
              label="Severidad"
              value={props.values.severity}
              onChange={(event) => props.onChange({ ...props.values, severity: event.target.value as UnsafeReportFormValues['severity'] })}
              sx={{ maxWidth: 180 }}
            >
              <MenuItem value="MINOR">Menor</MenuItem>
              <MenuItem value="MAJOR">Mayor</MenuItem>
              <MenuItem value="CRITICAL">Critico</MenuItem>
            </TextField>
            <TextField
              label="Area"
              value={props.values.area}
              onChange={(event) => props.onChange({ ...props.values, area: event.target.value })}
            />
            <TextField
              select
              label="Sede"
              value={props.values.siteId}
              onChange={(event) => props.onChange({ ...props.values, siteId: event.target.value })}
            >
              <MenuItem value="">Sin sede</MenuItem>
              {siteOptions.map((site) => (
                <MenuItem key={site.id} value={site.id}>{site.name}</MenuItem>
              ))}
            </TextField>
          </Stack>
          {!props.editing && (
            <FormControlLabel
              control={
                <Switch
                  checked={props.values.isAnonymous}
                  onChange={(event) => props.onChange({ ...props.values, isAnonymous: event.target.checked })}
                />
              }
              label={
                <Typography variant="body2">
                  Reporte anonimo (no se guarda tu identidad ni el nombre declarado)
                </Typography>
              }
            />
          )}
          {!props.values.isAnonymous && !props.editing && (
            <TextField
              label="Nombre del reportante (opcional)"
              value={props.values.reporterName}
              onChange={(event) => props.onChange({ ...props.values, reporterName: event.target.value })}
            />
          )}
          <TextField
            select
            label="Empresa"
            value={props.values.companyId}
            disabled={!props.canPickCompany}
            onChange={(event) => props.onChange({ ...props.values, companyId: event.target.value })}
            required
          >
            {props.companies.map((company) => (
              <MenuItem key={company.id} value={company.id}>{company.name}</MenuItem>
            ))}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cancelar</Button>
        <Button variant="contained" disabled={props.loading || !props.values.description.trim()} onClick={props.onSave}>
          {props.editing ? 'Guardar' : 'Enviar reporte'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
