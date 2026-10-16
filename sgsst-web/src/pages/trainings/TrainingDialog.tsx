import { Button, Dialog, DialogActions, DialogContent, DialogTitle, ListItemText, MenuItem, Stack, TextField } from '@mui/material'
import type { Company, Site, TrainingFormValues } from '../../types'

export function TrainingDialog(props: {
  open: boolean
  editing: boolean
  values: TrainingFormValues
  companies: Company[]
  sites: Site[]
  loading: boolean
  canPickCompany: boolean
  onChange: (values: TrainingFormValues) => void
  onClose: () => void
  onSave: () => void
}) {
  // Sedes de la empresa seleccionada: cambiar empresa limpia la sede elegida.
  const siteOptions = props.sites.filter((site) => site.companyId === props.values.companyId)

  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{props.editing ? 'Editar capacitacion' : 'Nueva capacitacion'}</DialogTitle>
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
          />
          <TextField
            type="date"
            label="Fecha"
            InputLabelProps={{ shrink: true }}
            value={props.values.date}
            onChange={(event) => props.onChange({ ...props.values, date: event.target.value })}
            required
          />
          <TextField
            label="Instructor / facilitador"
            value={props.values.instructor ?? ''}
            onChange={(event) => props.onChange({ ...props.values, instructor: event.target.value })}
          />
          <TextField
            type="number"
            label="Vigencia del certificado (meses)"
            inputProps={{ min: 1, max: 120 }}
            value={props.values.validityMonths ?? ''}
            onChange={(event) =>
              props.onChange({
                ...props.values,
                validityMonths: event.target.value ? Number(event.target.value) : undefined,
              })
            }
            helperText="Al aprobar el asistente se deriva el vencimiento (fecha + meses)."
          />
          <TextField
            select
            label="Sede"
            value={props.values.siteId}
            onChange={(event) => props.onChange({ ...props.values, siteId: event.target.value })}
            helperText={
              siteOptions.length === 0
                ? 'Sin sedes registradas para esta empresa. Crea una en el módulo Sedes.'
                : 'Sede donde se realiza la capacitacion.'
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
          disabled={props.loading || !props.values.title || !props.values.date || !props.values.companyId}
          onClick={props.onSave}
        >
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  )
}
