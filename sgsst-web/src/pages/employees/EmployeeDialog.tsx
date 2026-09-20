import { Button, Dialog, DialogActions, DialogContent, DialogTitle, ListItemText, MenuItem, Stack, TextField } from '@mui/material'
import {
  contractTypeLabels,
  contractTypeOptions,
  documentTypeLabels,
  documentTypeOptions,
  employmentStatusLabels,
  employmentStatusOptions,
} from '../../constants/catalogs'
import type { Company, ContractType, DocumentType, EmployeeFormValues, EmploymentStatus, Site } from '../../types'

export function EmployeeDialog(props: {
  open: boolean
  editing: boolean
  values: EmployeeFormValues
  companies: Company[]
  sites: Site[]
  loading: boolean
  canPickCompany: boolean
  documentError?: string
  onChange: (values: EmployeeFormValues) => void
  onClose: () => void
  onSave: () => void
}) {
  const emailInvalid = props.values.email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(props.values.email)
  const companyMissing = !props.values.companyId && props.companies.length > 0
  const selectedCompanyName = props.companies.find((company) => company.id === props.values.companyId)?.name ?? ''
  // Sedes de la empresa seleccionada: cambiar empresa limpia la sede elegida.
  const siteOptions = props.sites.filter((site) => site.companyId === props.values.companyId)

  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{props.editing ? 'Editar empleado' : 'Nuevo empleado'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Nombres"
            value={props.values.firstName}
            onChange={(event) => props.onChange({ ...props.values, firstName: event.target.value })}
            required
          />
          <TextField
            label="Apellidos"
            value={props.values.lastName}
            onChange={(event) => props.onChange({ ...props.values, lastName: event.target.value })}
            required
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              select
              fullWidth
              label="Tipo documento"
              value={props.values.documentType}
              onChange={(event) => props.onChange({ ...props.values, documentType: event.target.value as DocumentType })}
              required
            >
              {documentTypeOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {documentTypeLabels[option]}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              fullWidth
              label="Documento"
              value={props.values.document}
              onChange={(event) => props.onChange({ ...props.values, document: event.target.value })}
              required
            />
          </Stack>
          <TextField
            label="Cargo"
            value={props.values.position}
            onChange={(event) => props.onChange({ ...props.values, position: event.target.value })}
            required
          />
          <TextField
            label="Centro de trabajo"
            value={props.values.workCenter}
            onChange={(event) => props.onChange({ ...props.values, workCenter: event.target.value })}
          />
          <TextField
            select
            label="Sede"
            value={props.values.siteId}
            onChange={(event) => props.onChange({ ...props.values, siteId: event.target.value })}
            helperText={
              siteOptions.length === 0
                ? 'Sin sedes registradas para esta empresa. Crea una en el módulo Sedes.'
                : 'Sede donde el empleado presta sus funciones.'
            }
          >
            <MenuItem value="">
              <ListItemText>Sin sede</ListItemText>
            </MenuItem>
            {siteOptions.map((site) => (
              <MenuItem key={site.id} value={site.id}>
                <ListItemText>{site.code ? `${site.name} (${site.code})` : site.name}</ListItemText>
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Tipo de contrato"
            value={props.values.contractType}
            onChange={(event) => props.onChange({ ...props.values, contractType: event.target.value as ContractType })}
            required
          >
            {contractTypeOptions.map((option) => (
              <MenuItem key={option} value={option}>
                {contractTypeLabels[option]}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Estado laboral"
            value={props.values.employmentStatus}
            onChange={(event) => props.onChange({ ...props.values, employmentStatus: event.target.value as EmploymentStatus })}
            required
          >
            {employmentStatusOptions.map((option) => (
              <MenuItem key={option} value={option}>
                {employmentStatusLabels[option]}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            type="date"
            label="Fecha de ingreso"
            InputLabelProps={{ shrink: true }}
            value={props.values.hireDate}
            onChange={(event) => props.onChange({ ...props.values, hireDate: event.target.value })}
          />
          {props.canPickCompany ? (
            <TextField
              select
              label="Empresa"
              value={props.values.companyId}
              disabled={props.companies.length === 0}
              onChange={(event) =>
                props.onChange({
                  ...props.values,
                  companyId: event.target.value,
                  // La sede pertenece a la empresa: al cambiarla se desasigna.
                  siteId: '',
                })
              }
              required
              error={companyMissing}
              helperText={
                props.companies.length === 0
                  ? 'Crea una empresa antes de asignar este empleado.'
                  : companyMissing
                  ? 'Selecciona una empresa.'
                  : 'Selecciona la empresa a la que pertenece este empleado.'
              }
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
              value={selectedCompanyName || props.values.companyId}
              InputProps={{ readOnly: true }}
              helperText="Empresa asignada según tu sesión"
            />
          )}
          <TextField
            label="Correo"
            type="email"
            value={props.values.email}
            error={emailInvalid}
            helperText={emailInvalid ? 'Ingresa un correo válido o deja el campo vacío.' : ''}
            onChange={(event) => props.onChange({ ...props.values, email: event.target.value })}
          />
          <TextField
            label="Teléfono"
            type="tel"
            value={props.values.phone}
            onChange={(event) => props.onChange({ ...props.values, phone: event.target.value })}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cancelar</Button>
        <Button
          variant="contained"
          disabled={
            props.loading ||
            !props.values.firstName ||
            !props.values.lastName ||
            !props.values.document ||
            !props.values.position ||
            !props.values.companyId ||
            emailInvalid
          }
          onClick={props.onSave}
        >
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  )
}
