import { Delete, Edit, Gavel } from '@mui/icons-material'
import { Button, Chip, IconButton, MenuItem, Paper, Stack, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, TextField, Typography } from '@mui/material'
import { useState } from 'react'
import { ActiveCompanyBanner, TableHeader, ViewBreadcrumb } from '../../components/TablePieces'
import { ModuleAssistantButton } from '../../components/ModuleAssistantButton'
import type { MedicalExam, MedicalProfile, MedicalRestriction, MedicalSurveillanceProgram, PveCase, PveDiagnosis } from '../../types'
import type { TableState, View } from '../../types'
import { MedicalDerivationPanel, MedicalSurveillancePanel, PveCasesSection } from './MedicalPanels'

const conceptLabels: Record<string, { label: string; color: 'default' | 'success' | 'warning' | 'error' }> = {
  PENDIENTE: { label: 'Pendiente', color: 'default' },
  APTO: { label: 'Apto', color: 'success' },
  APTO_RESTRICCION: { label: 'Apto con restriccion', color: 'warning' },
  NO_APTO: { label: 'No apto', color: 'error' },
}

function formatDate(value?: string) {
  return value ? value.slice(0, 10) : '-'
}

export function MedicalPage(props: {
  profiles: MedicalProfile[]
  exams: MedicalExam[]
  restrictions: MedicalRestriction[]
  surveillancePrograms: MedicalSurveillanceProgram[]
  surveillanceRisks: Array<{ id: string; title: string; level: string; position?: string }>
  canManage: boolean
  companies?: unknown
  onNewProfile: () => void
  onNewExam: () => void
  onEditExam: (exam: MedicalExam) => void
  onDeleteExam: (id: string) => void
  onNewRestriction: () => void
  onLiftRestriction: (id: string) => void
  onDeriveRequirements: (profileId: string) => Promise<{ worstRiskLevel: string; created: { examType: string }[] } | null>
  onNewSurveillanceProgram: () => void
  onDeriveCohort: (programId: string, riskId: string) => Promise<{ workersCount: number; reviewed: boolean } | null>
  onReviewCohort: (cohortId: string) => Promise<void>
  onExportSurveillance: (format: 'pdf' | 'csv') => void
  // #44: casos PVE y catalogo CIE-10.
  pveCases: PveCase[]
  pveDiagnoses: PveDiagnosis[]
  pveTableState: TableState
  onPveTableChange: (state: TableState) => void
  onNewPveCase: () => void
  onEditPveCase: (item: PveCase) => void
  onDeletePveCase: (id: string) => void
  onAdvancePveCaseStatus: (item: PveCase) => void
  onManagePveDiagnoses: () => void
  onOpenAssistant?: (view: View, assistantId: string) => void
  activeCompanyName?: string
}) {
  const [tab, setTab] = useState(0)
  const [employeeFilter, setEmployeeFilter] = useState('')
  void props.companies

  return (
    <Paper className="panel" variant="outlined">
      <ActiveCompanyBanner name={props.activeCompanyName} />
      <ViewBreadcrumb view="Medicina laboral" />
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }} useFlexGap flexWrap="wrap">
        <Tabs value={tab} onChange={(_e, value: number) => setTab(value)}>
          <Tab label="Profesiograma" />
          <Tab label="Examenes ocupacionales" />
          <Tab label="Restricciones" />
          <Tab label="Derivacion de requisitos" />
          <Tab label="Vigilancia epidemiologica" />
        </Tabs>
      </Stack>
      {tab === 0 && (
        <>
          <TableHeader
            title="Profesiograma por cargo"
            canCreate={props.canManage}
            onCreate={props.onNewProfile}
            assistant={props.onOpenAssistant && <ModuleAssistantButton assistantId="medical" onOpen={props.onOpenAssistant} />}
          />
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Cargo</TableCell>
                  <TableCell>Requisitos medicos</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {props.profiles.map((profile) => (
                  <TableRow key={profile.id} hover>
                    <TableCell>
                      <Typography fontWeight={700}>{profile.position}</Typography>
                      {profile.description && (
                        <Typography variant="caption" color="text.secondary">{profile.description}</Typography>
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
                  </TableRow>
                ))}
                {props.profiles.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2}>
                      <Typography variant="body2" color="text.secondary">Sin profesiogramas registrados.</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
      {tab === 1 && (
        <>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <TextField
              select size="small" label="Trabajador" sx={{ minWidth: 260 }}
              value={employeeFilter}
              onChange={(event) => setEmployeeFilter(event.target.value)}
            >
              <MenuItem value="">Todos</MenuItem>
            </TextField>
            <Button variant="contained" disabled={!props.canManage} onClick={props.onNewExam} sx={{ ml: 'auto' }}>
              Nuevo examen
            </Button>
          </Stack>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Trabajador</TableCell>
                  <TableCell>Tipo</TableCell>
                  <TableCell>Programado</TableCell>
                  <TableCell>Concepto</TableCell>
                  <TableCell>Proxima fecha</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {props.exams
                  .filter((exam) => !employeeFilter || exam.employeeId === employeeFilter)
                  .map((exam) => (
                    <TableRow key={exam.id} hover>
                      <TableCell>
                        {exam.employee ? `${exam.employee.firstName} ${exam.employee.lastName}` : '-'}
                      </TableCell>
                      <TableCell>{exam.examType}</TableCell>
                      <TableCell>{formatDate(exam.scheduledAt)}</TableCell>
                      <TableCell>
                        <Chip size="small" color={conceptLabels[exam.concept]?.color ?? 'default'} label={conceptLabels[exam.concept]?.label ?? exam.concept} />
                      </TableCell>
                      <TableCell>{formatDate(exam.nextDueAt)}</TableCell>
                      <TableCell align="right">
                        <IconButton size="small" disabled={!props.canManage} onClick={() => props.onEditExam(exam)}>
                          <Edit />
                        </IconButton>
                        <IconButton size="small" disabled={!props.canManage} color="error" onClick={() => props.onDeleteExam(exam.id)}>
                          <Delete />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                {props.exams.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Typography variant="body2" color="text.secondary">Sin examenes registrados.</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
      {tab === 2 && (
        <>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="body2" color="text.secondary">Restricciones activas y levantadas</Typography>
            <Button variant="contained" disabled={!props.canManage} onClick={props.onNewRestriction} sx={{ ml: 'auto' }}>
              Nueva restriccion
            </Button>
          </Stack>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Trabajador</TableCell>
                  <TableCell>Restriccion</TableCell>
                  <TableCell>Desde</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell align="right">Levantar</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {props.restrictions.map((restriction) => (
                  <TableRow key={restriction.id} hover>
                    <TableCell>
                      {restriction.employee ? `${restriction.employee.firstName} ${restriction.employee.lastName}` : '-'}
                    </TableCell>
                    <TableCell>{restriction.description}</TableCell>
                    <TableCell>{formatDate(restriction.startDate)}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={restriction.status === 'ACTIVE' ? 'warning' : 'default'}
                        label={restriction.status === 'ACTIVE' ? 'Activa' : 'Levantada'}
                      />
                      {restriction.status === 'LIFTED' && restriction.liftedBy && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          por {restriction.liftedBy}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {restriction.status === 'ACTIVE' && props.canManage && (
                        <Button size="small" startIcon={<Gavel />} onClick={() => props.onLiftRestriction(restriction.id)}>
                          Levantar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {props.restrictions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <Typography variant="body2" color="text.secondary">Sin restricciones registradas.</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
      {tab === 3 && (
        <MedicalDerivationPanel profiles={props.profiles} canManage={props.canManage} onDerive={props.onDeriveRequirements} />
      )}
      {tab === 4 && (
        <MedicalSurveillancePanel
          programs={props.surveillancePrograms}
          risks={props.surveillanceRisks}
          canManage={props.canManage}
          onNewProgram={props.onNewSurveillanceProgram}
          onDeriveCohort={props.onDeriveCohort}
          onReviewCohort={props.onReviewCohort}
          onExport={props.onExportSurveillance}
        >
          <PveCasesSection
            cases={props.pveCases}
            diagnoses={props.pveDiagnoses}
            employees={[]}
            canManage={props.canManage}
            onNewCase={props.onNewPveCase}
            onEditCase={props.onEditPveCase}
            onDeleteCase={props.onDeletePveCase}
            onAdvanceStatus={props.onAdvancePveCaseStatus}
            onManageDiagnoses={props.onManagePveDiagnoses}
          />
        </MedicalSurveillancePanel>
      )}
    </Paper>
  )
}
