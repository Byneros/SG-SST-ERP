import {
  FactCheck,
  Gavel,
  Link as LinkIcon,
  PlaylistAddCheck,
  ReportProblem,
  Visibility,
  Sync,
} from '@mui/icons-material'
import {
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
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
  Tooltip,
  Typography,
} from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { api, readApiError } from '../../api/client'
import { ActiveCompanyBanner, Pager } from '../../components/TablePieces'
import type {
  AuthUser,
  Company,
  CompanyLegalRequirement,
  LegalComplianceFilters,
  LegalComplianceReports,
  LegalComplianceSummary,
  LegalRequirementStatus,
  PageMeta,
  Paginated,
  TableState,
} from '../../types'

type EvidenceEntity = 'Document' | 'Audit'
type EvidenceOption = {
  id: string
  label: string
  detail: string
  entity: EvidenceEntity
}

const emptyMeta: PageMeta = { page: 1, pageSize: 10, total: 0, totalPages: 0 }
const emptySummary: LegalComplianceSummary = {
  companyId: '',
  total: 0,
  applicable: 0,
  byStatus: {},
  overdue: 0,
  complianceRate: 0,
  averageScore: 0,
}
const emptyReports: LegalComplianceReports = {
  byNorm: [],
  openGaps: [],
  missingEvidence: [],
  criticalDeadlines: [],
  totals: {
    norms: 0,
    openGaps: 0,
    missingEvidence: 0,
    criticalDeadlines: 0,
  },
}

const statusColor: Record<LegalRequirementStatus, 'default' | 'primary' | 'success' | 'error' | 'warning'> = {
  PENDING: 'default',
  COMPLIES: 'success',
  PARTIAL: 'warning',
  NON_COMPLIANT: 'error',
  NOT_APPLICABLE: 'primary',
}

const riskColor: Record<string, 'default' | 'primary' | 'warning' | 'error'> = {
  LOW: 'default',
  MEDIUM: 'primary',
  HIGH: 'warning',
  CRITICAL: 'error',
}

