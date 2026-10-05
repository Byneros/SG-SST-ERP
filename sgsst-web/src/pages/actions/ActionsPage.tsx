import { useState } from 'react'
import { Delete, Edit, TaskAlt, Verified } from '@mui/icons-material'
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { ActiveCompanyBanner, Pager, TableControls, TableHeader } from '../../components/TablePieces'
import type { ActionEffectiveness, ActionKind, ActionPlan, ActionPlanFormValues, ActionStatus, Company, Finding, PageMeta, TableState, SystemUser } from '../../types'

const kindLabel: Record<ActionKind, string> = {
  CORRECTIVE: 'Correctiva',
  PREVENTIVE: 'Preventiva',
  IMPROVEMENT: 'Mejora',
}

const statusLabel: Record<ActionStatus, string> = {
  OPEN: 'Abierta',
  IN_PROGRESS: 'En ejecución',
  DONE: 'Ejecutada',
  VERIFIED: 'Verificada',
  CANCELLED: 'Cancelada',
}

const statusColor: Record<ActionStatus, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  OPEN: 'default',
  IN_PROGRESS: 'info',
  DONE: 'warning',
  VERIFIED: 'success',
  CANCELLED: 'error',
}

const effectivenessLabel: Record<ActionEffectiveness, string> = {
  PENDING: 'Eficacia pendiente',
  EFFECTIVE: 'Eficaz',
  INEFFECTIVE: 'No eficaz',
}

function daysUntil(dueDate: string): number {
  return Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86400000)
}

