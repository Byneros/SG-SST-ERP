import { Assessment, AssignmentLate, FactCheck, TrendingDown } from '@mui/icons-material'
import { Box, Button, Chip, Grid, LinearProgress, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material'
import type { ReactNode } from 'react'
import type { ReportFormat } from '../../api/client'
import { ActiveCompanyBanner } from '../../components/TablePieces'
import type { Company, ComplianceSummary, Employee, SiteKpi } from '../../types'

export function DashboardPage({
  stats,
  companies,
  employees,
  siteKpis,
  compliance,
  activeCompanyName,
  canExport,
  onOpenSite,
  onOpenSiteIncidents,
  onOpenSiteRisks,
  onOpenSiteTrainings,
  onOpenSiteDocuments,
  onDownloadReport,
  onScheduleReport,
}: {
  stats: Array<{ label: string; value: string | number; icon: ReactNode }>
  companies: Company[]
  employees: Employee[]
  siteKpis: SiteKpi[]
  compliance?: ComplianceSummary
  activeCompanyName?: string
  canExport: boolean
  onOpenSite?: (siteId: string) => void
  onOpenSiteIncidents?: (siteId: string) => void
  onOpenSiteRisks?: (siteId: string) => void
  onOpenSiteTrainings?: (siteId: string) => void
  onOpenSiteDocuments?: (siteId: string) => void
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
      {compliance && (
        <Grid container spacing={2} sx={{ mt: 0 }}>
          <Grid size={{ xs: 12, md: 6, lg: 3 }}>
            <Paper className="kpi-card" variant="outlined">
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="text.secondary">Cumplimiento 0312</Typography>
                  {compliance.evaluationsAvgCompliance === null || compliance.evaluationsCount === 0 ? (
                    <Typography variant="h5">-</Typography>
                  ) : (
                    <>
                      <Typography variant="h5">{compliance.evaluationsAvgCompliance}%</Typography>
                      <LinearProgress variant="determinate" value={Math.min(100, compliance.evaluationsAvgCompliance)} sx={{ mt: 1 }} />
                    </>
                  )}
                  <Typography variant="caption" color="text.secondary">{compliance.evaluationsCount} evaluaciones activas</Typography>
                </Box>
                <Box className="kpi-icon"><FactCheck /></Box>
              </Stack>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, md: 6, lg: 3 }}>
            <Paper className="kpi-card" variant="outlined">
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="text.secondary">Indicadores fuera de meta</Typography>
                  <Typography variant="h5">{compliance.indicatorsOffTarget} / {compliance.indicatorsCount}</Typography>
                  <Typography variant="caption" color="text.secondary">valor actual vs. ultima meta</Typography>
                </Box>
                <Box className="kpi-icon"><TrendingDown /></Box>
              </Stack>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, md: 6, lg: 3 }}>
            <Paper className="kpi-card" variant="outlined">
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="text.secondary">Auditorias pendientes</Typography>
                  <Typography variant="h5">{compliance.pendingAudits}</Typography>
                  <Typography variant="caption" color="text.secondary">{compliance.openFindings} hallazgos abiertos</Typography>
                </Box>
                <Box className="kpi-icon"><Assessment /></Box>
              </Stack>
              {compliance.pendingAudits > 0 && <LinearProgress variant="determinate" value={100} color="warning" sx={{ mt: 1 }} />}
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, md: 6, lg: 3 }}>
            <Paper className="kpi-card" variant="outlined">
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="text.secondary">Acciones correctivas vencidas</Typography>
                  <Typography variant="h5">{compliance.overdueCorrectiveActions}</Typography>
                  <Typography variant="caption" color="text.secondary">compromisos con fecha vencida</Typography>
                </Box>
                <Box className="kpi-icon"><AssignmentLate /></Box>
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      )}
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
                  <TableCell align="right">Capacitaciones</TableCell>
                  <TableCell align="right">Documentos</TableCell>
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
                    {([
                      {
                        key: 'criticalRisks',
                        value: kpi.criticalRisks,
                        onOpen: onOpenSiteRisks,
                      },
                      {
                        key: 'openIncidents',
                        value: kpi.openIncidents,
                        onOpen: onOpenSiteIncidents,
                      },
                      {
                        key: 'trainings',
                        value: kpi.trainings,
                        onOpen: onOpenSiteTrainings,
                      },
                      {
                        key: 'documents',
                        value: kpi.documents,
                        onOpen: onOpenSiteDocuments,
                      },
                    ]).map(({ key, value, onOpen }) => (
                      <TableCell
                        key={key}
                        align="right"
                        onClick={
                          onOpen
                            ? (event) => {
                                // El click en el conteo manda a su vista, no a Empleados.
                                event.stopPropagation()
                                onOpen(kpi.siteId)
                              }
                            : undefined
                        }
                        sx={
                          onOpen
                            ? { cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: 3 }
                            : undefined
                        }
                      >
                        {value}
                      </TableCell>
                    ))}
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
