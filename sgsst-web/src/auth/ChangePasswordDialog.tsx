import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from '@mui/material'

export type ChangePasswordValues = {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export function ChangePasswordDialog(props: {
  open: boolean
  values: ChangePasswordValues
  loading: boolean
  onChange: (values: ChangePasswordValues) => void
  onClose: () => void
  onSave: () => void
}) {
  const passwordsMatch = props.values.newPassword === props.values.confirmPassword
  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Cambiar contrasena</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField type="password" label="Contrasena actual" value={props.values.currentPassword} onChange={(event) => props.onChange({ ...props.values, currentPassword: event.target.value })} required />
          <TextField type="password" label="Nueva contrasena" value={props.values.newPassword} onChange={(event) => props.onChange({ ...props.values, newPassword: event.target.value })} required />
          <TextField type="password" label="Confirmar contrasena" value={props.values.confirmPassword} error={Boolean(props.values.confirmPassword) && !passwordsMatch} helperText={Boolean(props.values.confirmPassword) && !passwordsMatch ? 'Las contrasenas no coinciden' : ''} onChange={(event) => props.onChange({ ...props.values, confirmPassword: event.target.value })} required />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cancelar</Button>
        <Button variant="contained" disabled={props.loading || !props.values.currentPassword || props.values.newPassword.length < 8 || !passwordsMatch} onClick={props.onSave}>
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  )
}
