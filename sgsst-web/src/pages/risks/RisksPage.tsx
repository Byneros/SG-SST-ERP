import { Delete, Edit } from '@mui/icons-material'
import { Chip, IconButton, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField } from '@mui/material'
import { ActiveCompanyBanner, ActiveSiteFilterChip, Pager, TableControls, TableHeader, ViewBreadcrumb } from '../../components/TablePieces'
import { riskLevelLabels } from '../../constants/catalogs'
import type { PageMeta, Risk, Site, TableState } from '../../types'

export function RisksPage(props: {
  risks: Risk[]
  meta: PageMeta
  tableState: TableState
  canManage: boolean
  sites: Site[]
  siteFilter: string
  onSiteFilterChange: (siteId: string) => void
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
      <ViewBreadcrumb view="Riesgos" />
      <TableHeader title="Matriz de riesgos" canCreate={props.canManage} onCreate={props.onCreate} onPreloadCreate={props.onPreloadCreate} />
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
              <TableCell>Riesgo</TableCell>
              <TableCell>Empresa</TableCell>
              <TableCell>Sede</TableCell>
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
                <TableCell>{risk.site?.name ?? '-'}</TableCell>
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
