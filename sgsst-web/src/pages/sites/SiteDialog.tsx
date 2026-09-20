import { Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Stack, TextField } from '@mui/material'
import type { Company, SiteFormValues } from '../../types'

export function SiteDialog(props: {
  open: boolean
  editing: boolean
  values: SiteFormValues
  companies: Company[]
  loading: boolean
  canPickCompany: boolean
  onChange: (values: SiteFormValues) => void
  onClose: () => void
  onSave: () => void
}) {
  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{props.editing ? 'Editar sede' : 'Nueva sede'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Nombre"
            value={props.values.name}
            onChange={(event) => props.onChange({ ...props.values, name: event.target.value })}
            required
          />
          <TextField
            label="Codigo"
            value={props.values.code}
            onChange={(event) => props.onChange({ ...props.values, code: event.target.value })}
          />
          <TextField
            label="Direccion"
            value={props.values.address}
            onChange={(event) => props.onChange({ ...props.values, address: event.target.value })}
          />
          <Stack direction="row" spacing={2}>
            <TextField
              label="Ciudad"
              value={props.values.city}
              onChange={(event) => props.onChange({ ...props.values, city: event.target.value })}
              fullWidth
            />
            <TextField
              label="Departamento"
              value={props.values.department}
              onChange={(event) => props.onChange({ ...props.values, department: event.target.value })}
              fullWidth
            />
          </Stack>
          <FormControlLabel
            control={
              <Checkbox
                checked={props.values.isMain}
                onChange={(event) => props.onChange({ ...props.values, isMain: event.target.checked })}
              />
            }
            label="Sede principal"
          />
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
          disabled={props.loading || !props.values.name.trim() || !props.values.companyId}
          onClick={props.onSave}
        >
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  )
}
