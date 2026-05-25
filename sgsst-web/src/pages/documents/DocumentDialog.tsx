import { UploadFile } from '@mui/icons-material'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField } from '@mui/material'
import {
  documentCategoryLabels,
  documentCategoryOptions,
  documentStatusLabels,
  documentStatusOptions,
} from '../../constants/catalogs'
import type { Company, DocumentCategory, DocumentFormValues, DocumentStatus } from '../../types'

export function DocumentDialog(props: {
  open: boolean
  editing: boolean
  values: DocumentFormValues
  companies: Company[]
  loading: boolean
  canPickCompany: boolean
  onChange: (values: DocumentFormValues) => void
  onUpload: (file: File) => Promise<void>
  onClose: () => void
  onSave: () => void
}) {
  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{props.editing ? 'Editar documento' : 'Nuevo documento'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Nombre" value={props.values.name} onChange={(event) => props.onChange({ ...props.values, name: event.target.value })} required />
          <TextField label="Descripcion" value={props.values.description} onChange={(event) => props.onChange({ ...props.values, description: event.target.value })} multiline minRows={2} />
          <TextField select label="Tipo" value={props.values.category} onChange={(event) => props.onChange({ ...props.values, category: event.target.value as DocumentCategory })}>
            {documentCategoryOptions.map((option) => (
              <MenuItem key={option} value={option}>
                {documentCategoryLabels[option]}
              </MenuItem>
            ))}
          </TextField>
          <TextField select label="Estado documental" value={props.values.status} onChange={(event) => props.onChange({ ...props.values, status: event.target.value as DocumentStatus })}>
            {documentStatusOptions.map((option) => (
              <MenuItem key={option} value={option}>
                {documentStatusLabels[option]}
              </MenuItem>
            ))}
          </TextField>
          <Button component="label" variant="outlined" startIcon={<UploadFile />} disabled={props.loading}>
            Subir archivo
            <input
              hidden
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) {
                  void props.onUpload(file)
                }
                event.target.value = ''
              }}
            />
          </Button>
          <TextField label="URL del archivo" value={props.values.fileUrl} onChange={(event) => props.onChange({ ...props.values, fileUrl: event.target.value })} required />
          <TextField label="Nombre del archivo" value={props.values.fileName} onChange={(event) => props.onChange({ ...props.values, fileName: event.target.value })} />
          <TextField label="Tipo MIME" value={props.values.mimeType} onChange={(event) => props.onChange({ ...props.values, mimeType: event.target.value })} placeholder="application/pdf" />
          <TextField type="date" label="Fecha de vencimiento" InputLabelProps={{ shrink: true }} value={props.values.expiresAt} onChange={(event) => props.onChange({ ...props.values, expiresAt: event.target.value })} />
          <TextField select label="Empresa" value={props.values.companyId} disabled={!props.canPickCompany} onChange={(event) => props.onChange({ ...props.values, companyId: event.target.value })} required>
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
        <Button variant="contained" disabled={props.loading || !props.values.name || !props.values.fileUrl || !props.values.companyId} onClick={props.onSave}>
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  )
}
