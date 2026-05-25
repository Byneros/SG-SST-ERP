import { lazy } from 'react'
import type { View } from '../types'

const pageLoaders = {
  dashboard: () => import('../pages/dashboard/DashboardPage'),
  companies: () => import('../pages/companies/CompaniesPage'),
  employees: () => import('../pages/employees/EmployeesPage'),
  documents: () => import('../pages/documents/DocumentsPage'),
  users: () => import('../pages/users/UsersPage'),
  audit: () => import('../pages/audit/AuditPage'),
}

const dialogLoaders = {
  company: () => import('../pages/companies/CompanyDialog'),
  employee: () => import('../pages/employees/EmployeeDialog'),
  document: () => import('../pages/documents/DocumentDialog'),
  user: () => import('../pages/users/UserDialog'),
}

export const DashboardPage = lazy(() =>
  pageLoaders.dashboard().then((module) => ({ default: module.DashboardPage })),
)
export const CompaniesPage = lazy(() =>
  pageLoaders.companies().then((module) => ({ default: module.CompaniesPage })),
)
export const EmployeesPage = lazy(() =>
  pageLoaders.employees().then((module) => ({ default: module.EmployeesPage })),
)
export const DocumentsPage = lazy(() =>
  pageLoaders.documents().then((module) => ({ default: module.DocumentsPage })),
)
export const UsersPage = lazy(() =>
  pageLoaders.users().then((module) => ({ default: module.UsersPage })),
)
export const AuditPage = lazy(() =>
  pageLoaders.audit().then((module) => ({ default: module.AuditPage })),
)

export const CompanyDialog = lazy(() =>
  dialogLoaders.company().then((module) => ({ default: module.CompanyDialog })),
)
export const EmployeeDialog = lazy(() =>
  dialogLoaders.employee().then((module) => ({ default: module.EmployeeDialog })),
)
export const DocumentDialog = lazy(() =>
  dialogLoaders.document().then((module) => ({ default: module.DocumentDialog })),
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

export function preloadEmployeeDialog() {
  void dialogLoaders.employee()
}

export function preloadDocumentDialog() {
  void dialogLoaders.document()
}

export function preloadUserDialog() {
  void dialogLoaders.user()
}
