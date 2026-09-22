import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField } from '@mui/material'
import type { SsoConfigValues } from './ssoConfig'

export const emptySsoConfig: SsoConfigValues = {
  protocol: 'OIDC',
  issuer: '',
  clientId: '',
  clientSecret: '',
  authorizationEndpoint: '',
  tokenEndpoint: '',
  jwksUri: '',
  userinfoEndpoint: '',
  scopes: 'openid email profile',
  idpEntityId: '',
  idpSsoUrl: '',
  idpCertificate: '',
  spEntityId: '',
  defaultRole: 'EMPLOYEE',
  roleGroups: '',
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
  const isSaml = props.values.protocol === 'SAML'

  return (
    <Dialog open={props.open} onClose={props.onClose} fullWidth maxWidth="sm">
      <DialogTitle>SSO {props.values.protocol} — {props.companyName}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {props.configured && (
            <Alert severity="info">
              Ya existe configuracion. Deja el secreto vacio para conservar el actual.
            </Alert>
          )}
          <TextField
            select fullWidth size="small" label="Protocolo" value={props.values.protocol}
            onChange={(event) => set({ protocol: event.target.value as SsoConfigValues['protocol'] })}
          >
            <MenuItem value="OIDC">OIDC</MenuItem>
            <MenuItem value="SAML">SAML</MenuItem>
          </TextField>

          {!isSaml && (
            <>
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
              <TextField fullWidth size="small" label="Scopes" value={props.values.scopes} onChange={(event) => set({ scopes: event.target.value })} />
            </>
          )}

          {isSaml && (
            <>
              <TextField
                fullWidth size="small" label="Entity ID del IdP"
                placeholder="https://idp.empresa.com/sso"
                value={props.values.idpEntityId}
                onChange={(event) => set({ idpEntityId: event.target.value })}
              />
              <TextField
                fullWidth size="small" label="URL SSO del IdP (redirect)" required
                placeholder="https://idp.empresa.com/sso/login"
                value={props.values.idpSsoUrl}
                onChange={(event) => set({ idpSsoUrl: event.target.value })}
              />
              <TextField
                fullWidth size="small" multiline minRows={3} label="Certificado X.509 del IdP (PEM)" required
                placeholder="-----BEGIN CERTIFICATE-----"
                value={props.values.idpCertificate}
                onChange={(event) => set({ idpCertificate: event.target.value })}
              />
              <TextField
                fullWidth size="small" label="Entity ID del SP (opcional)"
                placeholder="Vacio = autogenerado por empresa"
                value={props.values.spEntityId}
                onChange={(event) => set({ spEntityId: event.target.value })}
              />
              <Alert severity="info">
                Metadata SP para cargar en el IdP:{' '}
                <code>/api/v1/auth/sso/saml/{props.companyId}/metadata</code> · ACS:{' '}
                <code>/api/v1/auth/sso/saml/{props.companyId}/acs</code>
              </Alert>
            </>
          )}

          <TextField
            fullWidth size="small" multiline minRows={2}
            label="Overrides de rol por grupo del IdP (JSON, opcional)"
            placeholder='{ "SG-SST-Admins": "ADMIN", "Contratistas": "EMPLOYEE" }'
            helperText="Primer grupo del usuario presente en el mapa define el rol; sin match aplica el rol por defecto. Roles: EMPLOYEE, SST, AUDITOR, ADMIN."
            value={props.values.roleGroups}
            onChange={(event) => set({ roleGroups: event.target.value })}
          />

          <Stack direction="row" spacing={2}>
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
            <TextField
              select fullWidth size="small" label="Estado"
              value={props.values.isActive ? 'true' : 'false'}
              onChange={(event) => set({ isActive: event.target.value === 'true' })}
            >
              <MenuItem value="true">Activo</MenuItem>
              <MenuItem value="false">Inactivo</MenuItem>
            </TextField>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cancelar</Button>
        <Button variant="contained" disabled={props.loading} onClick={props.onSave}>Guardar</Button>
      </DialogActions>
    </Dialog>
  )
}
