import { Delete, Edit } from '@mui/icons-material'
import { Chip, IconButton, LinearProgress, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography } from '@mui/material'
import { ActiveCompanyBanner, Pager, TableControls, TableHeader } from '../../components/TablePieces'
import type { PageMeta, SgsstEvaluation, TableState } from '../../types'

export function SgsstEvaluationsPage(props: {
  evaluations: SgsstEvaluation[]
  meta: PageMeta
  tableState: TableState
  canManage: boolean
  onTableChange: (state: TableState) => void
  onCreate: () => void
  onPreloadCreate?: () => void
  onEdit: (item: SgsstEvaluation) => void
  onDelete: (id: string) => void
  activeCompanyName?: string
}) {
  return (
    <Paper className="panel" variant="outlined">
      <ActiveCompanyBanner name={props.activeCompanyName} />
      <TableHeader title="Evaluaciones Res. 0312" canCreate={props.canManage} onCreate={props.onCreate} onPreloadCreate={props.onPreloadCreate} />
      <TableControls state={props.tableState} onChange={props.onTableChange} placeholder="Buscar evaluacion o periodo" />
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Evaluacion</TableCell>
              <TableCell>Empresa</TableCell>
              <TableCell>Periodo</TableCell>
              <TableCell>Clase de riesgo</TableCell>
              <TableCell>Cumplimiento</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {props.evaluations.map((evaluation) => (
              <TableRow key={evaluation.id} hover>
                <TableCell>
                  <Typography variant="subtitle2">{evaluation.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{evaluation.standard}</Typography>
                </TableCell>
                <TableCell>{evaluation.company?.name ?? '-'}</TableCell>
                <TableCell>{evaluation.period || '-'}</TableCell>
                <TableCell>Clase {evaluation.riskClass}</TableCell>
                <TableCell>
                  {evaluation.compliancePercent === null || evaluation.compliancePercent === undefined ? (
                    <Typography variant="body2" color="text.secondary">-</Typography>
                  ) : (
                    <Stack spacing={0.5} sx={{ minWidth: 140 }}>
                      <LinearProgress variant="determinate" value={evaluation.compliancePercent} />
                      <Typography variant="caption">{evaluation.compliancePercent}%</Typography>
                    </Stack>
                  )}
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1}>
                    <Chip size="small" label={evaluation.status} variant="outlined" />
                  </Stack>
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Responder items / editar">
                    <IconButton onClick={() => props.onEdit(evaluation)}><Edit /></IconButton>
                  </Tooltip>
                  <IconButton disabled={!props.canManage} color="error" onClick={() => props.onDelete(evaluation.id)}><Delete /></IconButton>
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