export function LegalCompliancePage(props: {
  user: AuthUser
  companies: Company[]
  activeCompanyName?: string
}) {
  const storedCompanyId = localStorage.getItem('selectedCompanyId');

  const defaultCompanyId =
    props.user.role === 'SUPER_ADMIN'
      ? storedCompanyId ??
      props.user.activeCompanyId ??
      props.companies[0]?.id ?? '' : props.user.activeCompanyId ?? props.user.companyId ?? '';
  const [items, setItems] = useState<CompanyLegalRequirement[]>([])
  const [meta, setMeta] = useState<PageMeta>(emptyMeta)
  const [summary, setSummary] = useState<LegalComplianceSummary>(emptySummary)
  const [reports, setReports] = useState<LegalComplianceReports>(emptyReports)
  const [tableState, setTableState] = useState<TableState>({
    page: 1,
    pageSize: 10,
    search: '',
    isActive: 'all',
  })
  const [filters, setFilters] = useState<LegalComplianceFilters>({
    companyId: defaultCompanyId,
    status: 'all',
    applies: 'all',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [detailItem, setDetailItem] = useState<CompanyLegalRequirement | null>(null)
  const [evidenceOptions, setEvidenceOptions] = useState<EvidenceOption[]>([])
  const [evidenceForm, setEvidenceForm] = useState({
    entity: 'Document' as EvidenceEntity,
    entityId: '',
    status: 'COMPLIES' as LegalRequirementStatus,
    comments: '',
  })

  const companyId = filters.companyId || defaultCompanyId
  const canOperate = props.user.role === 'SUPER_ADMIN' || props.user.role === 'ADMIN' || props.user.role === 'SST'
  const canSeed = props.user.role === 'SUPER_ADMIN'

  useEffect(() => {
    if (!filters.companyId && defaultCompanyId) {
      setFilters((current) => ({ ...current, companyId: defaultCompanyId }))
    }
  }, [defaultCompanyId, filters.companyId])

  useEffect(() => {
    if (!companyId) return;
    localStorage.setItem('selectedCompanyId', companyId);
    void loadLegalMap();}
      ,[
      companyId,
      tableState.page,
      tableState.pageSize,
      tableState.search,
      filters.status,
      filters.applies,
      ]);

  const metrics = useMemo(
    () => [
      { label: 'Cumplimiento', value: `${summary.complianceRate}%`, icon: <FactCheck /> },
      { label: 'Aplicables', value: summary.applicable.toString(), icon: <Gavel /> },
      { label: 'Vencidos', value: summary.overdue.toString(), icon: <PlaylistAddCheck /> },
      { label: 'Puntaje', value: `${summary.averageScore}%`, icon: <LinkIcon /> },
    ],
    [summary],
  )

  async function loadLegalMap() {
  // Evitar llamadas cuando aún no existe una empresa seleccionada
  if (!companyId) {
    setItems([]);
    setMeta(emptyMeta);
    setSummary(emptySummary);
    setReports(emptyReports);
    return;
  }

  setLoading(true);
  setError('');

  try {
    const params = {
      page: tableState.page,
      pageSize: tableState.pageSize,
      search: tableState.search || undefined,
      status: filters.status === 'all' ? undefined : filters.status,
      applies:
        filters.applies === 'all'
          ? undefined
          : filters.applies === 'yes',
    };

    const [requirementsResponse, summaryResponse] = await Promise.all([
      api.get<Paginated<CompanyLegalRequirement>>(
        `/legal-compliance/companies/${companyId}/requirements`,
        { params },
      ),
      api.get<LegalComplianceSummary>(
        `/legal-compliance/companies/${companyId}/summary`,
      ),
    ]);

    setItems(requirementsResponse.data.data);
    setMeta(requirementsResponse.data.meta);
    setSummary(summaryResponse.data);

    await loadReports();
  } catch (currentError) {
    setError(readApiError(currentError));
  } finally {
    setLoading(false);
  }
}

  async function loadReports() {
    if (!companyId) return
    try {
      const response = await api.get<LegalComplianceReports>(`/legal-compliance/companies/${companyId}/reports`)
      setReports(response.data)
    } catch (currentError) {
      setError(readApiError(currentError))
    }
  }

  async function seedDefaults() {
    await runAction(async () => {
      await api.post('/legal-compliance/seed-defaults')
      setMessage('Catalogo normativo base cargado.')
    })
  }

  async function syncCompany() {
    if (!companyId) return
    await runAction(async () => {
      const response = await api.post(`/legal-compliance/companies/${companyId}/requirements/sync`)
      setMessage(`Sincronizacion completada: ${response.data.created} requisitos nuevos.`)
    })
  }

  async function updateStatus(item: CompanyLegalRequirement, status: LegalRequirementStatus) {
    await runAction(async () => {
      await api.patch(`/legal-compliance/company-requirements/${item.id}`, {
        status,
        score: status === 'COMPLIES' ? 100 : status === 'PARTIAL' ? 50 : status === 'NOT_APPLICABLE' ? 100 : 0,
        lastReviewedAt: new Date().toISOString(),
      })
      setMessage('Estado de cumplimiento actualizado.')
    })
  }

  async function updateNotes(item: CompanyLegalRequirement) {
    const notes = window.prompt('Notas de revision', item.notes ?? '')
    if (notes === null) return
    await runAction(async () => {
      await api.patch(`/legal-compliance/company-requirements/${item.id}`, { notes })
      setMessage('Notas actualizadas.')
    })
  }

  async function openDetail(item: CompanyLegalRequirement) {
    setDetailItem(item)
    setEvidenceForm({
      entity: 'Document',
      entityId: '',
      status: 'COMPLIES',
      comments: '',
    })
    await loadEvidenceOptions()
  }

  async function loadEvidenceOptions() {
    if (!companyId) return
    try {
      const [documentsResponse, auditsResponse] = await Promise.all([
        api.get<Paginated<{ id: string; name: string; category: string; status: string; expiresAt?: string }>>('/documents', {
          params: { page: 1, pageSize: 100, companyId },
        }),
        api.get<Paginated<{ id: string; title: string; status: string; scheduledAt: string }>>('/sgsst-audits', {
          params: { page: 1, pageSize: 100, companyId },
        }),
      ])
      setEvidenceOptions([
        ...documentsResponse.data.data.map((document) => ({
          id: document.id,
          label: document.name,
          detail: `${document.category} - ${document.status}${document.expiresAt ? ` - vence ${document.expiresAt.slice(0, 10)}` : ''}`,
          entity: 'Document' as const,
        })),
        ...auditsResponse.data.data.map((audit) => ({
          id: audit.id,
          label: audit.title,
          detail: `${audit.status} - ${audit.scheduledAt.slice(0, 10)}`,
          entity: 'Audit' as const,
        })),
      ])
    } catch (currentError) {
      setError(readApiError(currentError))
    }
  }

  async function linkEvidence() {
    if (!detailItem || !evidenceForm.entityId) return
    await runAction(async () => {
      await api.post(`/legal-compliance/company-requirements/${detailItem.id}/evidences`, {
        entity: evidenceForm.entity,
        entityId: evidenceForm.entityId,
        status: evidenceForm.status,
        comments: evidenceForm.comments || undefined,
      })
      setMessage('Evidencia vinculada al requisito legal.')
      setDetailItem(null)
    })
  }

  async function runAction(action: () => Promise<void>) {
    setLoading(true)
    setError('')
    setMessage('')
    try {
      await action()
      await loadLegalMap()
    } catch (currentError) {
      setError(readApiError(currentError))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Paper className="panel" variant="outlined">
      <ActiveCompanyBanner name={props.activeCompanyName} />
      <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
        <Stack spacing={0.5}>
          <Typography variant="h6">Mapa Normativo SG-SST</Typography>
          <Typography color="text.secondary">
            Requisitos legales conectados con evidencias, modulos, responsables, vencimientos e indicadores.
          </Typography>
        </Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button startIcon={<Gavel />} variant="outlined" disabled={!canSeed || loading} onClick={seedDefaults}>
            Cargar base legal
          </Button>
          <Button startIcon={<Sync />} variant="contained" disabled={!canOperate || !companyId || loading} onClick={syncCompany}>
            Sincronizar empresa
          </Button>
        </Stack>
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        {metrics.map((item) => (
          <Paper key={item.label} variant="outlined" sx={{ p: 1.5, flex: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              {item.icon}
              <Stack>
                <Typography variant="caption" color="text.secondary">
                  {item.label}
                </Typography>
                <Typography variant="h6">{item.value}</Typography>
              </Stack>
            </Stack>
          </Paper>
        ))}
      </Stack>

      <Stack direction={{ xs: 'column', xl: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <Paper variant="outlined" sx={{ p: 1.5, flex: 1.2 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <Gavel fontSize="small" />
            <Typography variant="subtitle2">Cumplimiento por norma</Typography>
          </Stack>
          {reports.byNorm.length === 0 ? (
            <Typography color="text.secondary">Sin datos normativos sincronizados.</Typography>
          ) : (
            <Stack spacing={1}>
              {reports.byNorm.slice(0, 5).map((item) => (
                <Paper key={item.normCode} variant="outlined" sx={{ p: 1 }}>
                  <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1}>
                    <Stack>
                      <Typography variant="body2">{item.normName}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {item.normCode} - {item.total} requisitos - {item.missingEvidence} evidencias faltantes
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip size="small" label={`${item.complianceRate}%`} color={item.complianceRate >= 80 ? 'success' : item.complianceRate >= 50 ? 'warning' : 'error'} />
                      <Chip size="small" label={`${item.overdue} vencidos`} variant="outlined" />
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </Paper>

        <Paper variant="outlined" sx={{ p: 1.5, flex: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
            <ReportProblem fontSize="small" />
            <Typography variant="subtitle2">Brechas y vencimientos</Typography>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 1.5 }}>
            <Chip label={`${reports.totals.openGaps} brechas`} color={reports.totals.openGaps ? 'error' : 'success'} variant="outlined" />
            <Chip label={`${reports.totals.missingEvidence} evidencias faltantes`} color={reports.totals.missingEvidence ? 'warning' : 'success'} variant="outlined" />
            <Chip label={`${reports.totals.criticalDeadlines} vencimientos criticos`} color={reports.totals.criticalDeadlines ? 'error' : 'success'} variant="outlined" />
          </Stack>
          <Stack spacing={1}>
            {reports.criticalDeadlines.slice(0, 3).map((item) => (
              <Paper key={item.id} variant="outlined" sx={{ p: 1 }}>
                <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1}>
                  <Stack>
                    <Typography variant="body2">{item.requirementTitle}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.normCode} - {item.dueDate ? item.dueDate.slice(0, 10) : '-'}
                    </Typography>
                  </Stack>
                  <Chip size="small" label={item.overdue ? 'Vencido' : item.status} color={item.overdue ? 'error' : statusColor[item.status]} variant="outlined" />
                </Stack>
              </Paper>
            ))}
            {reports.criticalDeadlines.length === 0 && (
              <Typography color="text.secondary">Sin vencimientos criticos proximos.</Typography>
            )}
          </Stack>
        </Paper>
      </Stack>

      <Stack direction={{ xs: 'column', xl: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <ReportList
          title="Brechas legales abiertas"
          items={reports.openGaps.slice(0, 5).map((item) => ({
            id: item.id,
            title: item.requirementTitle,
            meta: `${item.normCode} - ${item.status} - ${item.riskLevel}`,
            color: statusColor[item.status],
          }))}
          empty="Sin brechas abiertas."
        />
        <ReportList
          title="Evidencias faltantes"
          items={reports.missingEvidence.slice(0, 5).map((item) => ({
            id: item.id,
            title: item.requirementTitle,
            meta: `${item.normCode} - faltan ${item.missingCount} - ${item.requiredEvidence.join(', ')}`,
            color: riskColor[item.riskLevel],
          }))}
          empty="Sin evidencias faltantes."
        />
      </Stack>

      {error && (
        <Typography color="error" sx={{ mb: 2 }}>
          {error}
        </Typography>
      )}
      {message && (
        <Typography color="success.main" sx={{ mb: 2 }}>
          {message}
        </Typography>
      )}

      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <TextField
          size="small"
          placeholder="Buscar norma, requisito o evidencia"
          value={tableState.search}
          onChange={(event) => setTableState({ ...tableState, page: 1, search: event.target.value })}
          sx={{ minWidth: { lg: 320 } }}
        />
        <TextField
          select
          size="small"
          label="Empresa"
          value={companyId}
          disabled={props.user.role !== 'SUPER_ADMIN'}
          onChange={(event) => {
          const id = event.target.value;
          localStorage.setItem('selectedCompanyId', id);
          setTableState((current) => ({
          ...current,
          page: 1,
          }));

  setFilters((current) => ({
    ...current,
    companyId: id,
  }));
}}
          sx={{ minWidth: 220 }}
        >
          {props.companies.map((company) => (
            <MenuItem key={company.id} value={company.id}>
              {company.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Estado"
          value={filters.status}
          onChange={(event) => {
            setTableState((current) => ({ ...current, page: 1 }))
            setFilters({ ...filters, status: event.target.value as LegalComplianceFilters['status'] })
          }}
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="all">Todos</MenuItem>
          <MenuItem value="PENDING">Pendiente</MenuItem>
          <MenuItem value="COMPLIES">Cumple</MenuItem>
          <MenuItem value="PARTIAL">Parcial</MenuItem>
          <MenuItem value="NON_COMPLIANT">No cumple</MenuItem>
          <MenuItem value="NOT_APPLICABLE">No aplica</MenuItem>
        </TextField>
        <TextField
          select
          size="small"
          label="Aplicabilidad"
          value={filters.applies}
          onChange={(event) => {
            setTableState((current) => ({ ...current, page: 1 }))
            setFilters({ ...filters, applies: event.target.value as LegalComplianceFilters['applies'] })
          }}
          sx={{ minWidth: 170 }}
        >
          <MenuItem value="all">Todos</MenuItem>
          <MenuItem value="yes">Aplicables</MenuItem>
          <MenuItem value="no">No aplicables</MenuItem>
        </TextField>
      </Stack>

      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Requisito legal</TableCell>
              <TableCell>Modulo / evidencia</TableCell>
              <TableCell>Frecuencia</TableCell>
              <TableCell>Riesgo</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell>Vence</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id} hover>
                <TableCell sx={{ minWidth: 280 }}>
                  <Typography variant="subtitle2">{item.requirement.title}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {item.requirement.norm.name} {item.requirement.article ? `- ${item.requirement.article}` : ''}
                  </Typography>
                </TableCell>
                <TableCell sx={{ minWidth: 240 }}>
                  <Stack spacing={0.5}>
                    <Typography variant="body2">
                      {item.requirement.mappings.map((mapping) => mapping.moduleKey).join(', ') || '-'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.requirement.evidenceRequirements.map((evidence) => evidence.evidenceName).join(', ') || '-'}
                    </Typography>
                  </Stack>
                </TableCell>
                <TableCell>{item.requirement.frequency}</TableCell>
                <TableCell>
                  <Chip size="small" label={item.requirement.riskLevel} color={riskColor[item.requirement.riskLevel]} variant="outlined" />
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip size="small" label={item.status} color={statusColor[item.status]} variant="outlined" />
                    {!item.applies && <Chip size="small" label="No aplica" variant="outlined" />}
                  </Stack>
                </TableCell>
                <TableCell>{item.dueDate ? item.dueDate.slice(0, 10) : '-'}</TableCell>
                <TableCell align="right">
                  <TextField
                    select
                    size="small"
                    value={item.status}
                    disabled={!canOperate || loading}
                    onChange={(event) => updateStatus(item, event.target.value as LegalRequirementStatus)}
                    sx={{ minWidth: 132 }}
                  >
                    <MenuItem value="PENDING">Pendiente</MenuItem>
                    <MenuItem value="COMPLIES">Cumple</MenuItem>
                    <MenuItem value="PARTIAL">Parcial</MenuItem>
                    <MenuItem value="NON_COMPLIANT">No cumple</MenuItem>
                    <MenuItem value="NOT_APPLICABLE">No aplica</MenuItem>
                  </TextField>
                  <Tooltip title="Notas">
                    <span>
                      <IconButton disabled={!canOperate || loading} onClick={() => updateNotes(item)}>
                        <PlaylistAddCheck />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Detalle y evidencias">
                    <IconButton onClick={() => openDetail(item)}>
                      <Visibility />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={7}>
                  <Typography color="text.secondary">
                    Sin requisitos para mostrar. Carga la base legal y sincroniza la empresa.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <Pager meta={meta} state={tableState} onChange={setTableState} />
      <Dialog open={Boolean(detailItem)} onClose={() => setDetailItem(null)} maxWidth="md" fullWidth>
        <DialogTitle>Detalle del requisito legal</DialogTitle>
        <DialogContent>
          {detailItem && (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Stack spacing={0.5}>
                <Typography variant="subtitle1">{detailItem.requirement.title}</Typography>
                <Typography color="text.secondary">{detailItem.requirement.description}</Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Chip size="small" label={detailItem.requirement.norm.name} />
                  <Chip size="small" label={detailItem.requirement.frequency} variant="outlined" />
                  <Chip size="small" label={detailItem.requirement.riskLevel} color={riskColor[detailItem.requirement.riskLevel]} variant="outlined" />
                  <Chip size="small" label={detailItem.status} color={statusColor[detailItem.status]} variant="outlined" />
                </Stack>
              </Stack>

              <Divider />

              <Stack spacing={1}>
                <Typography variant="subtitle2">Trazabilidad del sistema</Typography>
                {detailItem.requirement.mappings.length === 0 ? (
                  <Typography color="text.secondary">Sin modulos asociados.</Typography>
                ) : (
                  detailItem.requirement.mappings.map((mapping) => (
                    <Paper key={mapping.id} variant="outlined" sx={{ p: 1.25 }}>
                      <Typography variant="body2">{mapping.moduleKey}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        KPI: {mapping.kpiKey ?? '-'} - Reporte: {mapping.reportKey ?? '-'} - Evidencia: {mapping.evidenceType ?? '-'}
                      </Typography>
                    </Paper>
                  ))
                )}
              </Stack>

              <Stack spacing={1}>
                <Typography variant="subtitle2">Evidencias requeridas</Typography>
                {detailItem.requirement.evidenceRequirements.map((evidence) => (
                  <Paper key={evidence.id} variant="outlined" sx={{ p: 1.25 }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
                      <Typography variant="body2">{evidence.evidenceName}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {evidence.evidenceType} - {evidence.frequency} - retencion {evidence.retentionYears ?? '-'} anos
                      </Typography>
                    </Stack>
                  </Paper>
                ))}
              </Stack>

              <Stack spacing={1}>
                <Typography variant="subtitle2">Evidencias vinculadas</Typography>
                {detailItem.evidences.length === 0 ? (
                  <Typography color="text.secondary">Aun no hay evidencias vinculadas.</Typography>
                ) : (
                  detailItem.evidences.map((evidence) => (
                    <Paper key={evidence.id} variant="outlined" sx={{ p: 1.25 }}>
                      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
                        <Typography variant="body2">{evidence.entity}</Typography>
                        <Chip size="small" label={evidence.status} color={statusColor[evidence.status]} variant="outlined" />
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {evidence.comments || evidence.entityId}
                      </Typography>
                    </Paper>
                  ))
                )}
              </Stack>

              <Divider />

              <Stack spacing={1}>
                <Typography variant="subtitle2">Vincular evidencia</Typography>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
                  <TextField
                    select
                    size="small"
                    label="Origen"
                    value={evidenceForm.entity}
                    onChange={(event) =>
                      setEvidenceForm((current) => ({
                        ...current,
                        entity: event.target.value as EvidenceEntity,
                        entityId: '',
                      }))
                    }
                    sx={{ minWidth: 150 }}
                  >
                    <MenuItem value="Document">Documento</MenuItem>
                    <MenuItem value="Audit">Auditoria</MenuItem>
                  </TextField>
                  <TextField
                    select
                    size="small"
                    label="Registro"
                    value={evidenceForm.entityId}
                    onChange={(event) => setEvidenceForm((current) => ({ ...current, entityId: event.target.value }))}
                    sx={{ minWidth: { md: 320 }, flex: 1 }}
                  >
                    {evidenceOptions
                      .filter((option) => option.entity === evidenceForm.entity)
                      .map((option) => (
                        <MenuItem key={option.id} value={option.id}>
                          {option.label} - {option.detail}
                        </MenuItem>
                      ))}
                  </TextField>
                  <TextField
                    select
                    size="small"
                    label="Validacion"
                    value={evidenceForm.status}
                    onChange={(event) => setEvidenceForm((current) => ({ ...current, status: event.target.value as LegalRequirementStatus }))}
                    sx={{ minWidth: 160 }}
                  >
                    <MenuItem value="COMPLIES">Cumple</MenuItem>
                    <MenuItem value="PARTIAL">Parcial</MenuItem>
                    <MenuItem value="NON_COMPLIANT">No cumple</MenuItem>
                  </TextField>
                </Stack>
                <TextField
                  size="small"
                  label="Comentarios"
                  multiline
                  minRows={2}
                  value={evidenceForm.comments}
                  onChange={(event) => setEvidenceForm((current) => ({ ...current, comments: event.target.value }))}
                />
              </Stack>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailItem(null)}>Cerrar</Button>
          <Button variant="contained" disabled={!canOperate || !evidenceForm.entityId || loading} onClick={linkEvidence}>
            Vincular evidencia
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  )
}

function ReportList(props: {
  title: string
  items: Array<{ id: string; title: string; meta: string; color: 'default' | 'primary' | 'success' | 'error' | 'warning' }>
  empty: string
}) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, flex: 1 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {props.title}
      </Typography>
      {props.items.length === 0 ? (
        <Typography color="text.secondary">{props.empty}</Typography>
      ) : (
        <Stack spacing={1}>
          {props.items.map((item) => (
            <Paper key={item.id} variant="outlined" sx={{ p: 1 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}>
                <Stack>
                  <Typography variant="body2">{item.title}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {item.meta}
                  </Typography>
                </Stack>
                <Chip size="small" label="Priorizar" color={item.color} variant="outlined" />
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}
    </Paper>
  )
}
