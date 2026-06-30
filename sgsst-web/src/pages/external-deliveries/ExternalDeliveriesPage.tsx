import { Replay } from '@mui/icons-material'
import { Button, Chip, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography } from '@mui/material'
import { Pager } from '../../components/TablePieces'
import type { Company, ExternalDelivery, ExternalDeliveryFilters, ExternalDeliveryStatus, PageMeta, TableState } from '../../types'

const statusColor: Record<ExternalDeliveryStatus, 'default' | 'primary' | 'success' | 'error' | 'warning'> = {
  PENDING: 'warning',
  SENT: 'success',
  FAILED: 'error',
  SKIPPED: 'default',
}

export function ExternalDeliveriesPage(props: {
  deliveries: ExternalDelivery[]
  meta: PageMeta
  tableState: TableState
  filters: ExternalDeliveryFilters
  companies: Company[]
  onTableChange: (state: TableState) => void
  onFiltersChange: (filters: ExternalDeliveryFilters) => void
  onRetry: (id: string) => void
  onRetryAll: () => void
}) {
  return (
    <Paper className="panel" variant="outlined">
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
        <Stack spacing={0.5}>
          <Typography variant="h6">Entregas externas</Typography>
          <Typography color="text.secondary">Intentos, errores y respuestas de canales externos.</Typography>
        </Stack>
        <Button startIcon={<Replay />} variant="contained" onClick={props.onRetryAll}>
          Reintentar fallidas
        </Button>
      </Stack>
      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <TextField
          size="small"
          placeholder="Buscar destino, asunto, error o entidad"
          value={props.tableState.search}
          onChange={(event) => props.onTableChange({ ...props.tableState, page: 1, search: event.target.value })}
          sx={{ minWidth: { lg: 320 } }}
        />
        <TextField
          select
          size="small"
          label="Proveedor"
          value={props.filters.provider}
          onChange={(event) => props.onFiltersChange({ ...props.filters, provider: event.target.value as ExternalDeliveryFilters['provider'] })}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="all">Todos</MenuItem>
          <MenuItem value="WHATSAPP">WhatsApp</MenuItem>
          <MenuItem value="EMAIL">Email</MenuItem>
          <MenuItem value="TEAMS">Teams</MenuItem>
          <MenuItem value="SLACK">Slack</MenuItem>
        </TextField>
        <TextField
          select
          size="small"
          label="Estado"
          value={props.filters.status}
          onChange={(event) => props.onFiltersChange({ ...props.filters, status: event.target.value as ExternalDeliveryFilters['status'] })}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="all">Todos</MenuItem>
          <MenuItem value="PENDING">Pendiente</MenuItem>
          <MenuItem value="SENT">Enviado</MenuItem>
          <MenuItem value="FAILED">Fallido</MenuItem>
          <MenuItem value="SKIPPED">Omitido</MenuItem>
        </TextField>
        <TextField
          select
          size="small"
          label="Empresa"
          value={props.filters.companyId}
          onChange={(event) => props.onFiltersChange({ ...props.filters, companyId: event.target.value })}
          sx={{ minWidth: 190 }}
        >
          <MenuItem value="">Todas</MenuItem>
          {props.companies.map((company) => (
            <MenuItem key={company.id} value={company.id}>
              {company.name}
            </MenuItem>
          ))}
        </TextField>
      </Stack>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Fecha</TableCell>
              <TableCell>Proveedor</TableCell>
              <TableCell>Empresa</TableCell>
              <TableCell>Destino</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell>Intentos</TableCell>
              <TableCell>Asunto / error</TableCell>
              <TableCell>Entidad</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {props.deliveries.map((item) => (
              <TableRow key={item.id} hover>
                <TableCell>{new Date(item.attemptedAt).toLocaleString()}</TableCell>
                <TableCell>{item.provider}</TableCell>
                <TableCell>{item.company?.name ?? '-'}</TableCell>
                <TableCell>{item.target ?? '-'}</TableCell>
                <TableCell>
                  <Chip size="small" label={item.status} color={statusColor[item.status]} variant="outlined" />
                </TableCell>
                <TableCell>{item.attemptCount}/{item.maxAttempts}</TableCell>
                <TableCell sx={{ maxWidth: 320 }}>
                  <Tooltip title={formatDetails(item)}>
                    <Typography variant="body2" noWrap>
                      {item.error ?? item.subject ?? '-'}
                    </Typography>
                  </Tooltip>
                </TableCell>
                <TableCell>{item.entity ? `${item.entity}:${item.entityId ?? '-'}` : '-'}</TableCell>
                <TableCell align="right">
                  <Button
                    size="small"
                    startIcon={<Replay />}
                    disabled={item.status !== 'FAILED'}
                    onClick={() => props.onRetry(item.id)}
                  >
                    Reintentar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Pager meta={props.meta} state={props.tableState} onChange={props.onTableChange} />
    </Paper>
  )
}

function formatDetails(item: ExternalDelivery) {
  return JSON.stringify(
    {
      subject: item.subject,
      error: item.error,
      response: item.response,
      nextAttemptAt: item.nextAttemptAt,
      deliveredAt: item.deliveredAt,
    },
    null,
    2,
  )
}
