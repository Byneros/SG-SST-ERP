import { Delete, Edit } from '@mui/icons-material'
import { Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { useState } from 'react'
import { ActiveCompanyBanner, Pager, TableControls, TableHeader, ViewBreadcrumb } from '../../components/TablePieces'
import type { PageMeta, TableState, UnplannedInspection } from '../../types'

const statusLabels: Record<UnplannedInspection['status'], string> = {
  PLANNED: 'Abierta',
  IN_PROGRESS: 'En proceso',
  COMPLETED: 'Cerrada',
  CANCELLED: 'Cancelada',
}

export function UnplannedInspectionsPage(props: {
  inspections: UnplannedInspection[]
  meta: PageMeta
  tableState: TableState
  canManage: boolean
  onTableChange: (state: TableState) => void
  onCreate: () => void
  onPreloadCreate?: () => void
  onEdit: (item: UnplannedInspection) => void
  onDelete: (id: string) => void
  onAddFinding: (inspectionId: string, description: string, severity: string, riskLevel?: string) => void
  onAddAction: (findingId: string) => void
  loading?: boolean
  activeCompanyName?: string
}) {
  const [selected, setSelected] = useState<UnplannedInspection | null>(null)
  const [newFinding, setNewFinding] = useState({ description: '', severity: 'MINOR', withRisk: false, riskLevel: 'MEDIUM' })

  const openFindingDialog = (inspection: UnplannedInspection) => {
    setSelected(inspection)
    setNewFinding({ description: '', severity: 'MINOR', withRisk: false, riskLevel: 'MEDIUM' })
  }

  return (
    <Paper className="panel" variant="outlined">
      <ActiveCompanyBanner name={props.activeCompanyName} />
      <ViewBreadcrumb view="Inspecciones no planeadas" />
      <TableHeader title="Inspecciones no planeadas" canCreate={props.canManage} onCreate={props.onCreate} onPreloadCreate={props.onPreloadCreate} />
      <TableControls state={props.tableState} onChange={props.onTableChange} placeholder="Buscar por titulo o motivo" />
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Inspeccion</TableCell>
              <TableCell>Motivo</TableCell>
              <TableCell>Sede</TableCell>
              <TableCell>Fecha</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell>Hallazgos / Riesgos</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {props.inspections.map((inspection) => {
              const withRisk = inspection.findings.filter((f) => f.riskId).length
              return (
                <TableRow key={inspection.id} hover>
                  <TableCell>{inspection.title}</TableCell>
                  <TableCell sx={{ maxWidth: 220 }}>{inspection.reason}</TableCell>
                  <TableCell>{inspection.site?.name ?? '-'}</TableCell>
                  <TableCell>{inspection.createdAt.slice(0, 10)}</TableCell>
                  <TableCell>
                    <Chip size="small" label={statusLabels[inspection.status]} />
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5}>
                      <Chip size="small" variant="outlined" label={`${inspection.findings.length} hallazgo(s)`} />
                      {withRisk > 0 && <Chip size="small" color="warning" variant="outlined" label={`${withRisk} riesgo(s)`} />}
                    </Stack>
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" disabled={!props.canManage} onClick={() => openFindingDialog(inspection)}>
                      Hallazgos
                    </Button>
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
                  <Typography variant="body2" color="text.secondary">Sin inspecciones no planeadas.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <Pager meta={props.meta} state={props.tableState} onChange={props.onTableChange} />

      <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Hallazgos: {selected?.title}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">Motivo: {selected?.reason}</Typography>
            {props.canManage && (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} useFlexGap flexWrap="wrap">
                <TextField
                  size="small" label="Descripcion del hallazgo" required sx={{ flex: 1, minWidth: 200 }}
                  value={newFinding.description}
                  onChange={(event) => setNewFinding((c) => ({ ...c, description: event.target.value }))}
                />
                <TextField
                  size="small" select label="Severidad" sx={{ maxWidth: 140 }}
                  value={newFinding.severity}
                  onChange={(event) => setNewFinding((c) => ({ ...c, severity: event.target.value }))}
                  SelectProps={{ native: true }}
                >
                  <option value="MINOR">Menor</option>
                  <option value="MAJOR">Mayor</option>
                  <option value="CRITICAL">Critico</option>
                </TextField>
                <TextField
                  size="small" select label="Genera riesgo" sx={{ maxWidth: 170 }}
                  value={newFinding.withRisk ? newFinding.riskLevel : ''}
                  onChange={(event) => setNewFinding((c) => ({ ...c, withRisk: event.target.value !== '', riskLevel: event.target.value || 'MEDIUM' }))}
                  SelectProps={{ native: true }}
                >
                  <option value="">No</option>
                  <option value="LOW">GTC-45: Bajo</option>
                  <option value="MEDIUM">GTC-45: Medio</option>
                  <option value="HIGH">GTC-45: Alto</option>
                  <option value="CRITICAL">GTC-45: Critico</option>
                </TextField>
                <Button
                  variant="outlined"
                  disabled={props.loading || !newFinding.description.trim()}
                  onClick={() => {
                    if (!selected) return
                    props.onAddFinding(
                      selected.id,
                      newFinding.description.trim(),
                      newFinding.severity,
                      newFinding.withRisk ? newFinding.riskLevel : undefined,
                    )
                    setNewFinding({ description: '', severity: 'MINOR', withRisk: false, riskLevel: 'MEDIUM' })
                    setSelected(null)
                  }}
                >
                  Registrar
                </Button>
              </Stack>
            )}
            {(selected?.findings ?? []).map((finding) => (
              <Box key={finding.id} sx={{ py: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip
                    size="small"
                    color={finding.severity === 'CRITICAL' ? 'error' : finding.severity === 'MAJOR' ? 'warning' : 'default'}
                    label={finding.severity}
                  />
                  <Typography variant="body2" sx={{ flex: 1 }}>{finding.description}</Typography>
                  {props.canManage && !finding.action && (
                    <Button size="small" disabled={props.loading} onClick={() => props.onAddAction(finding.id)}>
                      Crear accion
                    </Button>
                  )}
                </Stack>
                {finding.risk && (
                  <Typography variant="caption" color="text.secondary">
                    Riesgo GTC-45: {finding.risk.title} ({finding.risk.level})
                  </Typography>
                )}
                {finding.action && (
                  <Typography variant="caption" color="text.secondary" display="block">
                    Accion: {finding.action.title} - {finding.action.responsible} - {finding.action.dueDate.slice(0, 10)} - {finding.action.status}
                  </Typography>
                )}
              </Box>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelected(null)}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  )
}
