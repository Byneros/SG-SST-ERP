import { Delete, Edit } from '@mui/icons-material'
import { Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material'
import { useState } from 'react'
import { ActiveCompanyBanner, Pager, TableControls, TableHeader, ViewBreadcrumb } from '../../components/TablePieces'
import type { PageMeta, TableState, UnsafeReport } from '../../types'

const kindLabels: Record<UnsafeReport['kind'], string> = {
  UNSAFE_ACT: 'Acto inseguro',
  UNSAFE_CONDITION: 'Condicion insegura',
}

const statusLabels: Record<UnsafeReport['status'], string> = {
  OPEN: 'Abierto',
  IN_PROGRESS: 'En gestion',
  CLOSED: 'Cerrado',
}

const statusColors: Record<UnsafeReport['status'], 'error' | 'warning' | 'success'> = {
  OPEN: 'error',
  IN_PROGRESS: 'warning',
  CLOSED: 'success',
}

export function UnsafeReportsPage(props: {
  reports: UnsafeReport[]
  meta: PageMeta
  tableState: TableState
  canManage: boolean
  canReport: boolean
  onTableChange: (state: TableState) => void
  onCreate: () => void
  onPreloadCreate?: () => void
  onEdit: (item: UnsafeReport) => void
  onDelete: (id: string) => void
  onAddAction: (findingId: string) => void
  loading?: boolean
  activeCompanyName?: string
}) {
  const [selected, setSelected] = useState<UnsafeReport | null>(null)

  return (
    <Paper className="panel" variant="outlined">
      <ActiveCompanyBanner name={props.activeCompanyName} />
      <ViewBreadcrumb view="Actos y condiciones inseguras" />
      <TableHeader title="Actos y condiciones inseguras" canCreate={props.canReport} onCreate={props.onCreate} onPreloadCreate={props.onPreloadCreate} />
      <TableControls state={props.tableState} onChange={props.onTableChange} placeholder="Buscar por descripcion o area" />
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Tipo</TableCell>
              <TableCell>Descripcion</TableCell>
              <TableCell>Sede / Area</TableCell>
              <TableCell>Severidad</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell>Acciones</TableCell>
              <TableCell align="right">Gestion</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {props.reports.map((report) => (
              <TableRow key={report.id} hover>
                <TableCell>{kindLabels[report.kind]}</TableCell>
                <TableCell sx={{ maxWidth: 260 }}>{report.description}</TableCell>
                <TableCell>
                  {report.site?.name ?? '-'}
                  {report.area ? ` / ${report.area}` : ''}
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    color={report.severity === 'CRITICAL' ? 'error' : report.severity === 'MAJOR' ? 'warning' : 'default'}
                    label={report.severity}
                  />
                </TableCell>
                <TableCell>
                  <Chip size="small" color={statusColors[report.status]} label={statusLabels[report.status]} />
                </TableCell>
                <TableCell>{report.findings.length}</TableCell>
                <TableCell align="right">
                  <Button size="small" onClick={() => setSelected(report)}>
                    Ver
                  </Button>
                  <IconButton disabled={!props.canManage} onClick={() => props.onEdit(report)}>
                    <Edit />
                  </IconButton>
                  <IconButton disabled={!props.canManage} color="error" onClick={() => props.onDelete(report.id)}>
                    <Delete />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {props.reports.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography variant="body2" color="text.secondary">Sin reportes registrados.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <Pager meta={props.meta} state={props.tableState} onChange={props.onTableChange} />

      <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{selected ? kindLabels[selected.kind] : ''}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={1} sx={{ mt: 1 }}>
            <Typography variant="body2">{selected?.description}</Typography>
            {selected?.isAnonymous ? (
              <Typography variant="caption" color="text.secondary">Reporte anonimo</Typography>
            ) : (
              <Typography variant="caption" color="text.secondary">
                Reportante: {selected?.reporter?.name ?? selected?.reporterName ?? 'N/D'}
              </Typography>
            )}
            {(selected?.findings ?? []).map((finding) => (
              <Box key={finding.id} sx={{ py: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2" sx={{ flex: 1 }}>{finding.description}</Typography>
                  {props.canManage && !finding.action && (
                    <Button
                      size="small"
                      disabled={props.loading}
                      onClick={() => props.onAddAction(finding.id)}
                    >
                      Crear accion
                    </Button>
                  )}
                </Stack>
                {finding.action && (
                  <Typography variant="caption" color="text.secondary">
                    Accion: {finding.action.title} - {finding.action.responsible} - {finding.action.dueDate.slice(0, 10)} - {finding.action.status}
                  </Typography>
                )}
              </Box>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelected(null)}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  )
}
