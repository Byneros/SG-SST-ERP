import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material'

export function MfaSettingsDialog(props: {
  open: boolean
  enabled: boolean
  secret: string
  otpauthUrl: string
  code: string
  loading: boolean
  onCodeChange: (code: string) => void
  onSetup: () => void
  onEnable: () => void
  onDisable: () => void
  onClose: () => void
}) {
  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Autenticacion MFA</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography color="text.secondary">
            Usa una app autenticadora compatible con TOTP. Guarda el secreto y confirma con un codigo de 6 digitos.
          </Typography>
          {!props.secret && <Button variant="outlined" onClick={props.onSetup} disabled={props.loading}>Generar secreto</Button>}
          {props.secret && (
            <>
              <TextField label="Secreto" value={props.secret} InputProps={{ readOnly: true }} />
              <TextField label="URI OTP" value={props.otpauthUrl} InputProps={{ readOnly: true }} />
              <TextField label="Codigo" value={props.code} onChange={(event) => props.onCodeChange(event.target.value)} inputProps={{ maxLength: 6 }} />
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cerrar</Button>
        {props.enabled ? (
          <Button color="error" disabled={props.loading || props.code.length !== 6} onClick={props.onDisable}>Desactivar MFA</Button>
        ) : (
          <Button variant="contained" disabled={props.loading || !props.secret || props.code.length !== 6} onClick={props.onEnable}>Activar MFA</Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
