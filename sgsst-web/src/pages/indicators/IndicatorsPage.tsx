import { Delete, Edit } from '@mui/icons-material'
import { Chip, IconButton, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography } from '@mui/material'
import { ActiveCompanyBanner, Pager, TableControls, TableHeader } from '../../components/TablePieces'
import type { Indicator, PageMeta, TableState } from '../../types'

/** Verifica el periodo contra la meta correspondiente y colore el chip segun direction. */
export function indicatorCompliance(indicator: Indicator, period: string): 'success' | 'warning' | 'error' | null {
  const target = indicator.targets?.find((item) => item.period === period)?.target
  if (target === undefined || !Number.isFinite(indicator.value)) return null
  if (indicator.direction === 'HIGHER_IS_BETTER') {
    if (indicator.value >= target) return 'success'
    if (indicator.value >= target * 0.9) return 'warning'
    return 'error'
  }
  if (indicator.value <= target) return 'success'
  if (indicator.value <= target * 1.1) return 'warning'
  return 'error'
}

export function IndicatorsPage(props: {
  indicators: Indicator[]
  meta: PageMeta
  tableState: TableState
  canManage: boolean
  onTableChange: (state: TableState) => void
  onCreate: () => void
  onPreloadCreate?: () => void
  onEdit: (item: Indicator) => void
  onDelete: (id: string) => void
  activeCompanyName?: string
}) {
  return (
    <Paper className="panel" variant="outlined">
      <ActiveCompanyBanner name={props.activeCompanyName} />
      <TableHeader title="Indicadores SG-SST" canCreate={props.canManage} onCreate={props.onCreate} onPreloadCreate={props.onPreloadCreate} />
      <TableControls state={props.tableState} onChange={props.onTableChange} placeholder="Buscar indicador, codigo o formula" />
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Indicador</TableCell>
              <TableCell>Empresa</TableCell>
              <TableCell>Sede</TableCell>
              <TableCell>Valor actual</TableCell>
              <TableCell>Tendencia</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {props.indicators.map((indicator) => (
              <TableRow key={indicator.id} hover>
                <TableCell>
                  <Typography variant="subtitle2">{indicator.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {[indicator.code, indicator.unit].filter(Boolean).join(' · ') || '-'}
                  </Typography>
                </TableCell>
                <TableCell>{indicator.company?.name ?? '-'}</TableCell>
                <TableCell>{indicator.site?.name ?? '-'}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1} alignItems="baseline">
                    <Typography variant="body2">{indicator.value}</Typography>
                    {indicator.targets?.[0] !== undefined && (
                      <Typography variant="caption" color="text.secondary">meta {indicator.targets[0].target}</Typography>
                    )}
                  </Stack>
                  {indicator.formulaDefinition && (
                    <Typography variant="caption" color="text.secondary" display="block">{indicator.formulaDefinition}</Typography>
                  )}
                  {indicator.direction === 'HIGHER_IS_BETTER' && (
                    <Typography variant="caption" color="text.secondary" display="block">mayor es mejor</Typography>
                  )}
                </TableCell>
                <TableCell sx={{ minWidth: 130 }}>
                  {indicator.measurements?.length ? (
                    <Stack>
                      {indicator.measurements.slice(-4).map((measurement) => (
                        <Typography key={measurement.id} variant="caption" sx={{ whiteSpace: 'nowrap' }}>
                          {measurement.period}: {measurement.value}
                        </Typography>
                      ))}
                    </Stack>
                  ) : (
                    <Typography variant="caption" color="text.secondary">Sin mediciones</Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1}>
                    <Chip size="small" label={indicator.direction === 'HIGHER_IS_BETTER' ? 'Ascendente' : 'Descendente'} variant="outlined" />
                  </Stack>
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Editar / metas / mediciones">
                    <IconButton onClick={() => props.onEdit(indicator)}><Edit /></IconButton>
                  </Tooltip>
                  <IconButton disabled={!props.canManage} color="error" onClick={() => props.onDelete(indicator.id)}><Delete /></IconButton>
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
