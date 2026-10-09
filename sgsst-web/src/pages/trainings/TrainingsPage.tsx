import { Delete, Edit } from '@mui/icons-material'
import { IconButton, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField } from '@mui/material'
import { ModuleAssistantButton } from '../../components/ModuleAssistantButton'
import { ActiveCompanyBanner, ActiveSiteFilterChip, Pager, TableControls, TableHeader, ViewBreadcrumb } from '../../components/TablePieces'
import type { PageMeta, Site, TableState, Training, View } from '../../types'

export function TrainingsPage(props: {
  trainings: Training[]
  meta: PageMeta
  tableState: TableState
  canManage: boolean
  sites: Site[]
  siteFilter: string
  onSiteFilterChange: (siteId: string) => void
  onTableChange: (state: TableState) => void
  onCreate: () => void
  onPreloadCreate?: () => void
  onEdit: (item: Training) => void
  onDelete: (id: string) => void
  onOpenAssistant?: (view: View, assistantId: string) => void
  activeCompanyName?: string
}) {
  return (
    <Paper className="panel" variant="outlined">
      <ActiveCompanyBanner name={props.activeCompanyName} />
      <ViewBreadcrumb view="Capacitaciones" />
      <TableHeader
        title="Capacitaciones"
        canCreate={props.canManage}
        onCreate={props.onCreate}
        onPreloadCreate={props.onPreloadCreate}
        assistant={props.onOpenAssistant && <ModuleAssistantButton assistantId="trainings" onOpen={props.onOpenAssistant} />}
      />
      {props.siteFilter !== 'all' && (
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <ActiveSiteFilterChip
            siteName={props.sites.find((site) => site.id === props.siteFilter)?.name ?? (props.siteFilter === 'none' ? 'Sin sede asignada' : props.siteFilter)}
            onClear={() => props.onSiteFilterChange('all')}
          />
        </Stack>
      )}
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
              <TableCell>Capacitacion</TableCell>
              <TableCell>Empresa</TableCell>
              <TableCell>Sede</TableCell>
              <TableCell>Fecha</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {props.trainings.map((training) => (
              <TableRow key={training.id} hover>
                <TableCell>{training.title}</TableCell>
                <TableCell>{training.company?.name ?? '-'}</TableCell>
                <TableCell>{training.site?.name ?? '-'}</TableCell>
                <TableCell>{training.date.slice(0, 10)}</TableCell>
                <TableCell align="right">
                  <IconButton disabled={!props.canManage} onClick={() => props.onEdit(training)}>
                    <Edit />
                  </IconButton>
                  <IconButton disabled={!props.canManage} color="error" onClick={() => props.onDelete(training.id)}>
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
