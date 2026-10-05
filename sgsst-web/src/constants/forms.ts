import type {
  AnnualActivityFormValues,
  AnnualWorkPlanFormValues,
  CompanyFormValues,
  CommitteeCommitmentFormValues,
  EmergencyBrigadeFormValues,
  EmergencyBrigadeMemberFormValues,
  EmergencyDrillFindingFormValues,
  EmergencyDrillFormValues,
  EmergencyPlanFormValues,
  EmergencyResourceFormValues,
  EmergencyThreatFormValues,
  CommitteeFormValues,
  CommitteeMeetingFormValues,
  CommitteeMemberFormValues,
  ChangeRequestFormValues,
  FindingFormValues,
  ContractorDocumentFormValues,
  ContractorFormValues,
  ContractorWorkerFormValues,
  DashboardSummary,
  PlannedInspectionFormValues,
  PpeDeliveryFormValues,
  PpeItemFormValues,
  MedicalProfileFormValues,
  MedicalExamFormValues,
  MedicalRestrictionFormValues,
  MedicalSurveillanceProgramFormValues,
  PveCaseFormValues,
  PveDiagnosisFormValues,
  UnplannedInspectionFormValues,
  UnsafeReportFormValues,
  DocumentFormValues,
  EmployeeFormValues,
  IncidentFormValues,
  IndicatorFormValues,
  PageMeta,
  RiskFormValues,
  SgsstAuditFormValues,
  SgsstEvaluationFormValues,
  SiteFormValues,
  TableState,
  TrainingFormValues,
  UserFormValues,
  ReportExportMetrics,
} from '../types'

export const emptyCompany: CompanyFormValues = {
  name: '',
  nit: '',
  arl: '',
  riskClass: 'CLASS_I',
  economicActivity: '',
  city: '',
  department: '',
  address: '',
  phone: '',
  email: '',
  reportExportExpirationDays: '',
  reportExportRetentionDays: '',
  reportFailureRateAlertPercent: '',
  reportStorageAlertBytes: '',
  whatsappAlertsEnabled: false,
  whatsappAlertPhone: '',
}

export const emptyEmployee: EmployeeFormValues = {
  firstName: '',
  lastName: '',
  documentType: 'CC',
  document: '',
  position: '',
  workCenter: '',
  contractType: 'INDEFINITE',
  employmentStatus: 'ACTIVE',
  hireDate: '',
  email: '',
  phone: '',
  companyId: '',
  siteId: '',
}

export const emptySite: SiteFormValues = {
  name: '',
  code: '',
  address: '',
  city: '',
  department: '',
  isMain: false,
  companyId: '',
}

export const emptyCommittee: CommitteeFormValues = {
  name: '',
  type: 'COPASST',
  periodStart: '',
  periodEnd: '',
  status: 'ACTIVE',
  companyId: '',
}

export const emptyCommitteeMember: CommitteeMemberFormValues = {
  role: 'PRINCIPAL',
  seatType: 'PRINCIPAL',
  startDate: '',
  endDate: '',
  employeeId: '',
  companyId: '',
}

export const emptyCommitteeMeeting: CommitteeMeetingFormValues = {
  number: '',
  meetingAt: '',
  agenda: '',
  notes: '',
  status: 'HELD',
  minutesDocumentId: '',
  companyId: '',
}

export const emptyCommitteeCommitment: CommitteeCommitmentFormValues = {
  description: '',
  responsibleEmployeeId: '',
  dueDate: '',
  companyId: '',
}

export const emptyEmergencyBrigade: EmergencyBrigadeFormValues = {
  name: '',
  siteId: '',
  companyId: '',
}

export const emptyEmergencyBrigadeMember: EmergencyBrigadeMemberFormValues = {
  role: 'BRIGADISTA',
  formationCompletedAt: '',
  validUntil: '',
  employeeId: '',
  companyId: '',
}

