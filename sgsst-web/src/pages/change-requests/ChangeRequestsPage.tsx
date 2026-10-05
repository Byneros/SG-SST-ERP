import { useState } from 'react'
import { Delete, Edit, PlaylistAddCheck } from '@mui/icons-material'
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material'
import { ActiveCompanyBanner, Pager, TableControls, TableHeader } from '../../components/TablePieces'
import type { ChangeRequest, ChangeRequestFormValues, ChangeRequestStatus, Company, PageMeta, Risk, RiskLevel, TableState } from '../../types'

const statusColor: Record<ChangeRequestStatus, 'success' | 'default' | 'info' | 'warning' | 'error'> = {
  REQUESTED: 'default',
  EVALUATION: 'info',
  CONTROLS: 'info',
  APPROVAL: 'warning',
  IMPLEMENTATION: 'warning',
  VERIFICATION: 'info',
  CLOSED: 'success',
}

const statusLabel: Record<ChangeRequestStatus, string> = {
  REQUESTED: 'Solicitud',
  EVALUATION: 'Evaluación',
  CONTROLS: 'Controles',
  APPROVAL: 'Aprobación',
  IMPLEMENTATION: 'Implementación',
  VERIFICATION: 'Verificación',
  CLOSED: 'Cerrado',
}

const riskLevelLabel: Record<RiskLevel, string> = {
  LOW: 'Bajo',
  MEDIUM: 'Medio',
  HIGH: 'Alto',
  CRITICAL: 'Crítico',
}

/** S14.2: flujo Solicitud → Evaluación → Controles → Aprobación → ... → Cierre. */
const workflow: ChangeRequestStatus[] = ['REQUESTED', 'EVALUATION', 'CONTROLS', 'APPROVAL', 'IMPLEMENTATION', 'VERIFICATION', 'CLOSED']

