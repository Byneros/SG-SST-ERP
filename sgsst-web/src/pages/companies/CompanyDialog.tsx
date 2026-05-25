import { Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField } from '@mui/material'
import { riskClassLabels, riskClassOptions } from '../../constants/catalogs'
import type { CompanyFormValues, CompanyRiskClass } from '../../types'

export function CompanyDialog(props: {
  open: boolean
  editing: boolean
  values: CompanyFormValues
  loading: boolean
  onChange: (values: CompanyFormValues) => void
  onClose: () => void
  onSave: () => void
}) {
  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{props.editing ? 'Editar empresa' : 'Nueva empresa'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Razon social" value={props.values.name} onChange={(event) => props.onChange({ ...props.values, name: event.target.value })} required />
          <TextField label="NIT" value={props.values.nit} helperText="Formato: 900123456-7, sin puntos" onChange={(event) => props.onChange({ ...props.values, nit: event.target.value })} required />
          <TextField label="ARL" value={props.values.arl} onChange={(event) => props.onChange({ ...props.values, arl: event.target.value })} />
          <TextField
            select
            label="Clase de riesgo"
            value={props.values.riskClass}
            onChange={(event) => props.onChange({ ...props.values, riskClass: event.target.value as CompanyRiskClass })}
          >
            {riskClassOptions.map((option) => (
              <MenuItem key={option} value={option}>
                {riskClassLabels[option]}
              </MenuItem>
            ))}
          </TextField>
          <TextField label="Actividad economica" value={props.values.economicActivity} onChange={(event) => props.onChange({ ...props.values, economicActivity: event.target.value })} />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField fullWidth label="Ciudad" value={props.values.city} onChange={(event) => props.onChange({ ...props.values, city: event.target.value })} />
            <TextField fullWidth label="Departamento" value={props.values.department} onChange={(event) => props.onChange({ ...props.values, department: event.target.value })} />
          </Stack>
          <TextField label="Direccion" value={props.values.address} onChange={(event) => props.onChange({ ...props.values, address: event.target.value })} />
          <TextField label="Telefono" value={props.values.phone} onChange={(event) => props.onChange({ ...props.values, phone: event.target.value })} />
          <TextField label="Correo" type="email" value={props.values.email} onChange={(event) => props.onChange({ ...props.values, email: event.target.value })} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cancelar</Button>
        <Button variant="contained" disabled={props.loading || !props.values.name || !props.values.nit} onClick={props.onSave}>
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  )
}
