import { useState } from 'react'
import { Add, Delete, Edit, TroubleshootOutlined } from '@mui/icons-material'
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { ActiveCompanyBanner, Pager, TableControls, TableHeader } from '../../components/TablePieces'
import type { Company, Finding, FindingCause, FindingSeverity, FindingStatus, FindingType, FindingFormValues, FindingSourceType, PageMeta, TableState, SystemUser } from '../../types'

const severityLabel: Record<FindingSeverity, string> = {
  MINOR: 'Menor',
  MAJOR: 'Mayor',
  CRITICAL: 'Crítico',
}

const severityColor: Record<FindingSeverity, 'success' | 'warning' | 'error'> = {
  MINOR: 'success',
  MAJOR: 'warning',
  CRITICAL: 'error',
}

const statusLabel: Record<FindingStatus, string> = {
  OPEN: 'Abierto',
  IN_PROGRESS: 'En gestión',
  CLOSED: 'Cerrado',
}

const statusColor: Record<FindingStatus, 'error' | 'info' | 'success'> = {
  OPEN: 'error',
  IN_PROGRESS: 'info',
  CLOSED: 'success',
}

const typeLabel: Record<FindingType, string> = {
  NON_CONFORMITY: 'No conformidad',
  OPPORTUNITY: 'Oportunidad de mejora',
  OBSERVATION: 'Observación',
}

const sourceLabel: Record<FindingSourceType, string> = {
  INSPECTION_PLANNED: 'Inspección planeada',
  INSPECTION_UNPLANNED: 'Inspección reactiva',
  AUDIT: 'Auditoría SG-SST',
  UNSAFE_REPORT: 'Reporte inseguro',
  MANUAL: 'Registro manual',
}