export function ChangeRequestsPage(props: {
  changes: ChangeRequest[]
  meta: PageMeta
  tableState: TableState
  canManage: boolean
  onTableChange: (state: TableState) => void
  onCreate: () => void
  onPreloadCreate?: () => void
  onEdit: (item: ChangeRequest) => void
  onDelete: (item: ChangeRequest) => void
  onOpenWorkflow: (item: ChangeRequest) => void
  workflowState: ChangeRequest | null
  workflowLoading: boolean
  onCloseWorkflow: () => void
  onAdvanceWorkflow: (id: string, target: ChangeRequestStatus) => void
  advancing: boolean
  activeCompanyName?: string
}) {
  const [statusFilter, setStatusFilter] = useState<'all' | ChangeRequestStatus>('all')

  const visible = statusFilter === 'all' ? props.changes : props.changes.filter((item) => item.status === statusFilter)

  return (
    <Paper className="panel" variant="outlined">
      <ActiveCompanyBanner name={props.activeCompanyName} />
      <TableHeader title="Gestión del cambio" canCreate={props.canManage} onCreate={props.onCreate} onPreloadCreate={props.onPreloadCreate} />
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <Box sx={{ flex: 1 }}>
          <TableControls state={props.tableState} onChange={props.onTableChange} placeholder="Buscar por título, proceso o responsable" />
        </Box>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap>
          <Chip
            size="small"
            label="Todos"
            color={statusFilter === 'all' ? 'primary' : 'default'}
            variant={statusFilter === 'all' ? 'filled' : 'outlined'}
            onClick={() => setStatusFilter('all')}
          />
          {(Object.keys(statusLabel) as ChangeRequestStatus[]).map((status) => (
            <Chip
              key={status}
              size="small"
              label={statusLabel[status]}
              color={statusFilter === status ? 'primary' : 'default'}
              variant={statusFilter === status ? 'filled' : 'outlined'}
              onClick={() => setStatusFilter(status)}
            />
          ))}
        </Stack>
      </Stack>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Cambio</TableCell>
              <TableCell>Proceso</TableCell>
              <TableCell>Responsable</TableCell>
              <TableCell>Riesgo evaluado</TableCell>
              <TableCell>Etapa</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visible.map((change) => (
              <TableRow key={change.id} hover>
                <TableCell>
                  <Typography variant="body2">{change.title}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {change.reason}
                  </Typography>
                </TableCell>
                <TableCell>{change.process}</TableCell>
                <TableCell>{change.responsible}</TableCell>
                <TableCell>
                  {change.risk ? (
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Typography variant="body2">{change.risk.title}</Typography>
                      <Chip size="small" variant="outlined" label={riskLevelLabel[change.risk.level as RiskLevel] ?? change.risk.level} />
                    </Stack>
                  ) : (
                    <Chip size="small" color="error" variant="outlined" label="Sin evaluación" />
                  )}
                </TableCell>
                <TableCell>
                  <Chip size="small" label={statusLabel[change.status]} color={statusColor[change.status]} variant="outlined" />
                </TableCell>
                <TableCell align="right">
                  {props.canManage && (
                    <IconButton size="small" color="primary" title="Workflow del cambio" onClick={() => props.onOpenWorkflow(change)}>
                      <PlaylistAddCheck />
                    </IconButton>
                  )}
                  <IconButton size="small" disabled={!props.canManage} onClick={() => props.onEdit(change)}>
                    <Edit />
                  </IconButton>
                  <IconButton size="small" disabled={!props.canManage} color="error" onClick={() => props.onDelete(change)}>
                    <Delete />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
                    Sin solicitudes de cambio para mostrar.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <Pager meta={props.meta} state={props.tableState} onChange={props.onTableChange} />
      <WorkflowDialog
        change={props.workflowState}
        loading={props.workflowLoading}
        canManage={props.canManage}
        advancing={props.advancing}
        onAdvance={props.onAdvanceWorkflow}
        onClose={props.onCloseWorkflow}
      />
    </Paper>
  )
}

/**
 * Dialogo del workflow (#39): muestra el flujo completo con la etapa actual,
 * los requisitos por etapa y el avance; la guarda vive en el backend.
 */
function WorkflowDialog(props: {
  change: ChangeRequest | null
  loading: boolean
  canManage: boolean
  advancing: boolean
  onAdvance: (id: string, target: ChangeRequestStatus) => void
  onClose: () => void
}) {
  const change = props.change
  const currentIndex = change ? workflow.indexOf(change.status) : -1
  const nextStage = change && change.status !== 'CLOSED' ? workflow[currentIndex + 1] : null

  const requirements: Partial<Record<ChangeRequestStatus, string>> = {
    REQUESTED: change?.riskId ? undefined : 'Asigna el riesgo evaluado para avanzar',
    EVALUATION: change?.hazards && change?.impacts ? undefined : 'Registra peligros e impactos de la evaluación',
    CONTROLS: change?.controls ? undefined : 'Registra los controles propuestos',
    IMPLEMENTATION: change?.implementationEvidenceId ? undefined : 'Adjunta la evidencia de implementación',
    VERIFICATION: change?.verificationNotes ? undefined : 'Registra las notas de verificación',
  }
  // La guarda del backend (assertCanAdvance) exige los datos de la etapa
  // ACTUAL para avanzar: el aviso usa la misma clave, no la siguiente.
  const blockingRequirement = change ? requirements[change.status] : undefined

  return (
    <Dialog open={change !== null || props.loading} onClose={props.onClose} fullWidth maxWidth="sm">
      <DialogTitle>Workflow del cambio</DialogTitle>
      <DialogContent dividers>
        {props.loading && (
          <Typography variant="body2" color="text.secondary">
            Cargando cambio...
          </Typography>
        )}
        {!props.loading && change && (
          <Stack spacing={2}>
            <Typography variant="body2">
              {change.title} — {change.process}
            </Typography>
            <Stack spacing={0.5}>
              <Typography variant="subtitle2">Flujo del cambio</Typography>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap alignItems="center">
                {workflow.map((stage, index) => {
                  const done = index < currentIndex
                  const current = index === currentIndex
                  return (
                    <Chip
                      key={stage}
                      size="small"
                      label={statusLabel[stage]}
                      color={current ? 'primary' : done ? 'success' : 'default'}
                      variant={current ? 'filled' : 'outlined'}
                    />
                  )
                })}
              </Stack>
            </Stack>
            <Stack spacing={0.5}>
              <Typography variant="subtitle2">Evaluación de riesgos</Typography>
              {change.risk ? (
                <Typography variant="body2">
                  {change.risk.title} — nivel {riskLevelLabel[change.risk.level as RiskLevel] ?? change.risk.level}
                </Typography>
              ) : (
                <Typography variant="body2" color="error">
                  Sin riesgo asignado (edita el cambio para asignarlo).
                </Typography>
              )}
              {change.hazards && (
                <Typography variant="body2" color="text.secondary">
                  Peligros: {change.hazards}
                </Typography>
              )}
              {change.impacts && (
                <Typography variant="body2" color="text.secondary">
                  Impactos: {change.impacts}
                </Typography>
              )}
              {change.controls && (
                <Typography variant="body2" color="text.secondary">
                  Controles: {change.controls}
                </Typography>
              )}
            </Stack>
            {change.status === 'IMPLEMENTATION' && (
              <Stack spacing={0.5}>
                <Typography variant="subtitle2">Implementación</Typography>
                <Typography variant="body2" color="text.secondary">
                  {change.implementationEvidence
                    ? `Evidencia: ${change.implementationEvidence.name}`
                    : 'Sin evidencia de implementación (requisito para verificar).'}
                </Typography>
              </Stack>
            )}
            {change.status === 'VERIFICATION' && (
              <Stack spacing={0.5}>
                <Typography variant="subtitle2">Verificación</Typography>
                <Typography variant="body2" color="text.secondary">
                  {change.verificationNotes || 'Sin notas de verificación (requisito para cerrar).'}
                </Typography>
              </Stack>
            )}
            {change.approvedBy && (
              <Typography variant="caption" color="text.secondary">
                Aprobado por {change.approvedBy.name}
                {change.approvedAt ? ` el ${new Date(change.approvedAt).toLocaleDateString()}` : ''}
              </Typography>
            )}
            {blockingRequirement && (
              <Alert severity="warning" variant="outlined">
                <Typography variant="body2">{blockingRequirement}</Typography>
              </Alert>
            )}
            {props.canManage && nextStage && (
              <Button
                size="small"
                variant="contained"
                disabled={props.advancing}
                onClick={() => change && props.onAdvance(change.id, nextStage)}
                sx={{ alignSelf: 'flex-start' }}
              >
                {props.advancing ? 'Avanzando...' : `Avanzar a ${statusLabel[nextStage]}`}
              </Button>
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

function CompanyPicker<T extends { companyId: string }>(props: {
  values: T
  companies: Company[]
  canPickCompany: boolean
  onChange: (values: T) => void
}) {
  if (props.canPickCompany) {
    return (
      <TextField
        select
        label="Empresa"
        value={props.values.companyId}
        disabled={props.companies.length === 0}
        onChange={(event) => props.onChange({ ...props.values, companyId: event.target.value })}
        required
      >
        {props.companies.map((company) => (
          <MenuItem key={company.id} value={company.id}>
            {company.name}
          </MenuItem>
        ))}
      </TextField>
    )
  }
  return (
    <TextField
      label="Empresa"
      value={props.companies.find((company) => company.id === props.values.companyId)?.name || props.values.companyId}
      InputProps={{ readOnly: true }}
      helperText="Empresa asignada según tu sesión"
    />
  )
}

/**
 * Dialogo de solicitud de cambio (#38): la evaluacion de riesgos es
 * obligatoria (riesgo de la matriz GTC-45 de la empresa).
 */
export function ChangeRequestDialog(props: {
  open: boolean
  editing: boolean
  values: ChangeRequestFormValues
  risks: Risk[]
  companies: Company[]
  loading: boolean
  canPickCompany: boolean
  onChange: (values: ChangeRequestFormValues) => void
  onClose: () => void
  onSave: () => void
}) {
  const companyRisks = props.risks.filter((risk) => risk.companyId === props.values.companyId)

  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{props.editing ? 'Editar solicitud de cambio' : 'Nueva solicitud de cambio'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="Título del cambio"
            value={props.values.title}
            onChange={(event) => props.onChange({ ...props.values, title: event.target.value })}
            required
          />
          <TextField
            label="Motivo del cambio"
            value={props.values.reason}
            onChange={(event) => props.onChange({ ...props.values, reason: event.target.value })}
            required
            multiline
            minRows={2}
          />
          <Stack direction="row" spacing={2}>
            <TextField
              label="Proceso afectado"
              value={props.values.process}
              onChange={(event) => props.onChange({ ...props.values, process: event.target.value })}
              required
              fullWidth
            />
            <TextField
              label="Responsable"
              value={props.values.responsible}
              onChange={(event) => props.onChange({ ...props.values, responsible: event.target.value })}
              required
              fullWidth
            />
          </Stack>
          <TextField
            select
            label="Riesgo evaluado (matriz GTC-45)"
            value={props.values.riskId}
            onChange={(event) => props.onChange({ ...props.values, riskId: event.target.value })}
            helperText="Evaluación obligatoria de riesgos: selecciona el riesgo asociado al cambio"
            required
          >
            {companyRisks.map((risk) => (
              <MenuItem key={risk.id} value={risk.id}>
                {risk.title} — {riskLevelLabel[risk.level] ?? risk.level}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Peligros identificados"
            value={props.values.hazards}
            onChange={(event) => props.onChange({ ...props.values, hazards: event.target.value })}
            multiline
            minRows={2}
            helperText="Requisito para avanzar de Evaluación a Controles"
          />
          <TextField
            label="Impactos potenciales"
            value={props.values.impacts}
            onChange={(event) => props.onChange({ ...props.values, impacts: event.target.value })}
            multiline
            minRows={2}
          />
          <TextField
            label="Controles propuestos"
            value={props.values.controls}
            onChange={(event) => props.onChange({ ...props.values, controls: event.target.value })}
            multiline
            minRows={2}
            helperText="Requisito para avanzar de Controles a Aprobación"
          />
          <Stack direction="row" spacing={2}>
            <TextField
              label="Fecha de solicitud"
              type="date"
              value={props.values.requestedAt}
              onChange={(event) => props.onChange({ ...props.values, requestedAt: event.target.value })}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <CompanyPicker values={props.values} companies={props.companies} canPickCompany={props.canPickCompany} onChange={props.onChange} />
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cancelar</Button>
        <Button
          variant="contained"
          disabled={props.loading || !props.values.title.trim() || !props.values.reason.trim() || !props.values.process.trim() || !props.values.responsible.trim() || !props.values.riskId || !props.values.companyId}
          onClick={props.onSave}
        >
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  )
}
