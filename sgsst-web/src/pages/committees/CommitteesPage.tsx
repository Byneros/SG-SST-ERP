import { Delete, Edit, TrackChanges } from '@mui/icons-material'
import { Box, Chip, IconButton, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material'
import { ActiveCompanyBanner, Pager, TableControls, TableHeader } from '../../components/TablePieces'
import type { Committee, CommitteeType, PageMeta, TableState } from '../../types'

const typeLabel: Record<CommitteeType, string> = {
  COPASST: 'COPASST',
  CONVIVENCIA: 'Comité de Convivencia',
}

const typeColor: Record<CommitteeType, 'primary' | 'secondary'> = {
  COPASST: 'primary',
  CONVIVENCIA: 'secondary',
}

export function CommitteesPage(props: {
  committees: Committee[]
  meta: PageMeta
  tableState: TableState
  canManage: boolean
  onTableChange: (state: TableState) => void
  onCreate: () => void
  onPreloadCreate?: () => void
  onEdit: (item: Committee) => void
  onDelete: (item: Committee) => void
  onOpenDetail: (item: Committee) => void
  activeCompanyName?: string
}) {
  return (
    <Paper className="panel" variant="outlined">
      <ActiveCompanyBanner name={props.activeCompanyName} />
      <TableHeader title="Comités (COPASST y Convivencia)" canCreate={props.canManage} onCreate={props.onCreate} onPreloadCreate={props.onPreloadCreate} />
      <TableControls state={props.tableState} onChange={props.onTableChange} placeholder="Buscar por nombre" />
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Comité</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell>Periodo</TableCell>
              <TableCell>Integrantes</TableCell>
              <TableCell>Reuniones</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {props.committees.map((committee) => (
              <TableRow key={committee.id} hover>
                <TableCell>
                  <Typography variant="body2">{committee.name}</Typography>
                </TableCell>
                <TableCell>
                  <Chip size="small" label={typeLabel[committee.type]} color={typeColor[committee.type]} variant="outlined" />
                </TableCell>
                <TableCell>
                  <Typography variant="body2">
                    {new Date(committee.periodStart).toLocaleDateString()} — {new Date(committee.periodEnd).toLocaleDateString()}
                  </Typography>
                </TableCell>
                <TableCell>{committee._count?.members ?? committee.members?.length ?? 0}</TableCell>
                <TableCell>{committee._count?.meetings ?? committee.meetings?.length ?? 0}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={committee.status === 'ACTIVE' ? 'Activo' : 'Cerrado'}
                    color={committee.status === 'ACTIVE' ? 'success' : 'default'}
                    variant="outlined"
                  />
                </TableCell>
                <TableCell align="right">
                  <IconButton size="small" color="primary" title="Integrantes, reuniones y compromisos" onClick={() => props.onOpenDetail(committee)}>
                    <TrackChanges />
                  </IconButton>
                  <IconButton size="small" disabled={!props.canManage} onClick={() => props.onEdit(committee)}>
                    <Edit />
                  </IconButton>
                  <IconButton size="small" disabled={!props.canManage} color="error" onClick={() => props.onDelete(committee)}>
                    <Delete />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {props.committees.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
                    Sin comités para mostrar.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <Pager meta={props.meta} state={props.tableState} onChange={props.onTableChange} />
      <Box sx={{ mt: 1 }}>
        <Typography variant="caption" color="text.secondary">
          Usa “Ver detalle” para gestionar integrantes, reuniones con acta y compromisos con seguimiento.
        </Typography>
      </Box>
    </Paper>
  )
}
