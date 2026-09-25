import { Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField } from '@mui/material'
import type { Company, Employee, PpeDeliveryFormValues, PpeItemFormValues } from '../../types'

export function PpeItemDialog(props: {
  open: boolean
  editing: boolean
  values: PpeItemFormValues
  companies: Company[]
  loading: boolean
  canPickCompany: boolean
  onChange: (values: PpeItemFormValues) => void
  onClose: () => void
  onSave: () => void
}) {
  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{props.editing ? 'Editar elemento EPP' : 'Nuevo elemento EPP'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Nombre"
            value={props.values.name}
            onChange={(event) => props.onChange({ ...props.values, name: event.target.value })}
            required
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              label="Tipo"
              value={props.values.type}
              onChange={(event) => props.onChange({ ...props.values, type: event.target.value })}
            />
            <TextField
              label="Norma / certificacion"
              value={props.values.standard}
              onChange={(event) => props.onChange({ ...props.values, standard: event.target.value })}
            />
            <TextField
              label="Talla"
              value={props.values.size}
              onChange={(event) => props.onChange({ ...props.values, size: event.target.value })}
              sx={{ maxWidth: 120 }}
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              type="number" label="Vida util (dias)"
              value={props.values.usefulLifeDays}
              onChange={(event) => props.onChange({ ...props.values, usefulLifeDays: event.target.value })}
              sx={{ maxWidth: 180 }}
              helperText="Programa la reposicion automatica"
            />
            <TextField
              type="number" label="Stock minimo"
              value={props.values.stockMin}
              onChange={(event) => props.onChange({ ...props.values, stockMin: event.target.value })}
              sx={{ maxWidth: 160 }}
            />
            <TextField
              type="number" label="Stock"
              value={props.values.stock}
              onChange={(event) => props.onChange({ ...props.values, stock: event.target.value })}
              sx={{ maxWidth: 140 }}
            />
          </Stack>
          <TextField
            select
            label="Empresa"
            value={props.values.companyId}
            disabled={!props.canPickCompany}
            onChange={(event) => props.onChange({ ...props.values, companyId: event.target.value })}
            required
          >
            {props.companies.map((company) => (
              <MenuItem key={company.id} value={company.id}>{company.name}</MenuItem>
            ))}
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cancelar</Button>
        <Button variant="contained" disabled={props.loading || !props.values.name.trim()} onClick={props.onSave}>
          {props.editing ? 'Guardar' : 'Crear'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export function PpeDeliveryDialog(props: {
  open: boolean
  values: PpeDeliveryFormValues
  items: PpeItemFormValues[]
  deliveriesItems: Array<{ id: string; name: string; stock: number }>
  employees: Employee[]
  loading: boolean
  canPickCompany: boolean
  companies: Company[]
  onChange: (values: PpeDeliveryFormValues) => void
  onClose: () => void
  onSave: () => void
}) {
  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Registrar entrega de EPP</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            select
            label="Elemento EPP"
            value={props.values.itemId}
            onChange={(event) => props.onChange({ ...props.values, itemId: event.target.value })}
            required
          >
            {props.deliveriesItems.map((item) => (
              <MenuItem key={item.id} value={item.id}>
                {item.name} (stock: {item.stock})
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Trabajador"
            value={props.values.employeeId}
            onChange={(event) => props.onChange({ ...props.values, employeeId: event.target.value })}
            required
          >
            {props.employees.map((employee) => (
              <MenuItem key={employee.id} value={employee.id}>
                {employee.firstName} {employee.lastName} ({employee.document})
              </MenuItem>
            ))}
          </TextField>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <TextField
              type="number"
              label="Cantidad"
              value={props.values.quantity}
              onChange={(event) => props.onChange({ ...props.values, quantity: event.target.value })}
              sx={{ maxWidth: 140 }}
              inputProps={{ min: 1 }}
            />
            <TextField
              label="Firma (nombre de quien recibe)"
              value={props.values.signature}
              onChange={(event) => props.onChange({ ...props.values, signature: event.target.value })}
            />
          </Stack>
          <TextField
            label="Notas"
            value={props.values.notes}
            onChange={(event) => props.onChange({ ...props.values, notes: event.target.value })}
            multiline
            minRows={2}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cancelar</Button>
        <Button
          variant="contained"
          disabled={props.loading || !props.values.itemId || !props.values.employeeId}
          onClick={props.onSave}
        >
          Registrar entrega
        </Button>
      </DialogActions>
    </Dialog>
  )
}
