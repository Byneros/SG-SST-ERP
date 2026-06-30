import { Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField } from '@mui/material'
import type { AuditStatus, Company, SgsstAuditFormValues } from '../../types'

const auditStatuses: AuditStatus[] = ['PLANNED', 'IN_PROGRESS', 'CLOSED', 'CANCELLED']

export function SgsstAuditDialog(props: {
  open: boolean
  editing: boolean
  values: SgsstAuditFormValues
  companies: Company[]
  loading: boolean
  canPickCompany: boolean
  onChange: (values: SgsstAuditFormValues) => void
  onClose: () => void
  onSave: () => void
}) {
  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{props.editing ? 'Editar auditoria' : 'Nueva auditoria SG-SST'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Titulo" value={props.values.title} onChange={(event) => props.onChange({ ...props.values, title: event.target.value })} required />
          <TextField label="Descripcion" value={props.values.description} onChange={(event) => props.onChange({ ...props.values, description: event.target.value })} multiline minRows={2} />
          <TextField label="Alcance" value={props.values.scope} onChange={(event) => props.onChange({ ...props.values, scope: event.target.value })} />
          <TextField label="Auditor" value={props.values.auditorName} onChange={(event) => props.onChange({ ...props.values, auditorName: event.target.value })} />
          <TextField type="date" label="Fecha programada" InputLabelProps={{ shrink: true }} value={props.values.scheduledAt} onChange={(event) => props.onChange({ ...props.values, scheduledAt: event.target.value })} required />
          <TextField select label="Estado" value={props.values.status} onChange={(event) => props.onChange({ ...props.values, status: event.target.value as AuditStatus })}>
            {auditStatuses.map((status) => <MenuItem key={status} value={status}>{status}</MenuItem>)}
          </TextField>
          <TextField label="Resultado" value={props.values.result} onChange={(event) => props.onChange({ ...props.values, result: event.target.value })} />
          <TextField select label="Empresa" value={props.values.companyId} disabled={!props.canPickCompany} onChange={(event) => props.onChange({ ...props.values, companyId: event.target.value })} required>
            {props.companies.map((company) => <MenuItem key={company.id} value={company.id}>{company.name}</MenuItem>)}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cancelar</Button>
        <Button variant="contained" disabled={props.loading || !props.values.title || !props.values.scheduledAt || !props.values.companyId} onClick={props.onSave}>Guardar</Button>
      </DialogActions>
    </Dialog>
  )
}
