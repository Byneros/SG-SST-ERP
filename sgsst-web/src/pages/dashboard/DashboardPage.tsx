import { Box, Button, Grid, Paper, Stack, Typography } from '@mui/material'
import type { ReactNode } from 'react'
import type { ReportFormat } from '../../api/client'
import { ActiveCompanyBanner } from '../../components/TablePieces'
import type { Company, Employee } from '../../types'

export function DashboardPage({
  stats,
  companies,
  employees,
  activeCompanyName,
  canExport,
  onDownloadReport,
  onScheduleReport,
}: {
  stats: Array<{ label: string; value: string | number; icon: ReactNode }>
  companies: Company[]
  employees: Employee[]
  activeCompanyName?: string
  canExport: boolean
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
    </>
  )
}