export const emptyEmergencyPlan: EmergencyPlanFormValues = {
  name: '',
  siteId: '',
  responsibleEmployeeId: '',
  meetingPoint: '',
  routesDescription: '',
  procedures: '',
  vulnerabilityNotes: '',
  companyId: '',
}

export const emptyEmergencyThreat: EmergencyThreatFormValues = {
  type: '',
  description: '',
  riskLevel: 'MEDIUM',
  companyId: '',
}

export const emptyEmergencyResource: EmergencyResourceFormValues = {
  resourceType: '',
  location: '',
  quantity: 1,
  status: 'OPERATIVE',
  lastInspectedAt: '',
  expiresAt: '',
  companyId: '',
}

export const emptyEmergencyDrill: EmergencyDrillFormValues = {
  name: '',
  scenario: '',
  planId: '',
  plannedAt: '',
  companyId: '',
}

export const emptyEmergencyDrillFinding: EmergencyDrillFindingFormValues = {
  description: '',
  severity: 'MINOR',
  actionDescription: '',
  actionResponsible: '',
  actionDueDate: '',
  companyId: '',
}

export const emptyChangeRequest: ChangeRequestFormValues = {
  title: '',
  reason: '',
  process: '',
  responsible: '',
  riskId: '',
  hazards: '',
  impacts: '',
  controls: '',
  requestedAt: '',
  companyId: '',
}

export const emptyFinding: FindingFormValues = {
  title: '',
  description: '',
  sourceType: 'MANUAL',
  sourceId: '',
  type: 'NON_CONFORMITY',
  severity: 'MINOR',
  ownerId: '',
  companyId: '',
}

export const emptyContractor: ContractorFormValues = {
  name: '',
  nit: '',
  contact: '',
  phone: '',
  arl: '',
  activity: '',
  status: 'ACTIVE',
  companyId: '',
}

export const emptyContractorWorker: ContractorWorkerFormValues = {
  document: '',
  firstName: '',
  lastName: '',
  job: '',
  siteId: '',
  inductedAt: '',
  status: 'ACTIVE',
  companyId: '',
}

export const emptyContractorDocument: ContractorDocumentFormValues = {
  documentType: '',
  description: '',
  expiresAt: '',
  status: 'PENDING',
  evidenceId: '',
  companyId: '',
}

export const emptyUser: UserFormValues = {
  name: '',
  email: '',
  password: '',
  role: 'EMPLOYEE',
  companyId: '',
}

export const emptyDocument: DocumentFormValues = {
  name: '',
  description: '',
  category: 'OTHER',
  status: 'DRAFT',
  fileUrl: '',
  fileName: '',
  mimeType: '',
  expiresAt: '',
  companyId: '',
  siteId: '',
}

export const emptySgsstAudit: SgsstAuditFormValues = {
  title: '',
  description: '',
  status: 'PLANNED',
  scope: '',
  auditorName: '',
  scheduledAt: '',
  result: '',
  companyId: '',
}

export const emptySgsstEvaluation: SgsstEvaluationFormValues = {
  name: '',
  riskClass: 'I',
  period: '',
  notes: '',
  companyId: '',
}

export const emptyIndicator: IndicatorFormValues = {
  name: '',
  code: '',
  description: '',
  unit: '',
  formulaDefinition: '',
  direction: 'LOWER_IS_BETTER',
  siteId: '',
  companyId: '',
}

export const emptyIncident: IncidentFormValues = {
  title: '',
  description: '',
  date: '',
  status: 'PENDING',
  companyId: '',
  siteId: '',
}

export const emptyRisk: RiskFormValues = {
  title: '',
  description: '',
  level: 'LOW',
  companyId: '',
  siteId: '',
}

export const emptyTraining: TrainingFormValues = {
  title: '',
  description: '',
  date: '',
  companyId: '',
  siteId: '',
}

