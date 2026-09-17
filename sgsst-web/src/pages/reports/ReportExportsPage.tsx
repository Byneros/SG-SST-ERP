import { Download, Replay } from '@mui/icons-material'
import { Button, Chip, IconButton, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography } from '@mui/material'
import { ActiveCompanyBanner, Pager, TableHeader } from '../../components/TablePieces'
import type { Company, PageMeta, ReportExport, ReportExportFilters, ReportExportMetricSnapshot, ReportExportMetrics, ReportExportStatus, SystemUser, TableState } from '../../types'

const statusColor: Record<ReportExportStatus, 'default' | 'primary' | 'success' | 'error' | 'warning'> = {
  QUEUED: 'primary',
  PROCESSING: 'warning',
  READY: 'success',
  FAILED: 'error',
  EXPIRED: 'default',
}

export function ReportExportsPage(props: {
  exports: ReportExport[]
  meta: PageMeta
  tableState: TableState
  filters: ReportExportFilters
  metrics: ReportExportMetrics
  history: ReportExportMetricSnapshot[]
  companies: Company[]
  users: SystemUser[]
  onTableChange: (state: TableState) => void
  onFiltersChange: (filters: ReportExportFilters) => void
  onRetry: (id: string) => void
  onDownload: (item: ReportExport) => void
  activeCompanyName?: string
}) {
  const failureRate = props.metrics.totals.total
    ? Math.round((props.metrics.totals.failed / props.metrics.totals.total) * 100)
    : 0

  return (
    <Paper className="panel" variant="outlined">
      <ActiveCompanyBanner name={props.activeCompanyName} />
      <TableHeader title="Mis reportes" canCreate={false} onCreate={() => undefined} />
      <Stack direction={{ xs: 'column', xl: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <MetricCard label="Total" value={props.metrics.totals.total.toString()} />
        <MetricCard label="Listos" value={props.metrics.totals.ready.toString()} />
        <MetricCard label="Fallidos" value={`${props.metrics.totals.failed} (${failureRate}%)`} />
        <MetricCard label="Tiempo promedio" value={`${props.metrics.totals.averageGenerationSeconds}s`} />
        <MetricCard label="Almacenamiento" value={formatBytes(props.metrics.totals.storageBytes)} />
      </Stack>
      <Stack direction={{ xs: 'column', xl: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <Paper variant="outlined" sx={{ p: 1.5, flex: 1 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Volumen por empresa
          </Typography>
          {props.metrics.byCompany.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Sin datos
            </Typography>
          ) : (
            props.metrics.byCompany.slice(0, 5).map((item) => (
              <Stack key={`${item.companyId ?? 'none'}-${item.companyName}`} direction="row" justifyContent="space-between">
                <Typography variant="body2">{item.companyName}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {item.total} - {formatBytes(item.storageBytes)}
                </Typography>
              </Stack>
            ))
          )}
        </Paper>
        <Paper variant="outlined" sx={{ p: 1.5, flex: 1 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Fallas por tipo
          </Typography>
          {props.metrics.failuresByKind.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Sin datos
            </Typography>
          ) : (
            props.metrics.failuresByKind.slice(0, 5).map((item) => (
              <Stack key={item.kind} direction="row" justifyContent="space-between">
                <Typography variant="body2">{item.kind}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {item.failed}
                </Typography>
              </Stack>
            ))
          )}
        </Paper>
      </Stack>
      {props.history.length > 0 && (
        <Paper variant="outlined" sx={{ p: 1.5, mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Historico diario
          </Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
            {props.history.slice(-7).map((item) => (
              <Paper key={item.id} variant="outlined" sx={{ p: 1, minWidth: 130, flex: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {new Date(item.date).toLocaleDateString()}
                </Typography>
                <Typography variant="subtitle2">{item.total} reportes</Typography>
                <Typography variant="caption" color="text.secondary">
                  {item.failed} fallos - {formatBytes(item.storageBytes)}
                </Typography>
              </Paper>
            ))}
          </Stack>
        </Paper>
      )}
      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <TextField
          size="small"
          placeholder="Buscar por reporte, formato, estado o archivo"
          value={props.tableState.search}
          onChange={(event) => props.onTableChange({ ...props.tableState, page: 1, search: event.target.value })}
          sx={{ minWidth: { lg: 300 } }}
        />
        <TextField
          select
          size="small"
          label="Estado"
          value={props.filters.status}
          onChange={(event) => props.onFiltersChange({ ...props.filters, status: event.target.value as ReportExportFilters['status'] })}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="all">Todos</MenuItem>
          <MenuItem value="QUEUED">En cola</MenuItem>
          <MenuItem value="PROCESSING">Procesando</MenuItem>
          <MenuItem value="READY">Listo</MenuItem>
          <MenuItem value="FAILED">Fallido</MenuItem>
          <MenuItem value="EXPIRED">Expirado</MenuItem>
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
        <TextField
          select
          size="small"
          label="Solicitante"
          value={props.filters.requestedById}
          onChange={(event) => props.onFiltersChange({ ...props.filters, requestedById: event.target.value })}
          sx={{ minWidth: 190 }}
        >
          <MenuItem value="">Todos</MenuItem>
          {props.users.map((user) => (
            <MenuItem key={user.id} value={user.id}>
              {user.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          size="small"
          type="date"
          label="Desde"
          value={props.filters.dateFrom}
          onChange={(event) => props.onFiltersChange({ ...props.filters, dateFrom: event.target.value })}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          size="small"
          type="date"
          label="Hasta"
          value={props.filters.dateTo}
          onChange={(event) => props.onFiltersChange({ ...props.filters, dateTo: event.target.value })}
          InputLabelProps={{ shrink: true }}
        />
      </Stack>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Reporte</TableCell>
              <TableCell>Empresa</TableCell>
              <TableCell>Solicitante</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell>Solicitado</TableCell>
              <TableCell>Expira</TableCell>
              <TableCell>Archivo</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {props.exports.map((item) => (
              <TableRow key={item.id} hover>
                <TableCell>
                  {item.kind}.{item.format}
                </TableCell>
                <TableCell>{item.company?.name ?? '-'}</TableCell>
                <TableCell>{item.requestedBy ? `${item.requestedBy.name} (${item.requestedBy.role})` : '-'}</TableCell>
                <TableCell>
                  <Chip size="small" label={item.status} color={statusColor[item.status]} variant="outlined" />
                </TableCell>
                <TableCell>{new Date(item.requestedAt).toLocaleString()}</TableCell>
                <TableCell>{item.expiresAt ? new Date(item.expiresAt).toLocaleDateString() : '-'}</TableCell>
                <TableCell>{item.fileName ?? item.error ?? '-'}</TableCell>
                <TableCell align="right">
                  <Tooltip title="Descargar">
                    <span>
                      <IconButton onClick={() => props.onDownload(item)} disabled={item.status !== 'READY' || !item.fileUrl}>
                        <Download />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Button
                    size="small"
                    startIcon={<Replay />}
                    disabled={item.status !== 'FAILED' && item.status !== 'EXPIRED'}
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

function MetricCard(props: { label: string; value: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, minWidth: 145, flex: 1 }}>
      <Typography variant="caption" color="text.secondary">
        {props.label}
      </Typography>
      <Typography variant="h6">{props.value}</Typography>
    </Paper>
  )
}

function formatBytes(value: number) {
  if (!value) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let current = value
  let index = 0
  while (current >= 1024 && index < units.length - 1) {
    current /= 1024
    index += 1
  }
  return `${current.toFixed(current >= 10 ? 0 : 1)} ${units[index]}`
}
