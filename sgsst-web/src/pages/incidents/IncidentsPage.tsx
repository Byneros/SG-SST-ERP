import { Delete, Edit } from '@mui/icons-material'
import { Chip, IconButton, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField } from '@mui/material'
import { ActiveChip, ActiveCompanyBanner, Pager, TableControls, TableHeader } from '../../components/TablePieces'
import { incidentStatusLabels } from '../../constants/catalogs'
import type { Incident, PageMeta, Site, TableState } from '../../types'

export function IncidentsPage(props: {
  incidents: Incident[]
  meta: PageMeta
  tableState: TableState
  canManage: boolean
  canEdit?: boolean
  sites: Site[]
  siteFilter: string
  onSiteFilterChange: (siteId: string) => void
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
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <TextField
          select
          size="small"
          label="Sede"
          value={props.siteFilter}
          onChange={(event) => props.onSiteFilterChange(event.target.value)}
          sx={{ minWidth: 240 }}
        >
          <MenuItem value="all">Todas las sedes</MenuItem>
          {props.sites.map((site) => (
            <MenuItem key={site.id} value={site.id}>
              {site.code ? `${site.name} (${site.code})` : site.name}
            </MenuItem>
          ))}
          <MenuItem value="none">Sin sede asignada</MenuItem>
        </TextField>
      </Stack>
      <TableControls state={props.tableState} onChange={props.onTableChange} placeholder="Buscar por titulo o descripcion" />
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Incidente</TableCell>
              <TableCell>Empresa</TableCell>
              <TableCell>Sede</TableCell>
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
                <TableCell>{incident.site?.name ?? '-'}</TableCell>
                <TableCell>{incident.date.slice(0, 10)}</TableCell>
                <TableCell>
                  <ActiveChip active={incident.status !== 'RESOLVED'} />
                </TableCell>
                <TableCell align="right">
                  <IconButton disabled={!props.canEdit} onClick={() => props.onEdit(incident)}>
                    <Edit />
                  </IconButton>
                  <IconButton disabled={!props.canEdit} color="error" onClick={() => props.onDelete(incident.id)}>
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