export const emptyAnnualWorkPlan: AnnualWorkPlanFormValues = {
  year: String(new Date().getFullYear()),
  status: 'DRAFT',
  notes: '',
  companyId: '',
}

export const emptyAnnualActivity: AnnualActivityFormValues = {
  cycle: 'ACT',
  name: '',
  frequency: '',
  dueDate: '',
  progress: '0',
  status: 'PENDING',
  budget: '',
  ownerId: '',
  evidenceId: '',
}

export const emptyPlannedInspection: PlannedInspectionFormValues = {
  title: '',
  type: 'LOCATIVE',
  frequency: '',
  scheduledAt: '',
  status: 'PLANNED',
  siteId: '',
  inspectorId: '',
  companyId: '',
}

export const emptyUnplannedInspection: UnplannedInspectionFormValues = {
  title: '',
  reason: '',
  area: '',
  status: 'PLANNED',
  siteId: '',
  inspectorId: '',
  companyId: '',
}

export const emptyUnsafeReport: UnsafeReportFormValues = {
  kind: 'UNSAFE_CONDITION',
  description: '',
  severity: 'MINOR',
  area: '',
  isAnonymous: false,
  reporterName: '',
  siteId: '',
  companyId: '',
}

export const emptyPpeItem: PpeItemFormValues = {
  name: '',
  type: '',
  standard: '',
  size: '',
  usefulLifeDays: '',
  stockMin: '0',
  stock: '0',
  companyId: '',
}

export const emptyPpeDelivery: PpeDeliveryFormValues = {
  itemId: '',
  employeeId: '',
  quantity: '1',
  signature: '',
  notes: '',
  companyId: '',
}

export const emptyMedicalProfile: MedicalProfileFormValues = {
  position: '',
  description: '',
  examType: 'INGRESO',
  companyId: '',
}

export const emptyMedicalExam: MedicalExamFormValues = {
  examType: 'PERIODICO',
  employeeId: '',
  scheduledAt: '',
  performedAt: '',
  nextDueAt: '',
  concept: 'PENDIENTE',
  provider: '',
}

export const emptyMedicalRestriction: MedicalRestrictionFormValues = {
  description: '',
  employeeId: '',
  startDate: '',
  endDate: '',
}

export const emptyMedicalSurveillanceProgram: MedicalSurveillanceProgramFormValues = {
  name: '',
  riskType: 'BIOMECANICO',
  objective: '',
  companyId: '',
}

export const emptyPveCase: PveCaseFormValues = {
  employeeId: '',
  programId: '',
  cohortId: '',
  diagnosisId: '',
  status: 'SUSPECTED',
  reportedAt: '',
  nextFollowUpAt: '',
  absenceDays: 0,
  notes: '',
  companyId: '',
}

export const emptyPveDiagnosis: PveDiagnosisFormValues = {
  code: '',
  name: '',
  category: '',
  companyId: '',
}

export const initialTableState: TableState = {
  page: 1,
  pageSize: 10,
  search: '',
  isActive: 'all',
}

export const emptyMeta: PageMeta = {
  page: 1,
  pageSize: 10,
  total: 0,
  totalPages: 0,
}

export const emptySummary: DashboardSummary = {
  companiesCount: 0,
  employeesCount: 0,
  usersCount: 0,
  documentsCount: 0,
  criticalRisks: 0,
  openIncidents: 0,
  overdueTrainings: 0,
  upcomingTrainings: 0,
  inactiveCompanies: 0,
  inactiveEmployees: 0,
  inactiveUsers: 0,
  activeRate: 0,
  siteKpis: [],
}

export const emptyReportMetrics: ReportExportMetrics = {
  totals: {
    total: 0,
    queued: 0,
    processing: 0,
    ready: 0,
    failed: 0,
    expired: 0,
    storageBytes: 0,
    averageGenerationSeconds: 0,
  },
  byCompany: [],
  failuresByKind: [],
}
