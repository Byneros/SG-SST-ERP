import { Delete, Edit } from '@mui/icons-material'
import { Chip, IconButton, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material'
import { ActiveCompanyBanner, Pager, TableControls, TableHeader } from '../../components/TablePieces'
import { riskLevelLabels } from '../../constants/catalogs'
import type { PageMeta, Risk, TableState } from '../../types'

export function RisksPage(props: {
  risks: Risk[]
  meta: PageMeta
  tableState: TableState
  canManage: boolean
  onTableChange: (state: TableState) => void
  onCreate: () => void
  onPreloadCreate?: () => void
  onEdit: (item: Risk) => void
  onDelete: (id: string) => void
  activeCompanyName?: string
}) {
  const levelColor = (level: Risk['level']) =>
    level === 'CRITICAL' ? 'error' : level === 'HIGH' ? 'warning' : level === 'MEDIUM' ? 'info' : 'success'

  return (
    <Paper className="panel" variant="outlined">
      <ActiveCompanyBanner name={props.activeCompanyName} />
      <TableHeader title="Matriz de riesgos" canCreate={props.canManage} onCreate={props.onCreate} onPreloadCreate={props.onPreloadCreate} />
      <TableControls state={props.tableState} onChange={props.onTableChange} placeholder="Buscar por titulo o descripcion" />
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Riesgo</TableCell>
              <TableCell>Empresa</TableCell>
              <TableCell>Nivel</TableCell>
              <TableCell>Registrado</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {props.risks.map((risk) => (
              <TableRow key={risk.id} hover>
                <TableCell>
                  {risk.title}
                  {risk.description && (
                    <Chip size="small" label={risk.description} variant="outlined" sx={{ ml: 1, maxWidth: 320 }} />
                  )}
                </TableCell>
                <TableCell>{risk.company?.name ?? '-'}</TableCell>
                <TableCell>
                  <Chip size="small" label={riskLevelLabels[risk.level]} color={levelColor(risk.level)} variant="outlined" />
                </TableCell>
                <TableCell>{risk.createdAt.slice(0, 10)}</TableCell>
                <TableCell align="right">
                  <IconButton disabled={!props.canManage} onClick={() => props.onEdit(risk)}>
                    <Edit />
                  </IconButton>
                  <IconButton disabled={!props.canManage} color="error" onClick={() => props.onDelete(risk.id)}>
                    <Delete />
                  </IconButton>
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
