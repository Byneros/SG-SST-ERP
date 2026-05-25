import { Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField } from '@mui/material'
import {
  contractTypeLabels,
  contractTypeOptions,
  documentTypeLabels,
  documentTypeOptions,
  employmentStatusLabels,
  employmentStatusOptions,
} from '../../constants/catalogs'
import type { Company, ContractType, DocumentType, EmployeeFormValues, EmploymentStatus } from '../../types'

export function EmployeeDialog(props: {
  open: boolean
  editing: boolean
  values: EmployeeFormValues
  companies: Company[]
  loading: boolean
  canPickCompany: boolean
  onChange: (values: EmployeeFormValues) => void
  onClose: () => void
  onSave: () => void
}) {
  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{props.editing ? 'Editar empleado' : 'Nuevo empleado'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Nombres" value={props.values.firstName} onChange={(event) => props.onChange({ ...props.values, firstName: event.target.value })} required />
          <TextField label="Apellidos" value={props.values.lastName} onChange={(event) => props.onChange({ ...props.values, lastName: event.target.value })} required />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField select fullWidth label="Tipo documento" value={props.values.documentType} onChange={(event) => props.onChange({ ...props.values, documentType: event.target.value as DocumentType })} required>
              {documentTypeOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {documentTypeLabels[option]}
                </MenuItem>
              ))}
            </TextField>
            <TextField fullWidth label="Documento" value={props.values.document} onChange={(event) => props.onChange({ ...props.values, document: event.target.value })} required />
          </Stack>
          <TextField label="Cargo" value={props.values.position} onChange={(event) => props.onChange({ ...props.values, position: event.target.value })} required />
          <TextField label="Centro de trabajo" value={props.values.workCenter} onChange={(event) => props.onChange({ ...props.values, workCenter: event.target.value })} />
          <TextField select label="Tipo de contrato" value={props.values.contractType} onChange={(event) => props.onChange({ ...props.values, contractType: event.target.value as ContractType })}>
            {contractTypeOptions.map((option) => (
              <MenuItem key={option} value={option}>
                {contractTypeLabels[option]}
              </MenuItem>
            ))}
          </TextField>
          <TextField select label="Estado laboral" value={props.values.employmentStatus} onChange={(event) => props.onChange({ ...props.values, employmentStatus: event.target.value as EmploymentStatus })}>
            {employmentStatusOptions.map((option) => (
              <MenuItem key={option} value={option}>
                {employmentStatusLabels[option]}
              </MenuItem>
            ))}
          </TextField>
          <TextField type="date" label="Fecha de ingreso" InputLabelProps={{ shrink: true }} value={props.values.hireDate} onChange={(event) => props.onChange({ ...props.values, hireDate: event.target.value })} />
          <TextField select label="Empresa" value={props.values.companyId} disabled={!props.canPickCompany} onChange={(event) => props.onChange({ ...props.values, companyId: event.target.value })} required>
            {props.companies.map((company) => (
              <MenuItem key={company.id} value={company.id}>
                {company.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField label="Correo" value={props.values.email} onChange={(event) => props.onChange({ ...props.values, email: event.target.value })} />
          <TextField label="Telefono" value={props.values.phone} onChange={(event) => props.onChange({ ...props.values, phone: event.target.value })} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cancelar</Button>
        <Button
          variant="contained"
          disabled={props.loading || !props.values.firstName || !props.values.lastName || !props.values.document || !props.values.position || !props.values.companyId}
          onClick={props.onSave}
        >
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  )
}
