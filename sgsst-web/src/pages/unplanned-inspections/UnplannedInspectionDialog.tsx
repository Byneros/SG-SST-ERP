import { Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField } from '@mui/material'
import type { Company, Site, SystemUser, UnplannedInspectionFormValues } from '../../types'

export function UnplannedInspectionDialog(props: {
  open: boolean
  editing: boolean
  values: UnplannedInspectionFormValues
  companies: Company[]
  sites: Site[]
  users: SystemUser[]
  loading: boolean
  canPickCompany: boolean
  onChange: (values: UnplannedInspectionFormValues) => void
  onClose: () => void
  onSave: () => void
}) {
  const siteOptions = props.sites.filter((site) => site.companyId === props.values.companyId)
  const userOptions = props.users.filter((u) => u.companyId === props.values.companyId)

  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{props.editing ? 'Editar inspeccion' : 'Nueva inspeccion no planeada'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Titulo"
            value={props.values.title}
            onChange={(event) => props.onChange({ ...props.values, title: event.target.value })}
            required
          />
          <TextField
            label="Motivo"
            value={props.values.reason}
            onChange={(event) => props.onChange({ ...props.values, reason: event.target.value })}
            required
            multiline
            minRows={2}
            helperText="Obligatorio: queja, incidente, cambio, visita de autoridad, COPASST..."
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
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
              helperText={siteOptions.length === 0 ? 'Sin sedes registradas' : undefined}
            >
              <MenuItem value="">Sin sede</MenuItem>
              {siteOptions.map((site) => (
                <MenuItem key={site.id} value={site.id}>{site.name}</MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Inspector"
              value={props.values.inspectorId}
              onChange={(event) => props.onChange({ ...props.values, inspectorId: event.target.value })}
            >
              <MenuItem value="">Sin inspector</MenuItem>
              {userOptions.map((u) => (
                <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>
              ))}
            </TextField>
          </Stack>
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
        <Button variant="contained" disabled={props.loading} onClick={props.onSave}>
          {props.editing ? 'Guardar' : 'Crear'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
