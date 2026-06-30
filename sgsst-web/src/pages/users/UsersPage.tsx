import { Delete, Edit, RestoreFromTrash } from '@mui/icons-material'
import { Chip, IconButton, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material'
import { ActiveChip, ActiveCompanyBanner, Pager, TableControls, TableHeader } from '../../components/TablePieces'
import type { PageMeta, SystemUser, TableState } from '../../types'

export function UsersPage(props: {
  users: SystemUser[]
  meta: PageMeta
  tableState: TableState
  canManage: boolean
  currentUserId: string
  onTableChange: (state: TableState) => void
  onCreate: () => void
  onPreloadCreate?: () => void
  onEdit: (item: SystemUser) => void
  onDelete: (id: string) => void
  onRestore: (id: string) => void
  activeCompanyName?: string
}) {
  return (
    <Paper className="panel" variant="outlined">
      <ActiveCompanyBanner name={props.activeCompanyName} />
      <TableHeader title="CRUD Usuarios" canCreate={props.canManage} onCreate={props.onCreate} onPreloadCreate={props.onPreloadCreate} />
      <TableControls state={props.tableState} onChange={props.onTableChange} placeholder="Buscar por nombre o correo" />
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Usuario</TableCell>
              <TableCell>Correo</TableCell>
              <TableCell>Rol</TableCell>
              <TableCell>Empresa</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {props.users.map((item) => (
              <TableRow key={item.id} hover>
                <TableCell>{item.name}</TableCell>
                <TableCell>{item.email}</TableCell>
                <TableCell>
                  <Chip size="small" label={item.role} color="primary" variant="outlined" />
                </TableCell>
                <TableCell>{item.company?.name ?? '-'}</TableCell>
                <TableCell>
                  <ActiveChip active={item.isActive} />
                </TableCell>
                <TableCell align="right">
                  <IconButton disabled={!props.canManage} onClick={() => props.onEdit(item)}>
                    <Edit />
                  </IconButton>
                  {item.isActive ? (
                    <IconButton
                      disabled={!props.canManage || item.id === props.currentUserId}
                      color="error"
                      onClick={() => props.onDelete(item.id)}
                    >
                      <Delete />
                    </IconButton>
                  ) : (
                    <IconButton
                      disabled={!props.canManage}
                      color="success"
                      onClick={() => props.onRestore(item.id)}
                    >
                      <RestoreFromTrash />
                    </IconButton>
                  )}
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
