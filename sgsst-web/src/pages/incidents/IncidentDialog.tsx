import { Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField } from '@mui/material'
import { incidentStatusLabels, incidentStatusOptions } from '../../constants/catalogs'
import type { Company, IncidentFormValues, IncidentStatus } from '../../types'

export function IncidentDialog(props: {
  open: boolean
  editing: boolean
  values: IncidentFormValues
  companies: Company[]
  loading: boolean
  canPickCompany: boolean
  onChange: (values: IncidentFormValues) => void
  onClose: () => void
  onSave: () => void
}) {
  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{props.editing ? 'Editar incidente' : 'Nuevo incidente'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Titulo"
            value={props.values.title}
            onChange={(event) => props.onChange({ ...props.values, title: event.target.value })}
            required
          />
          <TextField
            label="Descripcion"
            value={props.values.description}
            onChange={(event) => props.onChange({ ...props.values, description: event.target.value })}
            multiline
            minRows={3}
            required
          />
          <TextField
            type="date"
            label="Fecha del incidente"
            InputLabelProps={{ shrink: true }}
            value={props.values.date}
            onChange={(event) => props.onChange({ ...props.values, date: event.target.value })}
            required
          />
          {props.editing && (
            <TextField
              select
              label="Estado"
              value={props.values.status}
              onChange={(event) => props.onChange({ ...props.values, status: event.target.value as IncidentStatus })}
            >
              {incidentStatusOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {incidentStatusLabels[option]}
                </MenuItem>
              ))}
            </TextField>
          )}
          {props.canPickCompany ? (
            <TextField
              select
              label="Empresa"
              value={props.values.companyId}
              disabled={props.companies.length === 0}
              onChange={(event) => props.onChange({ ...props.values, companyId: event.target.value })}
              required
            >
              {props.companies.map((company) => (
                <MenuItem key={company.id} value={company.id}>
                  {company.name}
                </MenuItem>
              ))}
            </TextField>
          ) : (
            <TextField
              label="Empresa"
              value={props.companies.find((company) => company.id === props.values.companyId)?.name || props.values.companyId}
              InputProps={{ readOnly: true }}
              helperText="Empresa asignada según tu sesión"
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cancelar</Button>
        <Button
          variant="contained"
          disabled={props.loading || !props.values.title || !props.values.description || !props.values.date || !props.values.companyId}
          onClick={props.onSave}
        >
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  )
}
