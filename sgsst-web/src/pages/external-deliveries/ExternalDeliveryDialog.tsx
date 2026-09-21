import { Close, Replay } from '@mui/icons-material'
import { Button, Chip, Dialog, DialogContent, DialogTitle, Divider, IconButton, Stack, Table, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography } from '@mui/material'
import type { ExternalDelivery } from '../../types'

const statusColor: Record<ExternalDelivery['status'], 'default' | 'primary' | 'success' | 'error' | 'warning'> = {
  PENDING: 'warning',
  SENT: 'success',
  FAILED: 'error',
  SKIPPED: 'default',
}

function JsonBlock({ label, value }: { label: string; value: unknown }) {
  let text = '-'
  if (value !== undefined && value !== null) {
    try {
      text = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
    } catch {
      text = String(value)
    }
  }
  return (
    <Stack spacing={0.5}>
      <Typography variant="subtitle2">{label}</Typography>
      <Typography
        component="pre"
        variant="caption"
        sx={{
          bgcolor: 'action.hover',
          borderRadius: 1,
          p: 1.5,
          overflow: 'auto',
          maxHeight: 220,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          m: 0,
        }}
      >
        {text}
      </Typography>
    </Stack>
  )
}

export function ExternalDeliveryDialog(props: {
  delivery: ExternalDelivery | null
  onRetry: (id: string) => void
  onClose: () => void
}) {
  const item = props.delivery
  return (
    <Dialog open={item !== null} onClose={props.onClose} fullWidth maxWidth="sm">
      {item && (
        <>
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 1 }}>
            <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h6">Detalle de entrega externa</Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip size="small" label={item.provider} variant="outlined" />
                <Chip size="small" label={item.status} color={statusColor[item.status]} variant="outlined" />
                <Typography variant="caption" color="text.secondary">
                  {item.attemptCount}/{item.maxAttempts} intentos
                </Typography>
              </Stack>
            </Stack>
            <IconButton aria-label="Cerrar" onClick={props.onClose}>
              <Close fontSize="small" />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Destino</TableCell>
                    <TableCell>Empresa</TableCell>
                    <TableCell>Entidad</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell>{item.target ?? '-'}</TableCell>
                    <TableCell>{item.company?.name ?? '-'}</TableCell>
                    <TableCell>{item.entity ? `${item.entity}:${item.entityId ?? '-'}` : '-'}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Stack spacing={0.5} sx={{ flex: 1 }}>
                  <Typography variant="subtitle2">Último intento</Typography>
                  <Typography variant="body2">{new Date(item.attemptedAt).toLocaleString()}</Typography>
                </Stack>
                <Stack spacing={0.5} sx={{ flex: 1 }}>
                  <Typography variant="subtitle2">Entregado</Typography>
                  <Typography variant="body2">{item.deliveredAt ? new Date(item.deliveredAt).toLocaleString() : '-'}</Typography>
                </Stack>
                <Stack spacing={0.5} sx={{ flex: 1 }}>
                  <Typography variant="subtitle2">Próximo reintento</Typography>
                  <Typography variant="body2">{item.nextAttemptAt ? new Date(item.nextAttemptAt).toLocaleString() : '-'}</Typography>
                </Stack>
              </Stack>
              <Divider />
              <JsonBlock label="Asunto" value={item.subject} />
              <JsonBlock label="Error" value={item.error} />
              <JsonBlock label="Payload" value={item.payload} />
              <JsonBlock label="Respuesta" value={item.response} />
              <Stack direction="row" justifyContent="flex-end" spacing={1}>
                <Tooltip title={item.status === 'FAILED' ? '' : 'Solo disponible para entregas fallidas'}>
                  <span>
                    <Button
                      startIcon={<Replay />}
                      variant="contained"
                      disabled={item.status !== 'FAILED'}
                      onClick={() => props.onRetry(item.id)}
                    >
                      Reintentar
                    </Button>
                  </span>
                </Tooltip>
              </Stack>
            </Stack>
          </DialogContent>
        </>
      )}
    </Dialog>
  )
}
