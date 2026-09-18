import { AddTask, Delete, Edit, TaskAlt } from '@mui/icons-material'
import { Button, Chip, IconButton, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography } from '@mui/material'
import type { ReportFormat } from '../../api/client'
import { ActiveChip, ActiveCompanyBanner, Pager, TableControls, TableHeader } from '../../components/TablePieces'
import type { PageMeta, SgsstAudit, TableState } from '../../types'

export function SgsstAuditsPage(props: {
  audits: SgsstAudit[]
  meta: PageMeta
  tableState: TableState
  canManage: boolean
  canExport: boolean
  onTableChange: (state: TableState) => void
  onCreate: () => void
  onPreloadCreate?: () => void
  onEdit: (item: SgsstAudit) => void
  onDelete: (id: string) => void
  onAddFinding: (id: string) => void
  onAddAction: (findingId: string) => void
  onCloseAudit: (item: SgsstAudit) => void
  onDownloadReport: (format: ReportFormat) => void
  onScheduleReport: (format: ReportFormat) => void
  activeCompanyName?: string
}) {
  return (
    <Paper className="panel" variant="outlined">
      <ActiveCompanyBanner name={props.activeCompanyName} />
      <TableHeader title="Auditorias SG-SST" canCreate={props.canManage} onCreate={props.onCreate} onPreloadCreate={props.onPreloadCreate} />
      {props.canExport && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="flex-end" sx={{ mb: 2 }}>
          <Button variant="outlined" onClick={() => props.onDownloadReport('pdf')}>
            Auditorias PDF
          </Button>
          <Button variant="outlined" onClick={() => props.onDownloadReport('csv')}>
            Auditorias CSV
          </Button>
          <Button variant="contained" onClick={() => props.onScheduleReport('pdf')}>
            Programar PDF
          </Button>
        </Stack>
      )}
      <TableControls state={props.tableState} onChange={props.onTableChange} placeholder="Buscar auditoria, alcance o auditor" />
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Auditoria</TableCell>
              <TableCell>Empresa</TableCell>
              <TableCell>Fecha</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell>Hallazgos / acciones</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {props.audits.map((audit) => (
              <TableRow key={audit.id} hover>
                <TableCell>
                  <Typography variant="subtitle2">{audit.title}</Typography>
                  <Typography variant="caption" color="text.secondary">{audit.scope || audit.auditorName || '-'}</Typography>
                </TableCell>
                <TableCell>{audit.company?.name ?? '-'}</TableCell>
                <TableCell>{audit.scheduledAt.slice(0, 10)}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1}>
                    <ActiveChip active={audit.isActive} />
                    <Chip size="small" label={audit.status} variant="outlined" />
                  </Stack>
                </TableCell>
                <TableCell>{audit.findings?.length ?? 0} / {audit.findings?.reduce((total, finding) => total + (finding.actions?.length ?? 0), 0) ?? 0}</TableCell>
                <TableCell align="right">
                  <Tooltip title="Agregar hallazgo">
                    <IconButton disabled={!props.canManage} onClick={() => props.onAddFinding(audit.id)}><AddTask /></IconButton>
                  </Tooltip>
                  {audit.findings?.[0] && (
                    <Tooltip title="Agregar accion al ultimo hallazgo">
                      <IconButton disabled={!props.canManage} onClick={() => props.onAddAction(audit.findings![0].id)}><TaskAlt /></IconButton>
                    </Tooltip>
                  )}
                  <IconButton disabled={!props.canManage} onClick={() => props.onEdit(audit)}><Edit /></IconButton>
                  <IconButton disabled={!props.canManage || audit.status === 'CLOSED'} onClick={() => props.onCloseAudit(audit)}><TaskAlt /></IconButton>
                  <IconButton disabled={!props.canManage} color="error" onClick={() => props.onDelete(audit.id)}><Delete /></IconButton>
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
