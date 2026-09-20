import { Box, Button, Chip, Grid, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material'
import type { ReactNode } from 'react'
import type { ReportFormat } from '../../api/client'
import { ActiveCompanyBanner } from '../../components/TablePieces'
import type { Company, Employee, SiteKpi } from '../../types'

export function DashboardPage({
  stats,
  companies,
  employees,
  siteKpis,
  activeCompanyName,
  canExport,
  onOpenSite,
  onOpenSiteIncidents,
  onOpenSiteRisks,
  onDownloadReport,
  onScheduleReport,
}: {
  stats: Array<{ label: string; value: string | number; icon: ReactNode }>
  companies: Company[]
  employees: Employee[]
  siteKpis: SiteKpi[]
  activeCompanyName?: string
  canExport: boolean
  onOpenSite?: (siteId: string) => void
  onOpenSiteIncidents?: (siteId: string) => void
  onOpenSiteRisks?: (siteId: string) => void
  onDownloadReport: (format: ReportFormat) => void
  onScheduleReport: (format: ReportFormat) => void
}) {
  return (
    <>
      <ActiveCompanyBanner name={activeCompanyName} />
      {canExport && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="flex-end" sx={{ mb: 2 }}>
          <Button variant="outlined" onClick={() => onDownloadReport('pdf')}>
            Resumen PDF
          </Button>
          <Button variant="outlined" onClick={() => onDownloadReport('csv')}>
            Resumen CSV
          </Button>
          <Button variant="contained" onClick={() => onScheduleReport('pdf')}>
            Programar PDF
          </Button>
        </Stack>
      )}
      <Grid container spacing={2}>
        {stats.map((stat) => (
          <Grid key={stat.label} size={{ xs: 12, md: 4 }}>
            <Paper className="kpi-card" variant="outlined">
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="text.secondary">{stat.label}</Typography>
                  <Typography variant="h5">{stat.value}</Typography>
                </Box>
                <Box className="kpi-icon">{stat.icon}</Box>
              </Stack>
            </Paper>
          </Grid>
        ))}
      </Grid>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Paper className="panel" variant="outlined">
            <Typography variant="h6">Ultimas empresas</Typography>
            <Stack spacing={1.2} sx={{ mt: 2 }}>
              {companies.slice(0, 5).map((company) => (
                <Stack key={company.id} direction="row" justifyContent="space-between">
                  <Typography fontWeight={700}>{company.name}</Typography>
                  <Typography color="text.secondary">{company.nit}</Typography>
                </Stack>
              ))}
              {companies.length === 0 && <Typography color="text.secondary">Sin empresas registradas.</Typography>}
            </Stack>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, lg: 6 }}>
          <Paper className="panel" variant="outlined">
            <Typography variant="h6">Ultimos empleados</Typography>
            <Stack spacing={1.2} sx={{ mt: 2 }}>
              {employees.slice(0, 5).map((employee) => (
                <Stack key={employee.id} direction="row" justifyContent="space-between">
                  <Typography fontWeight={700}>
                    {employee.firstName} {employee.lastName}
                  </Typography>
                  <Typography color="text.secondary">{employee.position}</Typography>
                </Stack>
              ))}
              {employees.length === 0 && <Typography color="text.secondary">Sin empleados registrados.</Typography>}
            </Stack>
          </Paper>
        </Grid>
      </Grid>
      {siteKpis.length > 0 && (
        <Paper className="panel" variant="outlined" sx={{ mt: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="h6">Sedes</Typography>
            <Typography color="text.secondary" variant="body2">
              Empleados activos, riesgos criticos e incidentes abiertos por sede
            </Typography>
          </Stack>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Sede</TableCell>
                  <TableCell align="right">Empleados</TableCell>
                  <TableCell align="right">Riesgos criticos</TableCell>
                  <TableCell align="right">Incidentes abiertos</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {siteKpis.map((kpi) => (
                  <TableRow
                    key={kpi.siteId}
                    hover
                    // Fila clickeable: abre Empleados filtrado por esta sede.
                    onClick={onOpenSite ? () => onOpenSite(kpi.siteId) : undefined}
                    sx={
                      onOpenSite
                        ? { cursor: 'pointer' }
                        : undefined
                    }
                  >
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography fontWeight={700}>
                          {kpi.code ? `${kpi.name} (${kpi.code})` : kpi.name}
                        </Typography>
                        {kpi.isMain && <Chip size="small" label="Principal" color="primary" variant="outlined" />}
                      </Stack>
                    </TableCell>
                    <TableCell align="right">{kpi.employees}</TableCell>
                    <TableCell
                      align="right"
                      onClick={
                        onOpenSiteRisks
                          ? (event) => {
                              // El click en el conteo manda a Riesgos, no a Empleados.
                              event.stopPropagation()
                              onOpenSiteRisks(kpi.siteId)
                            }
                          : undefined
                      }
                      sx={
                        onOpenSiteRisks
                          ? { cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }
                          : undefined
                      }
                    >
                      {kpi.criticalRisks}
                    </TableCell>
                    <TableCell
                      align="right"
                      onClick={
                        onOpenSiteIncidents
                          ? (event) => {
                              // El click en el conteo manda a Incidentes, no a Empleados.
                              event.stopPropagation()
                              onOpenSiteIncidents(kpi.siteId)
                            }
                          : undefined
                      }
                      sx={
                        onOpenSiteIncidents
                          ? { cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }
                          : undefined
                      }
                    >
                      {kpi.openIncidents}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </>
  )
}