export function ActionsPage(props: {
  actions: ActionPlan[]
  meta: PageMeta
  tableState: TableState
  canManage: boolean
  onTableChange: (state: TableState) => void
  onCreate: () => void
  onPreloadCreate?: () => void
  onEdit: (item: ActionPlan) => void
  onDelete: (item: ActionPlan) => void
  onAdvance: (id: string, target: 'IN_PROGRESS' | 'DONE') => void
  onVerify: (id: string, effectiveness: 'EFFECTIVE' | 'INEFFECTIVE', result?: string) => void
  onCancel: (item: ActionPlan) => void
  advancingId: string | null
  activeCompanyName?: string
}) {
  const [kindFilter, setKindFilter] = useState<'all' | ActionKind>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | ActionStatus>('all')
  const [verifyTarget, setVerifyTarget] = useState<ActionPlan | null>(null)
  const [effectiveness, setEffectiveness] = useState<'EFFECTIVE' | 'INEFFECTIVE'>('EFFECTIVE')
  const [result, setResult] = useState('')

  const visible = props.actions.filter((item) =>
    (kindFilter === 'all' || item.kind === kindFilter) &&
    (statusFilter === 'all' || item.status === statusFilter),
  )

  function submitVerify() {
    if (!verifyTarget) return
    props.onVerify(verifyTarget.id, effectiveness, result.trim() || undefined)
    setVerifyTarget(null)
    setResult('')
  }

  return (
    <Paper className="panel" variant="outlined">
      <ActiveCompanyBanner name={props.activeCompanyName} />
      <TableHeader title="Acciones" canCreate={props.canManage} onCreate={props.onCreate} onPreloadCreate={props.onPreloadCreate} />
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <Box sx={{ flex: 1 }}>
          <TableControls state={props.tableState} onChange={props.onTableChange} placeholder="Buscar por título o descripción" />
        </Box>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap>
          {(['all', 'CORRECTIVE', 'PREVENTIVE', 'IMPROVEMENT'] as const).map((kind) => (
            <Chip
              key={kind}
              size="small"
              label={kind === 'all' ? 'Todos' : kindLabel[kind]}
              color={kindFilter === kind ? 'primary' : 'default'}
              variant={kindFilter === kind ? 'filled' : 'outlined'}
              onClick={() => setKindFilter(kind)}
            />
          ))}
        </Stack>
      </Stack>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        <TextField
          select
          size="small"
          label="Estado"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as 'all' | ActionStatus)}
          sx={{ minWidth: 170 }}
        >
          <MenuItem value="all">Todo estado</MenuItem>
          {(Object.keys(statusLabel) as ActionStatus[]).map((status) => (
            <MenuItem key={status} value={status}>{statusLabel[status]}</MenuItem>
          ))}
        </TextField>
      </Stack>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Acción</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell>Responsable</TableCell>
              <TableCell>Vence</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell>Eficacia</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visible.map((action) => {
              const due = daysUntil(action.dueDate)
              return (
                <TableRow key={action.id} hover>
                  <TableCell>
                    <Typography variant="body2">{action.title}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {action.description}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip size="small" variant="outlined" label={kindLabel[action.kind]} />
                  </TableCell>
                  <TableCell>{action.owner?.name ?? '—'}</TableCell>
                  <TableCell>
                    <Typography variant="body2">{new Date(action.dueDate).toLocaleDateString()}</Typography>
                    {action.status !== 'VERIFIED' && action.status !== 'CANCELLED' && due < 0 && (
                      <Chip size="small" color="error" label={`${Math.abs(due)} d vencida`} />
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip size="small" color={statusColor[action.status]} label={statusLabel[action.status]} variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={action.effectiveness === 'EFFECTIVE' ? 'success' : action.effectiveness === 'INEFFECTIVE' ? 'error' : 'default'}
                      variant="outlined"
                      label={effectivenessLabel[action.effectiveness]}
                    />
                  </TableCell>
                  <TableCell align="right">
                    {props.canManage && action.status === 'DONE' && (
                      <IconButton
                        size="small"
                        color="primary"
                        title="Verificar eficacia"
                        onClick={() => { setVerifyTarget(action); setEffectiveness('EFFECTIVE'); setResult('') }}
                      >
                        <Verified />
                      </IconButton>
                    )}
                    {props.canManage && (action.status === 'OPEN' || action.status === 'IN_PROGRESS') && (
                      <IconButton
                        size="small"
                        color="primary"
                        title={action.status === 'OPEN' ? 'Iniciar ejecución' : 'Marcar ejecutada'}
                        disabled={props.advancingId === action.id}
                        onClick={() => props.onAdvance(action.id, action.status === 'OPEN' ? 'IN_PROGRESS' : 'DONE')}
                      >
                        <TaskAlt />
                      </IconButton>
                    )}
                    <IconButton size="small" disabled={!props.canManage} onClick={() => props.onEdit(action)}>
                      <Edit />
                    </IconButton>
                    {props.canManage && (action.status === 'OPEN' || action.status === 'IN_PROGRESS') && (
                      <IconButton size="small" color="warning" title="Cancelar acción" onClick={() => props.onCancel(action)}>
                        <Delete />
                      </IconButton>
                    )}
                    {props.canManage && (action.status === 'DONE' || action.status === 'VERIFIED') && (
                      <IconButton size="small" disabled={!props.canManage} color="error" onClick={() => props.onDelete(action)}>
                        <Delete />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
                    Sin acciones para mostrar.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <Pager meta={props.meta} state={props.tableState} onChange={props.onTableChange} />

      {/* S15.2: verificacion de eficacia; las guardas viven en el backend. */}
      <Dialog open={verifyTarget !== null} onClose={() => setVerifyTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Verificar eficacia</DialogTitle>
        <DialogContent dividers>
          {verifyTarget && (
            <Stack spacing={2} sx={{ mt: 1 }}>
              <Typography variant="body2">{verifyTarget.title}</Typography>
              {verifyTarget.kind === 'CORRECTIVE' && !verifyTarget.rootCause && (
                <Alert severity="warning" variant="outlined">
                  <Typography variant="body2">
                    Falta la causa raíz: edítala en el diálogo de la acción antes de verificar.
                  </Typography>
                </Alert>
              )}
              {(verifyTarget.kind === 'PREVENTIVE' || verifyTarget.kind === 'IMPROVEMENT') && !verifyTarget.expectedBenefit && (
                <Alert severity="warning" variant="outlined">
                  <Typography variant="body2">
                    Falta el beneficio esperado: edítalo en el diálogo de la acción antes de verificar.
                  </Typography>
                </Alert>
              )}
              <TextField
                select
                label="Resultado de la verificación"
                value={effectiveness}
                onChange={(event) => setEffectiveness(event.target.value as 'EFFECTIVE' | 'INEFFECTIVE')}
              >
                <MenuItem value="EFFECTIVE">Eficaz: la acción eliminó la causa</MenuItem>
                <MenuItem value="INEFFECTIVE">No eficaz: requiere nueva acción</MenuItem>
              </TextField>
              <TextField
                label="Resultado medido (opcional)"
                value={result}
                onChange={(event) => setResult(event.target.value)}
                multiline
                minRows={2}
              />
              <Typography variant="caption" color="text.secondary">
                Quedará registrado tu usuario como verificador con fecha del día.
              </Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVerifyTarget(null)}>Cancelar</Button>
          <Button variant="contained" onClick={submitVerify}>Verificar</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  )
}

/**
 * Dialogo de accion (#41): la CORRECTIVE exige hallazgo de origen;
 * PREVENTIVE/IMPROVEMENT pueden nacer sin no conformidad previa.
 */
export function ActionDialog(props: {
  open: boolean
  editing: boolean
  values: ActionPlanFormValues
  findings: Finding[]
  users: SystemUser[]
  companies: Company[]
  loading: boolean
  canPickCompany: boolean
  onChange: (values: ActionPlanFormValues) => void
  onClose: () => void
  onSave: () => void
}) {
  const isCorrective = props.values.kind === 'CORRECTIVE'
  const companyFindings = props.findings.filter(
    (finding) => finding.companyId === props.values.companyId && finding.status !== 'CLOSED',
  )

  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{props.editing ? 'Editar acción' : 'Nueva acción'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Título de la acción"
            value={props.values.title}
            onChange={(event) => props.onChange({ ...props.values, title: event.target.value })}
            required
          />
          <TextField
            label="Descripción"
            value={props.values.description}
            onChange={(event) => props.onChange({ ...props.values, description: event.target.value })}
            required
            multiline
            minRows={2}
          />
          <Stack direction="row" spacing={2}>
            <TextField
              select
              label="Tipo de acción"
              value={props.values.kind}
              onChange={(event) => props.onChange({ ...props.values, kind: event.target.value as ActionKind })}
              fullWidth
            >
              {(Object.keys(kindLabel) as ActionKind[]).map((kind) => (
                <MenuItem key={kind} value={kind}>{kindLabel[kind]}</MenuItem>
              ))}
            </TextField>
            <TextField
              label="Fecha de vencimiento"
              type="date"
              value={props.values.dueDate}
              onChange={(event) => props.onChange({ ...props.values, dueDate: event.target.value })}
              InputLabelProps={{ shrink: true }}
              required
              fullWidth
            />
          </Stack>
          {isCorrective ? (
            <TextField
              select
              label="Hallazgo de origen"
              value={props.values.sourceId}
              onChange={(event) => props.onChange({ ...props.values, sourceId: event.target.value })}
              helperText="La acción correctiva nace de un hallazgo con causas identificadas"
              required
            >
              {companyFindings.map((finding) => (
                <MenuItem key={finding.id} value={finding.id}>
                  {finding.title} — {finding.severity === 'CRITICAL' ? 'Crítico' : finding.severity === 'MAJOR' ? 'Mayor' : 'Menor'}
                </MenuItem>
              ))}
            </TextField>
          ) : (
            <Alert severity="info" variant="outlined">
              <Typography variant="body2">
                Las acciones {kindLabel[props.values.kind].toLowerCase()}s no exigen no conformidad previa; para verificarse pediremos el beneficio esperado.
              </Typography>
            </Alert>
          )}
          {isCorrective && (
            <TextField
              label="Causa raíz"
              value={props.values.rootCause}
              onChange={(event) => props.onChange({ ...props.values, rootCause: event.target.value })}
              multiline
              minRows={2}
              helperText="Requisito para verificar la eficacia de la acción correctiva"
            />
          )}
          {!isCorrective && (
            <TextField
              label="Beneficio o resultado esperado"
              value={props.values.expectedBenefit}
              onChange={(event) => props.onChange({ ...props.values, expectedBenefit: event.target.value })}
              multiline
              minRows={2}
              helperText="Requisito para verificar la eficacia"
            />
          )}
          <Stack direction="row" spacing={2}>
            <TextField
              select
              label="Responsable"
              value={props.values.ownerId}
              onChange={(event) => props.onChange({ ...props.values, ownerId: event.target.value })}
              fullWidth
              helperText="En hallazgos CRITICAL el verificador será otra persona"
            >
              <MenuItem value="">Sin responsable</MenuItem>
              {props.users
                .filter((user) => user.companyId === props.values.companyId)
                .map((user) => (
                  <MenuItem key={user.id} value={user.id}>{user.name}</MenuItem>
                ))}
            </TextField>
            {props.canPickCompany ? (
              <TextField
                select
                label="Empresa"
                value={props.values.companyId}
                disabled={props.companies.length === 0}
                onChange={(event) => props.onChange({ ...props.values, companyId: event.target.value })}
                required
                fullWidth
              >
                {props.companies.map((company) => (
                  <MenuItem key={company.id} value={company.id}>{company.name}</MenuItem>
                ))}
              </TextField>
            ) : (
              <TextField
                label="Empresa"
                value={props.companies.find((company) => company.id === props.values.companyId)?.name || props.values.companyId}
                InputProps={{ readOnly: true }}
                helperText="Empresa asignada según tu sesión"
                fullWidth
              />
            )}
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cancelar</Button>
        <Button
          variant="contained"
          disabled={
            props.loading ||
            !props.values.title.trim() ||
            !props.values.description.trim() ||
            !props.values.dueDate ||
            !props.values.companyId ||
            (isCorrective && !props.values.sourceId)
          }
          onClick={props.onSave}
        >
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  )
}
