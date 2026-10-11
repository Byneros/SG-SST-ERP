import { UploadFile } from '@mui/icons-material'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, ListItemText, MenuItem, Stack, TextField } from '@mui/material'
import {
  documentCategoryLabels,
  documentCategoryOptions,
} from '../../constants/catalogs'
import type { Company, DocumentCategory, DocumentFormValues, Site } from '../../types'

export function DocumentDialog(props: {
  open: boolean
  editing: boolean
  values: DocumentFormValues
  companies: Company[]
  sites: Site[]
  loading: boolean
  canPickCompany: boolean
  onChange: (values: DocumentFormValues) => void
  onUpload: (file: File) => Promise<void>
  onClose: () => void
  onSave: () => void
}) {
  // Sedes de la empresa seleccionada: cambiar empresa limpia la sede elegida.
  const siteOptions = props.sites.filter((site) => site.companyId === props.values.companyId)
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
          <TextField label="Archivo seleccionado" value={props.values.fileName} InputProps={{ readOnly: true }} required />
          <TextField label="Tipo MIME" value={props.values.mimeType} InputProps={{ readOnly: true }} placeholder="application/pdf" />
          <TextField type="date" label="Fecha de vencimiento" InputLabelProps={{ shrink: true }} value={props.values.expiresAt} onChange={(event) => props.onChange({ ...props.values, expiresAt: event.target.value })} />
          <TextField
            select
            label="Sede"
            value={props.values.siteId}
            onChange={(event) => props.onChange({ ...props.values, siteId: event.target.value })}
            helperText={
              siteOptions.length === 0
                ? 'Sin sedes registradas para esta empresa. Crea una en el módulo Sedes.'
                : 'Sede a la que aplica el documento.'
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
            label="Empresa"
            value={props.values.companyId}
            disabled={!props.canPickCompany}
            onChange={(event) =>
              props.onChange({
                ...props.values,
                companyId: event.target.value,
                // La sede pertenece a la empresa: al cambiarla se desasigna.
                siteId: '',
              })
            }
            required
          >
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
