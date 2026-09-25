import { Delete, Edit } from '@mui/icons-material'
import { Chip, IconButton, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, MenuItem, Typography } from '@mui/material'
import { ActiveCompanyBanner, ActiveSiteFilterChip, Pager, TableControls, TableHeader, ViewBreadcrumb } from '../../components/TablePieces'
import type { PageMeta, PlannedInspection, Site, TableState } from '../../types'

const statusLabels: Record<PlannedInspection['status'], string> = {
  PLANNED: 'Planeada',
  IN_PROGRESS: 'En ejecucion',
  COMPLETED: 'Ejecutada',
  CANCELLED: 'Cancelada',
}

const statusColors: Record<PlannedInspection['status'], 'default' | 'primary' | 'success' | 'warning'> = {
  PLANNED: 'default',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'default',
}

export function PlannedInspectionsPage(props: {
  inspections: PlannedInspection[]
  meta: PageMeta
  tableState: TableState
  canManage: boolean
  sites: Site[]
  siteFilter: string
  onSiteFilterChange: (siteId: string) => void
  onTableChange: (state: TableState) => void
  onCreate: () => void
  onPreloadCreate?: () => void
  onEdit: (item: PlannedInspection) => void
  onDelete: (id: string) => void
  activeCompanyName?: string
}) {
  return (
    <Paper className="panel" variant="outlined">
      <ActiveCompanyBanner name={props.activeCompanyName} />
      <ViewBreadcrumb view="Inspecciones planeadas" />
      <TableHeader title="Inspecciones planeadas" canCreate={props.canManage} onCreate={props.onCreate} onPreloadCreate={props.onPreloadCreate} />
      {props.siteFilter !== 'all' && (
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <ActiveSiteFilterChip
            siteName={props.sites.find((site) => site.id === props.siteFilter)?.name ?? (props.siteFilter === 'none' ? 'Sin sede' : props.siteFilter)}
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
          <MenuItem value="none">Sin sede</MenuItem>
        </TextField>
      </Stack>
      <TableControls state={props.tableState} onChange={props.onTableChange} placeholder="Buscar por titulo o tipo" />
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Inspeccion</TableCell>
              <TableCell>Sede</TableCell>
              <TableCell>Programada</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell>Checklist</TableCell>
              <TableCell>Hallazgos</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {props.inspections.map((inspection) => {
              const answered = inspection.items.filter((item) => item.answer).length
              return (
                <TableRow key={inspection.id} hover>
                  <TableCell>{inspection.title}</TableCell>
                  <TableCell>{inspection.site?.name ?? '-'}</TableCell>
                  <TableCell>{inspection.scheduledAt.slice(0, 10)}</TableCell>
                  <TableCell>
                    <Chip size="small" color={statusColors[inspection.status]} label={statusLabels[inspection.status]} />
                  </TableCell>
                  <TableCell>{answered}/{inspection.items.length}</TableCell>
                  <TableCell>
                    {inspection.findings.length > 0 ? (
                      <Chip size="small" color="error" variant="outlined" label={String(inspection.findings.length)} />
                    ) : (
                      '0'
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <IconButton disabled={!props.canManage} onClick={() => props.onEdit(inspection)}>
                      <Edit />
                    </IconButton>
                    <IconButton disabled={!props.canManage} color="error" onClick={() => props.onDelete(inspection.id)}>
                      <Delete />
                    </IconButton>
                  </TableCell>
                </TableRow>
              )
            })}
            {props.inspections.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography variant="body2" color="text.secondary">Sin inspecciones registradas.</Typography>
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
