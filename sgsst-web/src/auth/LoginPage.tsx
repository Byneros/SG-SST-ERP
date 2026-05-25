import { HealthAndSafety } from '@mui/icons-material'
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Stack, TextField, Typography } from '@mui/material'

type LoginValues = { email: string; password: string }
type BootstrapValues = { name: string; email: string; password: string }

export function LoginPage({
  login,
  bootstrap,
  bootstrapOpen,
  error,
  loading,
  onLoginChange,
  onBootstrapChange,
  onBootstrapOpen,
  onBootstrapClose,
  onLogin,
  onBootstrap,
}: {
  login: LoginValues
  bootstrap: BootstrapValues
  bootstrapOpen: boolean
  error: string
  loading: boolean
  onLoginChange: (values: LoginValues) => void
  onBootstrapChange: (values: BootstrapValues) => void
  onBootstrapOpen: () => void
  onBootstrapClose: () => void
  onLogin: () => void
  onBootstrap: () => void
}) {
  return (
    <Box className="login-page">
      <Paper className="login-panel" variant="outlined">
        <Stack spacing={2.5}>
          <Box className="login-brand">
            <Box className="brand-mark">
              <HealthAndSafety />
            </Box>
            <Box>
              <Typography variant="h5">SG-SST ERP</Typography>
              <Typography color="text.secondary">Ingreso seguro con JWT y roles</Typography>
            </Box>
          </Box>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Correo" type="email" value={login.email} onChange={(event) => onLoginChange({ ...login, email: event.target.value })} />
          <TextField label="Contrasena" type="password" value={login.password} onChange={(event) => onLoginChange({ ...login, password: event.target.value })} />
          <Button variant="contained" size="large" onClick={onLogin} disabled={loading || !login.email || !login.password}>
            Iniciar sesion
          </Button>
          <Button onClick={onBootstrapOpen}>Crear primer administrador</Button>
        </Stack>
      </Paper>
      <BootstrapDialog
        open={bootstrapOpen}
        values={bootstrap}
        loading={loading}
        onChange={onBootstrapChange}
        onClose={onBootstrapClose}
        onSave={onBootstrap}
      />
    </Box>
  )
}

function BootstrapDialog(props: {
  open: boolean
  values: BootstrapValues
  loading: boolean
  onChange: (values: BootstrapValues) => void
  onClose: () => void
  onSave: () => void
}) {
  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Primer administrador</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Nombre" value={props.values.name} onChange={(event) => props.onChange({ ...props.values, name: event.target.value })} />
          <TextField label="Correo" type="email" value={props.values.email} onChange={(event) => props.onChange({ ...props.values, email: event.target.value })} />
          <TextField label="Contrasena" type="password" value={props.values.password} onChange={(event) => props.onChange({ ...props.values, password: event.target.value })} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cancelar</Button>
        <Button variant="contained" disabled={props.loading || props.values.password.length < 8 || !props.values.email || !props.values.name} onClick={props.onSave}>
          Crear ADMIN
        </Button>
      </DialogActions>
    </Dialog>
  )
}
