import { Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from '@mui/material'
import type { Company, ContractorDocument, ContractorDocumentFormValues, ContractorDocumentStatus, ContractorFormValues, ContractorWorker, ContractorWorkerFormValues, ContractorWorkerStatus, Site } from '../../types'

const contractorStatuses: Array<{ value: ContractorFormValues['status']; label: string }> = [
  { value: 'ACTIVE', label: 'Activo' },
  { value: 'SUSPENDED', label: 'Suspendido' },
  { value: 'BLOCKED', label: 'Bloqueado' },
]

const workerStatuses: Array<{ value: ContractorWorkerStatus; label: string }> = [
  { value: 'ACTIVE', label: 'Activo' },
  { value: 'INACTIVE', label: 'Inactivo' },
]

const documentStatuses: Array<{ value: ContractorDocumentStatus; label: string }> = [
  { value: 'PENDING', label: 'Pendiente' },
  { value: 'VALID', label: 'Válido' },
  { value: 'EXPIRED', label: 'Vencido' },
  { value: 'REJECTED', label: 'Rechazado' },
]

function CompanyPicker<T extends { companyId: string }>(props: {
  values: T
  companies: Company[]
  canPickCompany: boolean
  onChange: (values: T) => void
}) {
  if (props.canPickCompany) {
    return (
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
    )
  }
  return (
    <TextField
      label="Empresa"
      value={props.companies.find((company) => company.id === props.values.companyId)?.name || props.values.companyId}
      InputProps={{ readOnly: true }}
      helperText="Empresa asignada según tu sesión"
    />
  )
}

export function ContractorDialog(props: {
  open: boolean
  editing: boolean
  values: ContractorFormValues
  companies: Company[]
  loading: boolean
  canPickCompany: boolean
  onChange: (values: ContractorFormValues) => void
  onClose: () => void
  onSave: () => void
}) {
  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{props.editing ? 'Editar contratista' : 'Nuevo contratista'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Razón social"
            value={props.values.name}
            onChange={(event) => props.onChange({ ...props.values, name: event.target.value })}
            required
          />
          <TextField
            label="NIT"
            value={props.values.nit}
            onChange={(event) => props.onChange({ ...props.values, nit: event.target.value })}
            required
          />
          <Stack direction="row" spacing={2}>
            <TextField
              label="Contacto"
              value={props.values.contact}
              onChange={(event) => props.onChange({ ...props.values, contact: event.target.value })}
              fullWidth
            />
            <TextField
              label="Teléfono"
              value={props.values.phone}
              onChange={(event) => props.onChange({ ...props.values, phone: event.target.value })}
              fullWidth
            />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField
              label="ARL"
              value={props.values.arl}
              onChange={(event) => props.onChange({ ...props.values, arl: event.target.value })}
              fullWidth
            />
            <TextField
              label="Actividad económica"
              value={props.values.activity}
              onChange={(event) => props.onChange({ ...props.values, activity: event.target.value })}
              fullWidth
            />
          </Stack>
          <TextField
            select
            label="Estado"
            value={props.values.status}
            onChange={(event) => props.onChange({ ...props.values, status: event.target.value as ContractorFormValues['status'] })}
          >
            {contractorStatuses.map((status) => (
              <MenuItem key={status.value} value={status.value}>
                {status.label}
              </MenuItem>
            ))}
          </TextField>
          <CompanyPicker values={props.values} companies={props.companies} canPickCompany={props.canPickCompany} onChange={props.onChange} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cancelar</Button>
        <Button
          variant="contained"
          disabled={props.loading || !props.values.name.trim() || !props.values.nit.trim() || !props.values.companyId}
          onClick={props.onSave}
        >
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export function ContractorWorkerDialog(props: {
  open: boolean
  editing: boolean
  values: ContractorWorkerFormValues
  companies: Company[]
  /** S13.2: sedes de la empresa para vincular Contratista -> Trabajador -> Sede. */
  sites: Site[]
  loading: boolean
  canPickCompany: boolean
  onChange: (values: ContractorWorkerFormValues) => void
  onClose: () => void
  onSave: () => void
}) {
  const workerSites = props.sites.filter((site) => site.companyId === props.values.companyId && site.isActive)
  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{props.editing ? 'Editar personal' : 'Nuevo personal del contratista'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Nombres"
              value={props.values.firstName}
              onChange={(event) => props.onChange({ ...props.values, firstName: event.target.value })}
              required
              fullWidth
            />
            <TextField
              label="Apellidos"
              value={props.values.lastName}
              onChange={(event) => props.onChange({ ...props.values, lastName: event.target.value })}
              required
              fullWidth
            />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Documento"
              value={props.values.document}
              onChange={(event) => props.onChange({ ...props.values, document: event.target.value })}
              required
              fullWidth
            />
            <TextField
              label="Actividad / cargo"
              value={props.values.job}
              onChange={(event) => props.onChange({ ...props.values, job: event.target.value })}
              helperText="Actividad que ejecuta en la sede"
              fullWidth
            />
          </Stack>
          <TextField
            select
            label="Sede"
            value={props.values.siteId}
            onChange={(event) => props.onChange({ ...props.values, siteId: event.target.value })}
            helperText="Sede donde ejecuta su actividad (#35)"
          >
            <MenuItem value="">Sin sede asignada</MenuItem>
            {workerSites.map((site) => (
              <MenuItem key={site.id} value={site.id}>
                {site.name}
                {site.code ? ` (${site.code})` : ''}
              </MenuItem>
            ))}
          </TextField>
          <Stack direction="row" spacing={2}>
            <TextField
              label="Fecha de inducción"
              type="date"
              value={props.values.inductedAt}
              onChange={(event) => props.onChange({ ...props.values, inductedAt: event.target.value })}
              InputLabelProps={{ shrink: true }}
              helperText="Sin fecha = sin inducción (bloquea el ingreso)"
              fullWidth
            />
            <TextField
              select
              label="Estado"
              value={props.values.status}
              onChange={(event) => props.onChange({ ...props.values, status: event.target.value as ContractorWorkerStatus })}
              fullWidth
            >
              {workerStatuses.map((status) => (
                <MenuItem key={status.value} value={status.value}>
                  {status.label}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <CompanyPicker values={props.values} companies={props.companies} canPickCompany={props.canPickCompany} onChange={props.onChange} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cancelar</Button>
        <Button
          variant="contained"
          disabled={props.loading || !props.values.firstName.trim() || !props.values.lastName.trim() || !props.values.document.trim() || !props.values.companyId}
          onClick={props.onSave}
        >
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export function ContractorDocumentDialog(props: {
  open: boolean
  editing: boolean
  values: ContractorDocumentFormValues
  companies: Company[]
  loading: boolean
  canPickCompany: boolean
  onChange: (values: ContractorDocumentFormValues) => void
  onClose: () => void
  onSave: () => void
}) {
  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{props.editing ? 'Editar documento' : 'Nuevo documento del contratista'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Tipo de documento"
            value={props.values.documentType}
            onChange={(event) => props.onChange({ ...props.values, documentType: event.target.value })}
            helperText="P. ej. ARL, afiliación a seguridad social, certificado de inducción"
            required
          />
          <TextField
            label="Descripción"
            value={props.values.description}
            onChange={(event) => props.onChange({ ...props.values, description: event.target.value })}
            multiline
            minRows={2}
          />
          <Stack direction="row" spacing={2}>
            <TextField
              label="Fecha de vencimiento"
              type="date"
              value={props.values.expiresAt}
              onChange={(event) => props.onChange({ ...props.values, expiresAt: event.target.value })}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              select
              label="Estado"
              value={props.values.status}
              onChange={(event) => props.onChange({ ...props.values, status: event.target.value as ContractorDocumentStatus })}
              fullWidth
            >
              {documentStatuses.map((status) => (
                <MenuItem key={status.value} value={status.value}>
                  {status.label}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <CompanyPicker values={props.values} companies={props.companies} canPickCompany={props.canPickCompany} onChange={props.onChange} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cancelar</Button>
        <Button
          variant="contained"
          disabled={props.loading || !props.values.documentType.trim() || !props.values.companyId}
          onClick={props.onSave}
        >
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  )
}

type ContractorDetailTarget = { id: string; name: string }

export function ContractorDetailDialog(props: {
  contractor: ContractorDetailTarget | null
  workers: ContractorWorker[]
  documents: ContractorDocument[]
  loading: boolean
  canManage: boolean
  onAddWorker: () => void
  onEditWorker: (worker: ContractorWorker) => void
  onDeleteWorker: (worker: ContractorWorker) => void
  onAddDocument: () => void
  onEditDocument: (document: ContractorDocument) => void
  onDeleteDocument: (document: ContractorDocument) => void
  onClose: () => void
}) {
  return (
    <Dialog open={props.contractor !== null} onClose={props.onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {props.contractor ? `${props.contractor.name} — personal y documentos` : 'Contratista'}
      </DialogTitle>
      <DialogContent dividers>
        {props.loading && (
          <Typography variant="body2" color="text.secondary">
            Cargando detalle...
          </Typography>
        )}
        {!props.loading && props.contractor && (
          <Stack spacing={3}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle2">Personal ({props.workers.length})</Typography>
              {props.canManage && (
                <Button size="small" variant="contained" onClick={props.onAddWorker}>
                  Agregar
                </Button>
              )}
            </Stack>
            <Stack spacing={1}>
              {props.workers.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  Sin personal registrado (bloquea la autorización de ingreso).
                </Typography>
              )}
              {props.workers.map((worker) => (
                <Stack key={worker.id} direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                  <Typography variant="body2">
                    {worker.firstName} {worker.lastName} — {worker.document}
                    {worker.job ? ` (${worker.job})` : ''}
                    {worker.site ? ` · Sede: ${worker.site.name}` : ''}
                  </Typography>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Chip
                      size="small"
                      label={worker.inductedAt ? `Inducido ${new Date(worker.inductedAt).toLocaleDateString()}` : 'Sin inducción'}
                      color={worker.inductedAt ? 'success' : 'warning'}
                      variant="outlined"
                    />
                    {props.canManage && (
                      <>
                        <DialogActionButton label="Editar" onClick={() => props.onEditWorker(worker)} />
                        <DialogActionButton label="Eliminar" onClick={() => props.onDeleteWorker(worker)} error />
                      </>
                    )}
                  </Stack>
                </Stack>
              ))}
            </Stack>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle2">Documentos ({props.documents.length})</Typography>
              {props.canManage && (
                <Button size="small" variant="contained" onClick={props.onAddDocument}>
                  Agregar
                </Button>
              )}
            </Stack>
            <Stack spacing={1}>
              {props.documents.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  Sin documentos registrados (bloquea la autorización de ingreso).
                </Typography>
              )}
              {props.documents.map((document) => (
                <Stack key={document.id} direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                  <Typography variant="body2">
                    {document.documentType}
                    {document.expiresAt ? ` — vence ${new Date(document.expiresAt).toLocaleDateString()}` : ' — sin vencimiento'}
                  </Typography>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Chip
                      size="small"
                      label={document.status}
                      color={document.status === 'VALID' ? 'success' : document.status === 'PENDING' ? 'warning' : 'error'}
                      variant="outlined"
                    />
                    {props.canManage && (
                      <>
                        <DialogActionButton label="Editar" onClick={() => props.onEditDocument(document)} />
                        <DialogActionButton label="Eliminar" onClick={() => props.onDeleteDocument(document)} error />
                      </>
                    )}
                  </Stack>
                </Stack>
              ))}
            </Stack>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  )
}

function DialogActionButton(props: { label: string; onClick: () => void; error?: boolean }) {
  return (
    <Button
      size="small"
      variant="text"
      color={props.error ? 'error' : 'primary'}
      onClick={props.onClick}
      aria-label={props.label}
      sx={{ minWidth: 0, px: 1 }}
    >
      {props.label}
    </Button>
  )
}
