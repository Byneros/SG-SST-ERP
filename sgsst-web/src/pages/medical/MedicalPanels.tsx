import { AutoFixHigh, ContentPaste, Delete, Edit, Refresh, TaskAlt } from '@mui/icons-material'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { useState, type ReactNode } from 'react'
import { TableHeader } from '../../components/TablePieces'
import type {
  MedicalProfile,
  MedicalSurveillanceProgram,
  PveCase,
  PveCaseStatus,
  PveDiagnosis,
} from '../../types'

const levelColors: Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'> = {
  LOW: 'success',
  MEDIUM: 'info',
  HIGH: 'warning',
  CRITICAL: 'error',
}

const programStatusLabels: Record<string, { label: string; color: 'default' | 'success' | 'warning' }> = {
  ACTIVE: { label: 'Activo', color: 'success' },
  INACTIVE: { label: 'Inactivo', color: 'default' },
  CLOSED: { label: 'Cerrado', color: 'warning' },
}

function formatDate(value?: string) {
  return value ? value.slice(0, 10) : '-'
}

/** Panel de derivacion #25.2: requisitos medicos desde los riesgos del cargo. */
export function MedicalDerivationPanel(props: {
  profiles: MedicalProfile[]
  canManage: boolean
  onDerive: (profileId: string) => Promise<{ worstRiskLevel: string; created: { examType: string }[] } | null>
}) {
  const [result, setResult] = useState<{ position: string; worstRiskLevel: string; created: { examType: string }[] } | null>(null)
  const [deriving, setDeriving] = useState<string | null>(null)

  async function derive(profile: MedicalProfile) {
    setDeriving(profile.id)
    const outcome = await props.onDerive(profile.id)
    setDeriving(null)
    if (outcome) {
      setResult({ position: profile.position, worstRiskLevel: outcome.worstRiskLevel, created: outcome.created })
    }
  }

  return (
    <>
      <TableHeader title="Derivacion de requisitos desde riesgos del cargo" canCreate={false} onCreate={() => undefined} />
      {result && (
        <Alert
          severity={result.created.length > 0 ? 'success' : 'info'}
          onClose={() => setResult(null)}
          icon={result.created.length > 0 ? <TaskAlt /> : <ContentPaste />}
          sx={{ mb: 1 }}
        >
          {result.created.length > 0 ? (
            <>
              <strong>{result.position}</strong>: se derivaron {result.created.length} requisito(s) desde riesgo{' '}
              <strong>{result.worstRiskLevel}</strong> ({result.created.map((r) => r.examType).join(', ')}).
            </>
          ) : (
            <>
              <strong>{result.position}</strong>: los requisitos ya estaban derivados del riesgo{' '}
              <strong>{result.worstRiskLevel}</strong> (idempotente).
            </>
          )}
        </Alert>
      )}
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Cargo</TableCell>
              <TableCell>Riesgo del cargo</TableCell>
              <TableCell>Requisitos actuales</TableCell>
              <TableCell align="right">Derivar</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {props.profiles.map((profile) => (
              <TableRow key={profile.id} hover>
                <TableCell>
                  <Typography fontWeight={700}>{profile.position}</Typography>
                </TableCell>
                <TableCell>
                  {profile.risk ? (
                    <Chip size="small" color={levelColors[profile.risk.level] ?? 'default'} label={`${profile.risk.title} (${profile.risk.level})`} />
                  ) : (
                    <Typography variant="caption" color="text.secondary">Sin riesgo asociado</Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                    {(profile.requirements ?? []).map((requirement) => (
                      <Chip
                        key={requirement.id}
                        size="small"
                        variant="outlined"
                        label={`${requirement.examType} / ${requirement.periodicityMonths}m`}
                      />
                    ))}
                    {(profile.requirements ?? []).length === 0 && (
                      <Typography variant="caption" color="text.secondary">Sin requisitos</Typography>
                    )}
                  </Stack>
                </TableCell>
                <TableCell align="right">
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<AutoFixHigh />}
                    disabled={!props.canManage || deriving === profile.id}
                    onClick={() => void derive(profile)}
                  >
                    {deriving === profile.id ? 'Derivando...' : 'Derivar requisitos'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {props.profiles.length === 0 && (
              <TableRow>
                <TableCell colSpan={4}>
                  <Typography variant="body2" color="text.secondary">Sin profesiogramas registrados.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  )
}

/** Panel S10.4: programas de vigilancia epidemiologica con sus cohortes. */
export function MedicalSurveillancePanel(props: {
  programs: MedicalSurveillanceProgram[]
  risks: Array<{ id: string; title: string; level: string; position?: string }>
  canManage: boolean
  onNewProgram: () => void
  onDeriveCohort: (programId: string, riskId: string) => Promise<{ workersCount: number; reviewed: boolean } | null>
  onReviewCohort: (cohortId: string) => Promise<void>
  onExport: (format: 'pdf' | 'csv') => void
  children?: ReactNode
}) {
  const [deriveDialog, setDeriveDialog] = useState<{ programId: string; riskId: string } | null>(null)
  const [result, setResult] = useState<{ workersCount: number; reviewed: boolean } | null>(null)

  async function submitDerive() {
    if (!deriveDialog) return
    const outcome = await props.onDeriveCohort(deriveDialog.programId, deriveDialog.riskId)
    setDeriveDialog(null)
    if (outcome) setResult(outcome)
  }

  return (
    <>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="body2" color="text.secondary">
          Programas PVE y cohortes de expuestos derivadas de la matriz de riesgos
        </Typography>
        <Button variant="outlined" size="small" onClick={() => props.onExport('pdf')} sx={{ ml: 'auto' }}>
          PVE PDF
        </Button>
        <Button variant="outlined" size="small" onClick={() => props.onExport('csv')}>
          PVE CSV
        </Button>
        <Button variant="contained" disabled={!props.canManage} onClick={props.onNewProgram}>
          Nuevo programa
        </Button>
      </Stack>
      {result && (
        <Alert severity={result.reviewed ? 'info' : 'success'} onClose={() => setResult(null)} sx={{ mb: 1 }}>
          {result.reviewed
            ? `Cohorte actualizada: ${result.workersCount} expuesto(s) en la poblacion.`
            : `Cohorte creada con ${result.workersCount} expuesto(s).`}
        </Alert>
      )}
      {props.programs.map((program) => (
        <Paper key={program.id} variant="outlined" sx={{ mb: 2, p: 1.5 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography fontWeight={700}>{program.name}</Typography>
            <Chip size="small" label={program.riskType} variant="outlined" />
            <Chip
              size="small"
              color={programStatusLabels[program.status]?.color ?? 'default'}
              label={programStatusLabels[program.status]?.label ?? program.status}
            />
            <Typography variant="caption" color="text.secondary">
              Responsable: {program.owner?.name ?? 'sin asignar'}
            </Typography>
          </Stack>
          {program.objective && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {program.objective}
            </Typography>
          )}
          <Table size="small" sx={{ mt: 1 }}>
            <TableHead>
              <TableRow>
                <TableCell>Riesgo (cohorte)</TableCell>
                <TableCell>Nivel</TableCell>
                <TableCell>Cargo del riesgo</TableCell>
                <TableCell>Expuestos</TableCell>
                <TableCell>Ultima revision</TableCell>
                <TableCell align="right">Acciones</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {program.cohorts.map((cohort) => (
                <TableRow key={cohort.id} hover>
                  <TableCell>{cohort.risk?.title ?? '-'}</TableCell>
                  <TableCell>
                    {cohort.risk && (
                      <Chip size="small" color={levelColors[cohort.risk.level] ?? 'default'} label={cohort.risk.level} />
                    )}
                  </TableCell>
                  <TableCell>{cohort.risk?.position ?? '-'}</TableCell>
                  <TableCell>{cohort._count?.workers ?? cohort.workersCount ?? 0}</TableCell>
                  <TableCell>{formatDate(cohort.lastReviewedAt)}</TableCell>
                  <TableCell align="right">
                    <Stack direction="row" spacing={1} justifyContent="flex-end">
                      <Button
                        size="small"
                        startIcon={<Refresh />}
                        disabled={!props.canManage || !cohort.risk?.id}
                        onClick={() => void props.onDeriveCohort(program.id, cohort.risk!.id)}
                      >
                        Refrescar
                      </Button>
                      {cohort.status === 'ACTIVE' && props.canManage && (
                        <Button size="small" startIcon={<TaskAlt />} onClick={() => void props.onReviewCohort(cohort.id)}>
                          Cerrar
                        </Button>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {program.cohorts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Typography variant="body2" color="text.secondary">
                      Sin cohortes. Deriva la primera desde la matriz de riesgos.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {props.canManage && (
            <Box sx={{ mt: 1 }}>
              <Button size="small" variant="outlined" onClick={() => setDeriveDialog({ programId: program.id, riskId: props.risks[0]?.id ?? '' })} disabled={props.risks.length === 0}>
                Derivar cohorte desde riesgo...
              </Button>
            </Box>
          )}
        </Paper>
      ))}
      {props.programs.length === 0 && (
        <Typography variant="body2" color="text.secondary">Sin programas de vigilancia registrados.</Typography>
      )}

      <Dialog open={Boolean(deriveDialog)} onClose={() => setDeriveDialog(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Derivar cohorte de expuestos</DialogTitle>
        <DialogContent dividers>
          <TextField
            select
            fullWidth
            label="Riesgo de la matriz"
            value={deriveDialog?.riskId ?? ''}
            onChange={(event) => setDeriveDialog((current) => (current ? { ...current, riskId: event.target.value } : current))}
            helperText="La cohorte toma los trabajadores del cargo del riesgo (o de su sede)."
            sx={{ mt: 1 }}
          >
            {props.risks.map((risk) => (
              <MenuItem key={risk.id} value={risk.id}>
                {risk.title} ({risk.level}){risk.position ? ` - ${risk.position}` : ''}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeriveDialog(null)}>Cancelar</Button>
          <Button variant="contained" disabled={!deriveDialog?.riskId} onClick={() => void submitDerive()}>
            Derivar
          </Button>
        </DialogActions>
      </Dialog>
      {props.children}
    </>
  )
}

const pveCaseStatusLabels: Record<PveCaseStatus, { label: string; color: 'warning' | 'error' | 'default' }> = {
  SUSPECTED: { label: 'Sospecha', color: 'warning' },
  CONFIRMED: { label: 'Confirmado', color: 'error' },
  CLOSED: { label: 'Cerrado', color: 'default' },
}

/**
 * Seccion #44 de la pestana Vigilancia: casos PVE por diagnostico CIE-10 con
 * ausentismo y proximo control. Los datos los carga App (paginado) y aqui solo
 * se renderizan; las acciones delegan en props.
 */
export function PveCasesSection(props: {
  cases: PveCase[]
  diagnoses: PveDiagnosis[]
  employees: Array<{ id: string; firstName: string; lastName: string }>
  canManage: boolean
  onNewCase: () => void
  onEditCase: (item: PveCase) => void
  onDeleteCase: (id: string) => void
  onAdvanceStatus: (item: PveCase) => void
  onManageDiagnoses: () => void
}) {
  const [statusFilter, setStatusFilter] = useState<'all' | PveCaseStatus>('all')
  const visible = statusFilter === 'all' ? props.cases : props.cases.filter((item) => item.status === statusFilter)

  function nextStatusOf(status: PveCaseStatus): PveCaseStatus | null {
    if (status === 'SUSPECTED') return 'CONFIRMED'
    if (status === 'CONFIRMED') return 'CLOSED'
    return null
  }

  return (
    <>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2, mb: 1 }} flexWrap="wrap" useFlexGap>
        <Typography variant="subtitle2" fontWeight={700}>
          Casos PVE (CIE-10)
        </Typography>
        {(['all', 'SUSPECTED', 'CONFIRMED', 'CLOSED'] as const).map((status) => (
          <Chip
            key={status}
            size="small"
            label={status === 'all' ? 'Todos' : pveCaseStatusLabels[status].label}
            color={statusFilter === status ? 'primary' : 'default'}
            variant={statusFilter === status ? 'filled' : 'outlined'}
            onClick={() => setStatusFilter(status)}
          />
        ))}
        <Button size="small" variant="outlined" onClick={props.onManageDiagnoses} sx={{ ml: 'auto' }}>
          Catalogo CIE-10
        </Button>
        <Button variant="contained" size="small" disabled={!props.canManage} onClick={props.onNewCase}>
          Nuevo caso
        </Button>
      </Stack>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Trabajador</TableCell>
            <TableCell>Programa</TableCell>
            <TableCell>Diagnostico</TableCell>
            <TableCell>Estado</TableCell>
            <TableCell>Ausentismo (d)</TableCell>
            <TableCell>Proximo control</TableCell>
            <TableCell align="right">Acciones</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {visible.map((item) => {
            const next = nextStatusOf(item.status)
            return (
              <TableRow key={item.id} hover>
                <TableCell>
                  {item.employee ? `${item.employee.firstName} ${item.employee.lastName}` : '-'}
                </TableCell>
                <TableCell>{item.program?.name ?? '-'}</TableCell>
                <TableCell>
                  {item.diagnosis ? `${item.diagnosis.code} - ${item.diagnosis.name}` : '-'}
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    color={pveCaseStatusLabels[item.status]?.color ?? 'default'}
                    label={pveCaseStatusLabels[item.status]?.label ?? item.status}
                  />
                </TableCell>
                <TableCell>{item.absenceDays}</TableCell>
                <TableCell>{formatDate(item.nextFollowUpAt)}</TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                    {next && props.canManage && (
                      <Button size="small" startIcon={<TaskAlt />} onClick={() => props.onAdvanceStatus(item)}>
                        {pveCaseStatusLabels[next].label}
                      </Button>
                    )}
                    {props.canManage && (
                      <>
                        <IconButton size="small" onClick={() => props.onEditCase(item)}>
                          <Edit fontSize="small" />
                        </IconButton>
                        <IconButton size="small" onClick={() => props.onDeleteCase(item.id)}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </>
                    )}
                  </Stack>
                </TableCell>
              </TableRow>
            )
          })}
          {visible.length === 0 && (
            <TableRow>
              <TableCell colSpan={7}>
                <Typography variant="body2" color="text.secondary">
                  Sin casos registrados para el filtro actual.
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </>
  )
}
