import { Delete, Edit } from '@mui/icons-material'
import { Button, Chip, IconButton, LinearProgress, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material'
import { ActiveCompanyBanner, Pager, TableControls, TableHeader, ViewBreadcrumb } from '../../components/TablePieces'
import type { ReportFormat } from '../../api/client'
import type { AnnualWorkPlan, PageMeta, TableState } from '../../types'

const statusLabels: Record<AnnualWorkPlan['status'], string> = {
  DRAFT: 'Borrador',
  APPROVED: 'Aprobado',
  IN_PROGRESS: 'En ejecucion',
  CLOSED: 'Cerrado',
}

const statusColors: Record<AnnualWorkPlan['status'], 'default' | 'primary' | 'success' | 'warning'> = {
  DRAFT: 'default',
  APPROVED: 'primary',
  IN_PROGRESS: 'warning',
  CLOSED: 'success',
}

export function AnnualWorkPlansPage(props: {
  plans: AnnualWorkPlan[]
  meta: PageMeta
  tableState: TableState
  canManage: boolean
  onTableChange: (state: TableState) => void
  onCreate: () => void
  onPreloadCreate?: () => void
  onEdit: (item: AnnualWorkPlan) => void
  onDelete: (id: string) => void
  canExport?: boolean
  onDownloadReport?: (format: ReportFormat) => void
  onScheduleReport?: (format: ReportFormat) => void
  activeCompanyName?: string
}) {
  return (
    <Paper className="panel" variant="outlined">
      <ActiveCompanyBanner name={props.activeCompanyName} />
      <ViewBreadcrumb view="Plan Anual de Trabajo" />
      <TableHeader title="Plan Anual de Trabajo SG-SST" canCreate={props.canManage} onCreate={props.onCreate} onPreloadCreate={props.onPreloadCreate} />
      {props.canExport && props.onDownloadReport && (
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <Button variant="outlined" onClick={() => props.onDownloadReport!('pdf')}>
            Plan PDF
          </Button>
          <Button variant="outlined" onClick={() => props.onDownloadReport!('csv')}>
            Plan CSV
          </Button>
        </Stack>
      )}
      <TableControls state={props.tableState} onChange={props.onTableChange} placeholder="Buscar por anio o notas" />
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Anio</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell>Aprobado por</TableCell>
              <TableCell>Avance</TableCell>
              <TableCell>Notas</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {props.plans.map((plan) => (
              <TableRow key={plan.id} hover>
                <TableCell>{plan.year}</TableCell>
                <TableCell>
                  <Chip size="small" color={statusColors[plan.status]} label={statusLabels[plan.status]} />
                </TableCell>
                <TableCell>{plan.approvedBy?.name ?? '-'}</TableCell>
                <TableCell sx={{ minWidth: 140 }}>
                  {plan.planProgress !== undefined && plan.planProgress !== null ? (
                    <Stack spacing={0.5}>
                      <LinearProgress variant="determinate" value={plan.planProgress} />
                      <Typography variant="caption" color="text.secondary">{plan.planProgress}%</Typography>
                    </Stack>
                  ) : (
                    '-'
                  )}
                </TableCell>
                <TableCell>{plan.notes ?? '-'}</TableCell>
                <TableCell align="right">
                  <IconButton disabled={!props.canManage} onClick={() => props.onEdit(plan)}>
                    <Edit />
                  </IconButton>
                  <IconButton disabled={!props.canManage} color="error" onClick={() => props.onDelete(plan.id)}>
                    <Delete />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {props.plans.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography variant="body2" color="text.secondary">
                    Sin planes anuales registrados.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <Pager meta={props.meta} state={props.tableState} onChange={props.onTableChange} />
    </Paper>
  )
}
