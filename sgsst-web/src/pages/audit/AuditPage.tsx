import { Chip, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography, Box } from '@mui/material'
import { Pager } from '../../components/TablePieces'
import type { AuditLog, PageMeta, TableState } from '../../types'

export function AuditPage(props: {
  logs: AuditLog[]
  meta: PageMeta
  tableState: TableState
  onTableChange: (state: TableState) => void
}) {
  return (
    <Paper className="panel" variant="outlined">
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h6">Auditoria</Typography>
          <Typography color="text.secondary">Registro de creacion, edicion, desactivacion y reactivacion.</Typography>
        </Box>
      </Stack>
      <TextField
        size="small"
        placeholder="Buscar por accion, entidad, actor o ID"
        value={props.tableState.search}
        onChange={(event) =>
          props.onTableChange({ ...props.tableState, page: 1, search: event.target.value })
        }
        sx={{ mb: 2, minWidth: { md: 360 } }}
      />
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Fecha</TableCell>
              <TableCell>Accion</TableCell>
              <TableCell>Entidad</TableCell>
              <TableCell>Actor</TableCell>
              <TableCell>ID afectado</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {props.logs.map((log) => (
              <TableRow key={log.id} hover>
                <TableCell>{new Date(log.createdAt).toLocaleString()}</TableCell>
                <TableCell>
                  <Chip size="small" label={log.action} color="primary" variant="outlined" />
                </TableCell>
                <TableCell>{log.entity}</TableCell>
                <TableCell>{log.actor ? `${log.actor.name} (${log.actor.role})` : '-'}</TableCell>
                <TableCell>{log.entityId ?? '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Pager meta={props.meta} state={props.tableState} onChange={props.onTableChange} />
    </Paper>
  )
}
