import { Delete, Edit } from '@mui/icons-material'
import { IconButton, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material'
import { ActiveCompanyBanner, Pager, TableControls, TableHeader } from '../../components/TablePieces'
import type { PageMeta, Site, TableState } from '../../types'

export function SitesPage(props: {
  sites: Site[]
  meta: PageMeta
  tableState: TableState
  canManage: boolean
  onTableChange: (state: TableState) => void
  onCreate: () => void
  onPreloadCreate?: () => void
  onEdit: (item: Site) => void
  onDelete: (id: string) => void
  activeCompanyName?: string
}) {
  return (
    <Paper className="panel" variant="outlined">
      <ActiveCompanyBanner name={props.activeCompanyName} />
      <TableHeader title="Sedes" canCreate={props.canManage} onCreate={props.onCreate} onPreloadCreate={props.onPreloadCreate} />
      <TableControls state={props.tableState} onChange={props.onTableChange} placeholder="Buscar por nombre, codigo o ciudad" />
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Sede</TableCell>
              <TableCell>Codigo</TableCell>
              <TableCell>Ciudad</TableCell>
              <TableCell>Direccion</TableCell>
              <TableCell>Empresa</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {props.sites.map((site) => (
              <TableRow key={site.id} hover>
                <TableCell>
                  {site.name}
                  {site.isMain ? ' (principal)' : ''}
                </TableCell>
                <TableCell>{site.code ?? '-'}</TableCell>
                <TableCell>{[site.city, site.department].filter(Boolean).join(', ') || '-'}</TableCell>
                <TableCell>{site.address ?? '-'}</TableCell>
                <TableCell>{site.company?.name ?? '-'}</TableCell>
                <TableCell align="right">
                  <IconButton disabled={!props.canManage} onClick={() => props.onEdit(site)}>
                    <Edit />
                  </IconButton>
                  <IconButton disabled={!props.canManage} color="error" onClick={() => props.onDelete(site.id)}>
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
