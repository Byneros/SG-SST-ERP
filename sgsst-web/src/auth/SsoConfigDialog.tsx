import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField } from '@mui/material'
import type { SsoConfigValues } from './ssoConfig'

export const emptySsoConfig: SsoConfigValues = {
  issuer: '',
  clientId: '',
  clientSecret: '',
  authorizationEndpoint: '',
  tokenEndpoint: '',
  jwksUri: '',
  userinfoEndpoint: '',
  scopes: 'openid email profile',
  defaultRole: 'EMPLOYEE',
  isActive: true,
}

export function SsoConfigDialog(props: {
  companyId: string
  companyName: string
  open: boolean
  loading: boolean
  configured: boolean
  values: SsoConfigValues
  onChange: (values: SsoConfigValues) => void
  onClose: () => void
  onSave: () => void
}) {
  const set = (patch: Partial<SsoConfigValues>) => props.onChange({ ...props.values, ...patch })

  return (
    <Dialog open={props.open} onClose={props.onClose} fullWidth maxWidth="sm">
      <DialogTitle>SSO OIDC — {props.companyName}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {props.configured && (
            <Alert severity="info">
              Ya existe configuracion. Deja el secreto vacio para conservar el actual.
            </Alert>
          )}
          <TextField
            fullWidth size="small" label="Issuer del IdP" required
            placeholder="https://idp.empresa.com"
            value={props.values.issuer}
            onChange={(event) => set({ issuer: event.target.value })}
          />
          <Stack direction="row" spacing={2}>
            <TextField fullWidth size="small" label="Client ID" required value={props.values.clientId} onChange={(event) => set({ clientId: event.target.value })} />
            <TextField
              fullWidth size="small" type="password"
              label={props.configured ? 'Client Secret (vacio = sin cambio)' : 'Client Secret'}
              required={!props.configured}
              value={props.values.clientSecret}
              onChange={(event) => set({ clientSecret: event.target.value })}
            />
          </Stack>
          <TextField fullWidth size="small" label="Endpoint de autorizacion" required value={props.values.authorizationEndpoint} onChange={(event) => set({ authorizationEndpoint: event.target.value })} />
          <TextField fullWidth size="small" label="Endpoint de token" required value={props.values.tokenEndpoint} onChange={(event) => set({ tokenEndpoint: event.target.value })} />
          <Stack direction="row" spacing={2}>
            <TextField fullWidth size="small" label="JWKS URI" value={props.values.jwksUri} onChange={(event) => set({ jwksUri: event.target.value })} />
            <TextField fullWidth size="small" label="Userinfo (opcional)" value={props.values.userinfoEndpoint} onChange={(event) => set({ userinfoEndpoint: event.target.value })} />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField fullWidth size="small" label="Scopes" value={props.values.scopes} onChange={(event) => set({ scopes: event.target.value })} />
            <TextField
              select fullWidth size="small" label="Rol por defecto (JIT)"
              value={props.values.defaultRole}
              onChange={(event) => set({ defaultRole: event.target.value as SsoConfigValues['defaultRole'] })}
            >
              <MenuItem value="EMPLOYEE">Empleado</MenuItem>
              <MenuItem value="SST">SST</MenuItem>
              <MenuItem value="AUDITOR">Auditor</MenuItem>
              <MenuItem value="ADMIN">Admin</MenuItem>
            </TextField>
          </Stack>
          <TextField
            select fullWidth size="small" label="Estado"
            value={props.values.isActive ? 'true' : 'false'}
            onChange={(event) => set({ isActive: event.target.value === 'true' })}
          >
            <MenuItem value="true">Activo</MenuItem>
            <MenuItem value="false">Inactivo</MenuItem>
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cancelar</Button>
        <Button variant="contained" disabled={props.loading} onClick={props.onSave}>Guardar</Button>
      </DialogActions>
    </Dialog>
  )
}
