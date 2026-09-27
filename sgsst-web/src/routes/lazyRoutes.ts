import { lazy } from 'react'
import type { View } from '../types'

const pageLoaders = {
  dashboard: () => import('../pages/dashboard/DashboardPage'),
  aiAssistant: () => import('../pages/ai-assistant/AssistantChatPage'),
  companies: () => import('../pages/companies/CompaniesPage'),
  sites: () => import('../pages/sites/SitesPage'),
  employees: () => import('../pages/employees/EmployeesPage'),
  incidents: () => import('../pages/incidents/IncidentsPage'),
  risks: () => import('../pages/risks/RisksPage'),
  trainings: () => import('../pages/trainings/TrainingsPage'),
  documents: () => import('../pages/documents/DocumentsPage'),
  sgsstAudits: () => import('../pages/sgsst-audits/SgsstAuditsPage'),
  sgsstEvaluations: () => import('../pages/sgsst-evaluations/SgsstEvaluationsPage'),
  annualWorkPlans: () => import('../pages/annual-work-plans/AnnualWorkPlansPage'),
  plannedInspections: () => import('../pages/planned-inspections/PlannedInspectionsPage'),
  unplannedInspections: () => import('../pages/unplanned-inspections/UnplannedInspectionsPage'),
  unsafeReports: () => import('../pages/unsafe-reports/UnsafeReportsPage'),
  ppe: () => import('../pages/ppe/PpePage'),
  medical: () => import('../pages/medical/MedicalPage'),
  indicators: () => import('../pages/indicators/IndicatorsPage'),
  legalCompliance: () => import('../pages/legal-compliance/LegalCompliancePage'),
  reports: () => import('../pages/reports/ReportExportsPage'),
  users: () => import('../pages/users/UsersPage'),
  externalDeliveries: () => import('../pages/external-deliveries/ExternalDeliveriesPage'),
  audit: () => import('../pages/audit/AuditPage'),
}

const dialogLoaders = {
  company: () => import('../pages/companies/CompanyDialog'),
  site: () => import('../pages/sites/SiteDialog'),
  employee: () => import('../pages/employees/EmployeeDialog'),
  incident: () => import('../pages/incidents/IncidentDialog'),
  risk: () => import('../pages/risks/RiskDialog'),
  training: () => import('../pages/trainings/TrainingDialog'),
  document: () => import('../pages/documents/DocumentDialog'),
  sgsstAudit: () => import('../pages/sgsst-audits/SgsstAuditDialog'),
  sgsstEvaluation: () => import('../pages/sgsst-evaluations/SgsstEvaluationDialog'),
  annualWorkPlan: () => import('../pages/annual-work-plans/AnnualWorkPlanDialog'),
  plannedInspection: () => import('../pages/planned-inspections/PlannedInspectionDialog'),
  unplannedInspection: () => import('../pages/unplanned-inspections/UnplannedInspectionDialog'),
  unsafeReport: () => import('../pages/unsafe-reports/UnsafeReportDialog'),
  ppeDialogs: () => import('../pages/ppe/PpeDialogs'),
  medicalDialogs: () => import('../pages/medical/MedicalDialogs'),
  indicator: () => import('../pages/indicators/IndicatorDialog'),
  user: () => import('../pages/users/UserDialog'),
}

export const AssistantChatPage = lazy(() =>
  pageLoaders.aiAssistant().then((module) => ({ default: module.AssistantChatPage })),
)
export const DashboardPage = lazy(() =>
  pageLoaders.dashboard().then((module) => ({ default: module.DashboardPage })),
)
export const CompaniesPage = lazy(() =>
  pageLoaders.companies().then((module) => ({ default: module.CompaniesPage })),
)
export const SitesPage = lazy(() =>
  pageLoaders.sites().then((module) => ({ default: module.SitesPage })),
)
export const EmployeesPage = lazy(() =>
  pageLoaders.employees().then((module) => ({ default: module.EmployeesPage })),
)
export const IncidentsPage = lazy(() =>
  pageLoaders.incidents().then((module) => ({ default: module.IncidentsPage })),
)
export const RisksPage = lazy(() =>
  pageLoaders.risks().then((module) => ({ default: module.RisksPage })),
)
export const TrainingsPage = lazy(() =>
  pageLoaders.trainings().then((module) => ({ default: module.TrainingsPage })),
)
export const DocumentsPage = lazy(() =>
  pageLoaders.documents().then((module) => ({ default: module.DocumentsPage })),
)
export const SgsstAuditsPage = lazy(() =>
  pageLoaders.sgsstAudits().then((module) => ({ default: module.SgsstAuditsPage })),
)
export const SgsstEvaluationsPage = lazy(() =>
  pageLoaders.sgsstEvaluations().then((module) => ({ default: module.SgsstEvaluationsPage })),
)
export const IndicatorsPage = lazy(() =>
  pageLoaders.indicators().then((module) => ({ default: module.IndicatorsPage })),
)
export const AnnualWorkPlansPage = lazy(() =>
  pageLoaders.annualWorkPlans().then((module) => ({ default: module.AnnualWorkPlansPage })),
)
export const PlannedInspectionsPage = lazy(() =>
  pageLoaders.plannedInspections().then((module) => ({ default: module.PlannedInspectionsPage })),
)
export const UnplannedInspectionsPage = lazy(() =>
  pageLoaders.unplannedInspections().then((module) => ({ default: module.UnplannedInspectionsPage })),
)
export const UnsafeReportsPage = lazy(() =>
  pageLoaders.unsafeReports().then((module) => ({ default: module.UnsafeReportsPage })),
)
export const PpePage = lazy(() =>
  pageLoaders.ppe().then((module) => ({ default: module.PpePage })),
)
export const MedicalPage = lazy(() =>
  pageLoaders.medical().then((module) => ({ default: module.MedicalPage })),
)
export const LegalCompliancePage = lazy(() =>
  pageLoaders.legalCompliance().then((module) => ({ default: module.LegalCompliancePage })),
)
export const ReportExportsPage = lazy(() =>
  pageLoaders.reports().then((module) => ({ default: module.ReportExportsPage })),
)
export const UsersPage = lazy(() =>
  pageLoaders.users().then((module) => ({ default: module.UsersPage })),
)
export const ExternalDeliveriesPage = lazy(() =>
  pageLoaders.externalDeliveries().then((module) => ({ default: module.ExternalDeliveriesPage })),
)
export const AuditPage = lazy(() =>
  pageLoaders.audit().then((module) => ({ default: module.AuditPage })),
)

