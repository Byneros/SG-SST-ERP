import { Delete, Edit } from '@mui/icons-material'
import { Chip, IconButton, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material'
import { ActiveChip, ActiveCompanyBanner, Pager, TableControls, TableHeader } from '../../components/TablePieces'
import { incidentStatusLabels } from '../../constants/catalogs'
import type { Incident, PageMeta, TableState } from '../../types'

export function IncidentsPage(props: {
  incidents: Incident[]
  meta: PageMeta
  tableState: TableState
  canManage: boolean
  onTableChange: (state: TableState) => void
  onCreate: () => void
  onPreloadCreate?: () => void
  onEdit: (item: Incident) => void
  onDelete: (id: string) => void
  activeCompanyName?: string
}) {
  return (
    <Paper className="panel" variant="outlined">
      <ActiveCompanyBanner name={props.activeCompanyName} />
      <TableHeader title="Incidentes" canCreate={props.canManage} onCreate={props.onCreate} onPreloadCreate={props.onPreloadCreate} />
      <TableControls state={props.tableState} onChange={props.onTableChange} placeholder="Buscar por titulo o descripcion" />
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Incidente</TableCell>
              <TableCell>Empresa</TableCell>
              <TableCell>Fecha</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {props.incidents.map((incident) => (
              <TableRow key={incident.id} hover>
                <TableCell>
                  {incident.title}
                  <Chip
                    size="small"
                    label={incidentStatusLabels[incident.status]}
                    variant="outlined"
                    color={incident.status === 'RESOLVED' ? 'success' : incident.status === 'IN_PROGRESS' ? 'info' : 'warning'}
                    sx={{ ml: 1 }}
                  />
                </TableCell>
                <TableCell>{incident.company?.name ?? '-'}</TableCell>
                <TableCell>{incident.date.slice(0, 10)}</TableCell>
                <TableCell>
                  <ActiveChip active={incident.status !== 'RESOLVED'} />
                </TableCell>
                <TableCell align="right">
                  <IconButton disabled={!props.canManage} onClick={() => props.onEdit(incident)}>
                    <Edit />
                  </IconButton>
                  <IconButton disabled={!props.canManage} color="error" onClick={() => props.onDelete(incident.id)}>
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
