import { Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField } from '@mui/material'
import type { Company, Role, UserFormValues } from '../../types'

export function UserDialog(props: {
  open: boolean
  editing: boolean
  values: UserFormValues
  companies: Company[]
  loading: boolean
  onChange: (values: UserFormValues) => void
  onClose: () => void
  onSave: () => void
}) {
  const needsCompany = props.values.role !== 'ADMIN'

  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{props.editing ? 'Editar usuario' : 'Nuevo usuario'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Nombre" value={props.values.name} onChange={(event) => props.onChange({ ...props.values, name: event.target.value })} required />
          <TextField label="Correo" type="email" value={props.values.email} onChange={(event) => props.onChange({ ...props.values, email: event.target.value })} required />
          {!props.editing && (
            <TextField label="Contrasena" type="password" value={props.values.password} onChange={(event) => props.onChange({ ...props.values, password: event.target.value })} helperText="Minimo 8 caracteres" required />
          )}
          <TextField
            select
            label="Rol"
            value={props.values.role}
            onChange={(event) =>
              props.onChange({
                ...props.values,
                role: event.target.value as Role,
                companyId: event.target.value === 'ADMIN' ? '' : props.values.companyId,
              })
            }
            required
          >
            {(['ADMIN', 'SST', 'EMPLOYEE', 'AUDITOR'] as Role[]).map((role) => (
              <MenuItem key={role} value={role}>
                {role}
              </MenuItem>
            ))}
          </TextField>
          <TextField select label="Empresa" value={props.values.companyId} disabled={!needsCompany} onChange={(event) => props.onChange({ ...props.values, companyId: event.target.value })} required={needsCompany}>
            {props.companies.map((company) => (
              <MenuItem key={company.id} value={company.id}>
                {company.name}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cancelar</Button>
        <Button
          variant="contained"
          disabled={props.loading || !props.values.name || !props.values.email || (!props.editing && props.values.password.length < 8) || (needsCompany && !props.values.companyId)}
          onClick={props.onSave}
        >
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  )
}