export const CompanyDialog = lazy(() =>
  dialogLoaders.company().then((module) => ({ default: module.CompanyDialog })),
)
export const SiteDialog = lazy(() =>
  dialogLoaders.site().then((module) => ({ default: module.SiteDialog })),
)
export const EmployeeDialog = lazy(() =>
  dialogLoaders.employee().then((module) => ({ default: module.EmployeeDialog })),
)
export const IncidentDialog = lazy(() =>
  dialogLoaders.incident().then((module) => ({ default: module.IncidentDialog })),
)
export const RiskDialog = lazy(() =>
  dialogLoaders.risk().then((module) => ({ default: module.RiskDialog })),
)
export const TrainingDialog = lazy(() =>
  dialogLoaders.training().then((module) => ({ default: module.TrainingDialog })),
)
export const DocumentDialog = lazy(() =>
  dialogLoaders.document().then((module) => ({ default: module.DocumentDialog })),
)
export const SgsstAuditDialog = lazy(() =>
  dialogLoaders.sgsstAudit().then((module) => ({ default: module.SgsstAuditDialog })),
)
export const SgsstEvaluationDialog = lazy(() =>
  dialogLoaders.sgsstEvaluation().then((module) => ({ default: module.SgsstEvaluationDialog })),
)
export const IndicatorDialog = lazy(() =>
  dialogLoaders.indicator().then((module) => ({ default: module.IndicatorDialog })),
)
export const AnnualWorkPlanDialog = lazy(() =>
  dialogLoaders.annualWorkPlan().then((module) => ({ default: module.AnnualWorkPlanDialog })),
)
export const PlannedInspectionDialog = lazy(() =>
  dialogLoaders.plannedInspection().then((module) => ({ default: module.PlannedInspectionDialog })),
)
export const UnplannedInspectionDialog = lazy(() =>
  dialogLoaders.unplannedInspection().then((module) => ({ default: module.UnplannedInspectionDialog })),
)
export const UnsafeReportDialog = lazy(() =>
  dialogLoaders.unsafeReport().then((module) => ({ default: module.UnsafeReportDialog })),
)
export const PpeItemDialog = lazy(() =>
  dialogLoaders.ppeDialogs().then((module) => ({ default: module.PpeItemDialog })),
)
export const PpeDeliveryDialog = lazy(() =>
  dialogLoaders.ppeDialogs().then((module) => ({ default: module.PpeDeliveryDialog })),
)
export const MedicalProfileDialog = lazy(() =>
  dialogLoaders.medicalDialogs().then((module) => ({ default: module.MedicalProfileDialog })),
)
export const MedicalExamDialog = lazy(() =>
  dialogLoaders.medicalDialogs().then((module) => ({ default: module.MedicalExamDialog })),
)
export const MedicalRestrictionDialog = lazy(() =>
  dialogLoaders.medicalDialogs().then((module) => ({ default: module.MedicalRestrictionDialog })),
)
export const UserDialog = lazy(() =>
  dialogLoaders.user().then((module) => ({ default: module.UserDialog })),
)

export function preloadView(view: View) {
  void pageLoaders[view]()
}

export function preloadCompanyDialog() {
  void dialogLoaders.company()
}

export function preloadSiteDialog() {
  void dialogLoaders.site()
}

export function preloadEmployeeDialog() {
  void dialogLoaders.employee()
}

export function preloadIncidentDialog() {
  void dialogLoaders.incident()
}

export function preloadRiskDialog() {
  void dialogLoaders.risk()
}

export function preloadTrainingDialog() {
  void dialogLoaders.training()
}

export function preloadDocumentDialog() {
  void dialogLoaders.document()
}

export function preloadSgsstAuditDialog() {
  void dialogLoaders.sgsstAudit()
}

export function preloadSgsstEvaluationDialog() {
  void dialogLoaders.sgsstEvaluation()
}

export function preloadIndicatorDialog() {
  void dialogLoaders.indicator()
}

export function preloadAnnualWorkPlanDialog() {
  void dialogLoaders.annualWorkPlan()
}

export function preloadPlannedInspectionDialog() {
  void dialogLoaders.plannedInspection()
}

export function preloadUnplannedInspectionDialog() {
  void dialogLoaders.unplannedInspection()
}

export function preloadUnsafeReportDialog() {
  void dialogLoaders.unsafeReport()
}

export function preloadPpeDialogs() {
  void dialogLoaders.ppeDialogs()
}

export function preloadUserDialog() {
  void dialogLoaders.user()
}