export function FindingsPage(props: {
  findings: Finding[]
  meta: PageMeta
  tableState: TableState
  canManage: boolean
  onTableChange: (state: TableState) => void
  onCreate: () => void
  onPreloadCreate?: () => void
  onEdit: (item: Finding) => void
  onDelete: (item: Finding) => void
  onOpenDetail: (item: Finding) => void
  detailState: Finding | null
  detailLoading: boolean
  onCloseDetail: () => void
  onAddCause: (findingId: string, values: { causeType: string; description: string }) => void
  onRemoveCause: (findingId: string, causeId: string) => void
  onSetStatus: (findingId: string, status: FindingStatus) => void
  detailSaving: boolean
  activeCompanyName?: string
}) {
  const [statusFilter, setStatusFilter] = useState<'all' | FindingStatus>('all')
  const [severityFilter, setSeverityFilter] = useState<'all' | FindingSeverity>('all')
  const [sourceFilter, setSourceFilter] = useState<'all' | FindingSourceType>('all')

  const visible = props.findings.filter((item) =>
    (statusFilter === 'all' || item.status === statusFilter) &&
    (severityFilter === 'all' || item.severity === severityFilter) &&
    (sourceFilter === 'all' || item.sourceType === sourceFilter),
  )

  return (
    <Paper className="panel" variant="outlined">
      <ActiveCompanyBanner name={props.activeCompanyName} />
      <TableHeader title="Hallazgos" canCreate={props.canManage} onCreate={props.onCreate} onPreloadCreate={props.onPreloadCreate} />
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <Box sx={{ flex: 1 }}>
          <TableControls state={props.tableState} onChange={props.onTableChange} placeholder="Buscar por título o descripción" />
        </Box>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap>
          {(['all', 'OPEN', 'IN_PROGRESS', 'CLOSED'] as const).map((status) => (
            <Chip
              key={status}
              size="small"
              label={status === 'all' ? 'Todos' : statusLabel[status]}
              color={statusFilter === status ? 'primary' : 'default'}
              variant={statusFilter === status ? 'filled' : 'outlined'}
              onClick={() => setStatusFilter(status)}
            />
          ))}
        </Stack>
      </Stack>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        <TextField
          select
          size="small"
          label="Severidad"
          value={severityFilter}
          onChange={(event) => setSeverityFilter(event.target.value as 'all' | FindingSeverity)}
          sx={{ minWidth: 150 }}
        >
          <MenuItem value="all">Toda severidad</MenuItem>
          {(Object.keys(severityLabel) as FindingSeverity[]).map((severity) => (
            <MenuItem key={severity} value={severity}>{severityLabel[severity]}</MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Origen"
          value={sourceFilter}
          onChange={(event) => setSourceFilter(event.target.value as 'all' | FindingSourceType)}
          sx={{ minWidth: 190 }}
        >
          <MenuItem value="all">Todo origen</MenuItem>
          {(Object.keys(sourceLabel) as FindingSourceType[]).map((source) => (
            <MenuItem key={source} value={source}>{sourceLabel[source]}</MenuItem>
          ))}
        </TextField>
      </Stack>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Hallazgo</TableCell>
              <TableCell>Origen</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell>Severidad</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell>Responsable</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visible.map((finding) => (
              <TableRow key={finding.id} hover>
                <TableCell>
                  <Typography variant="body2">{finding.title}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {finding.description}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip size="small" variant="outlined" label={sourceLabel[finding.sourceType] ?? finding.sourceType} />
                </TableCell>
                <TableCell>{typeLabel[finding.type] ?? finding.type}</TableCell>
                <TableCell>
                  <Chip size="small" color={severityColor[finding.severity]} variant="outlined" label={severityLabel[finding.severity]} />
                </TableCell>
                <TableCell>
                  <Chip size="small" color={statusColor[finding.status]} label={statusLabel[finding.status]} variant="outlined" />
                </TableCell>
                <TableCell>{finding.owner?.name ?? '—'}</TableCell>
                <TableCell align="right">
                  {props.canManage && (
                    <IconButton size="small" color="primary" title="Detalle y causas" onClick={() => props.onOpenDetail(finding)}>
                      <TroubleshootOutlined />
                    </IconButton>
                  )}
                  <IconButton size="small" disabled={!props.canManage} onClick={() => props.onEdit(finding)}>
                    <Edit />
                  </IconButton>
                  <IconButton size="small" disabled={!props.canManage} color="error" onClick={() => props.onDelete(finding)}>
                    <Delete />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
                    Sin hallazgos para mostrar.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <Pager meta={props.meta} state={props.tableState} onChange={props.onTableChange} />
      <FindingDetailDialog
        finding={props.detailState}
        loading={props.detailLoading}
        canManage={props.canManage}
        saving={props.detailSaving}
        onAddCause={props.onAddCause}
        onRemoveCause={props.onRemoveCause}
        onSetStatus={props.onSetStatus}
        onClose={props.onCloseDetail}
      />
    </Paper>
  )
}

/** S15.1: detalle con causas (analisis de causa raiz) y cierre rapido. */
function FindingDetailDialog(props: {
  finding: Finding | null
  loading: boolean
  canManage: boolean
  saving: boolean
  onAddCause: (findingId: string, values: { causeType: string; description: string }) => void
  onRemoveCause: (findingId: string, causeId: string) => void
  onSetStatus: (findingId: string, status: FindingStatus) => void
  onClose: () => void
}) {
  const [causeType, setCauseType] = useState('')
  const [causeDescription, setCauseDescription] = useState('')

  const finding = props.finding

  function submitCause() {
    if (!finding || !causeType.trim() || !causeDescription.trim()) return
    props.onAddCause(finding.id, { causeType: causeType.trim(), description: causeDescription.trim() })
    setCauseType('')
    setCauseDescription('')
  }

  return (
    <Dialog open={finding !== null || props.loading} onClose={props.onClose} fullWidth maxWidth="sm">
      <DialogTitle>Detalle del hallazgo</DialogTitle>
      <DialogContent dividers>
        {props.loading && (
          <Typography variant="body2" color="text.secondary">
            Cargando hallazgo...
          </Typography>
        )}
        {!props.loading && finding && (
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip size="small" color={severityColor[finding.severity]} label={severityLabel[finding.severity]} />
              <Chip size="small" variant="outlined" label={typeLabel[finding.type] ?? finding.type} />
              <Chip size="small" color={statusColor[finding.status]} variant="outlined" label={statusLabel[finding.status]} />
            </Stack>
            <Typography variant="body2">{finding.description}</Typography>
            <Typography variant="caption" color="text.secondary">
              Origen: {sourceLabel[finding.sourceType] ?? finding.sourceType}
              {finding.owner ? ` · Responsable: ${finding.owner.name}` : ''}
              {finding.closedAt ? ` · Cerrado el ${new Date(finding.closedAt).toLocaleDateString()}` : ''}
            </Typography>
            <Stack spacing={0.5}>
              <Typography variant="subtitle2">Causas identificadas</Typography>
              {(finding.causes ?? []).length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  Sin causas registradas. La acción correctiva (S15.2) exigirá causa raíz.
                </Typography>
              )}
              {(finding.causes ?? []).map((cause: FindingCause) => (
                <Stack key={cause.id} direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                  <Typography variant="body2">
                    <strong>{cause.causeType}:</strong> {cause.description}
                  </Typography>
                  {props.canManage && finding.status !== 'CLOSED' && (
                    <IconButton size="small" color="error" onClick={() => props.onRemoveCause(finding.id, cause.id)}>
                      <Delete fontSize="small" />
                    </IconButton>
                  )}
                </Stack>
              ))}
            </Stack>
            {props.canManage && finding.status !== 'CLOSED' && (
              <Stack spacing={1}>
                <Stack direction="row" spacing={1}>
                  <TextField
                    size="small"
                    label="Tipo de causa"
                    value={causeType}
                    onChange={(event) => setCauseType(event.target.value)}
                    sx={{ flex: 1 }}
                    placeholder="Ej: Método, Mantención, Capacitación"
                  />
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<Add />}
                    disabled={props.saving || !causeType.trim() || !causeDescription.trim()}
                    onClick={submitCause}
                  >
                    Agregar
                  </Button>
                </Stack>
                <TextField
                  size="small"
                  label="Descripción de la causa"
                  value={causeDescription}
                  onChange={(event) => setCauseDescription(event.target.value)}
                  multiline
                  minRows={2}
                />
                {finding.status === 'OPEN' && (
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={props.saving}
                    onClick={() => props.onSetStatus(finding.id, 'IN_PROGRESS')}
                    sx={{ alignSelf: 'flex-start' }}
                  >
                    Marcar en gestión
                  </Button>
                )}
                <Button
                  size="small"
                  variant="contained"
                  color="success"
                  disabled={props.saving}
                  onClick={() => props.onSetStatus(finding.id, 'CLOSED')}
                  sx={{ alignSelf: 'flex-start' }}
                >
                  Cerrar hallazgo
                </Button>
              </Stack>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  )
}

/**
 * Dialogo de hallazgo (#40): origen trazable (inspecciones, auditorias,
 * reportes inseguros o manual) y responsable opcional del seguimiento.
 */
export function FindingDialog(props: {
  open: boolean
  editing: boolean
  values: FindingFormValues
  users: SystemUser[]
  companies: Company[]
  loading: boolean
  canPickCompany: boolean
  onChange: (values: FindingFormValues) => void
  onClose: () => void
  onSave: () => void
}) {
  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{props.editing ? 'Editar hallazgo' : 'Nuevo hallazgo'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Título del hallazgo"
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
            minRows={3}
          />
          <Stack direction="row" spacing={2}>
            <TextField
              select
              label="Origen"
              value={props.values.sourceType}
              onChange={(event) => props.onChange({ ...props.values, sourceType: event.target.value as FindingSourceType })}
              fullWidth
            >
              {(Object.keys(sourceLabel) as FindingSourceType[]).map((source) => (
                <MenuItem key={source} value={source}>{sourceLabel[source]}</MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Tipo"
              value={props.values.type}
              onChange={(event) => props.onChange({ ...props.values, type: event.target.value as FindingType })}
              fullWidth
            >
              {(Object.keys(typeLabel) as FindingType[]).map((type) => (
                <MenuItem key={type} value={type}>{typeLabel[type]}</MenuItem>
              ))}
            </TextField>
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField
              select
              label="Severidad"
              value={props.values.severity}
              onChange={(event) => props.onChange({ ...props.values, severity: event.target.value as FindingSeverity })}
              fullWidth
            >
              {(Object.keys(severityLabel) as FindingSeverity[]).map((severity) => (
                <MenuItem key={severity} value={severity}>{severityLabel[severity]}</MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Responsable del seguimiento"
              value={props.values.ownerId}
              onChange={(event) => props.onChange({ ...props.values, ownerId: event.target.value })}
              fullWidth
              helperText="Opcional: quién da seguimiento al hallazgo"
            >
              <MenuItem value="">Sin responsable</MenuItem>
              {props.users
                .filter((user) => user.companyId === props.values.companyId)
                .map((user) => (
                  <MenuItem key={user.id} value={user.id}>{user.name}</MenuItem>
                ))}
            </TextField>
          </Stack>
          {props.canPickCompany ? (
            <TextField
              select
              label="Empresa"
              value={props.values.companyId}
              disabled={props.companies.length === 0}
              onChange={(event) => props.onChange({ ...props.values, companyId: event.target.value })}
              required
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
            />
          )}
          <Alert severity="info" variant="outlined">
            <Typography variant="body2">
              Las acciones correctivas sobre este hallazgo se gestionan desde el módulo de acciones (S15.2).
            </Typography>
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cancelar</Button>
        <Button
          variant="contained"
          disabled={props.loading || !props.values.title.trim() || !props.values.description.trim() || !props.values.companyId}
          onClick={props.onSave}
        >
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  )
}
