export type Role = 'ADMIN' | 'SST' | 'EMPLOYEE' | 'AUDITOR'
export type View = 'dashboard' | 'companies' | 'employees' | 'documents' | 'users' | 'audit'
export type CompanyRiskClass = 'CLASS_I' | 'CLASS_II' | 'CLASS_III' | 'CLASS_IV' | 'CLASS_V'
export type DocumentType = 'CC' | 'CE' | 'TI' | 'PASSPORT' | 'NIT'
export type ContractType = 'INDEFINITE' | 'FIXED_TERM' | 'SERVICE' | 'APPRENTICESHIP' | 'TEMPORARY'
export type EmploymentStatus = 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE' | 'RETIRED'
export type DocumentCategory =
  | 'POLICY'
  | 'PROCEDURE'
  | 'CERTIFICATE'
  | 'TRAINING_EVIDENCE'
  | 'INCIDENT_EVIDENCE'
  | 'AUDIT_EVIDENCE'
  | 'MEDICAL'
  | 'OTHER'
export type DocumentStatus = 'DRAFT' | 'PUBLISHED' | 'EXPIRED' | 'ARCHIVED'

export type AuthUser = {
  id: string
  name: string
  email: string
  role: Role
  companyId?: string
}

export type Company = {
  id: string
  name: string
  nit: string
  arl?: string
  riskClass: CompanyRiskClass
  economicActivity?: string
  city?: string
  department?: string
  address?: string
  phone?: string
  email?: string
  isActive: boolean
  deletedAt?: string
}

export type Employee = {
  id: string
  firstName: string
  lastName: string
  documentType: DocumentType
  document: string
  position: string
  workCenter?: string
  contractType: ContractType
  employmentStatus: EmploymentStatus
  hireDate?: string
  email?: string
  phone?: string
  companyId: string
  isActive: boolean
  deletedAt?: string
  company?: Pick<Company, 'id' | 'name' | 'nit'>
}

export type SystemUser = {
  id: string
  name: string
  email: string
  role: Role
  isActive: boolean
  deletedAt?: string
  companyId?: string
  company?: Pick<Company, 'id' | 'name' | 'nit'>
}

export type SgsstDocumentVersion = {
  id: string
  version: number
  fileUrl: string
  fileName?: string
  mimeType?: string
  notes?: string
  createdAt: string
}

export type SgsstDocument = {
  id: string
  name: string
  description?: string
  category: DocumentCategory
  status: DocumentStatus
  fileUrl: string
  fileName?: string
  mimeType?: string
  version: number
  expiresAt?: string
  companyId: string
  isActive: boolean
  deletedAt?: string
  company?: Pick<Company, 'id' | 'name' | 'nit'>
  versions?: SgsstDocumentVersion[]
}

export type AuditLog = {
  id: string
  action: string
  entity: string
  entityId?: string
  createdAt: string
  actor?: Pick<SystemUser, 'id' | 'name' | 'email' | 'role'>
}

export type AppNotification = {
  id: string
  title: string
  message: string
  type: 'INFO' | 'DOCUMENT_EXPIRING' | 'TRAINING_OVERDUE' | 'INCIDENT_OPEN' | 'TASK'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  entity?: string
  entityId?: string
  read: boolean
  readAt?: string
  createdAt: string
}

export type PageMeta = {
  page: number
  pageSize: number
  total: number
  totalPages: number
  unread?: number
}

export type Paginated<T> = {
  data: T[]
  meta: PageMeta
}

export type TableState = {
  page: number
  pageSize: number
  search: string
  isActive: 'all' | 'active' | 'inactive'
}

export type DashboardSummary = {
  companiesCount: number
  employeesCount: number
  usersCount: number
  documentsCount: number
  criticalRisks: number
  openIncidents: number
  overdueTrainings: number
  upcomingTrainings: number
  inactiveCompanies: number
  inactiveEmployees: number
  inactiveUsers: number
  activeRate: number
}

export type CompanyFormValues = {
  name: string
  nit: string
  arl: string
  riskClass: CompanyRiskClass
  economicActivity: string
  city: string
  department: string
  address: string
  phone: string
  email: string
}

export type EmployeeFormValues = {
  firstName: string
  lastName: string
  documentType: DocumentType
  document: string
  position: string
  workCenter: string
  contractType: ContractType
  employmentStatus: EmploymentStatus
  hireDate: string
  email: string
  phone: string
  companyId: string
}

export type UserFormValues = {
  name: string
  email: string
  password: string
  role: Role
  companyId: string
}

export type DocumentFormValues = {
  name: string
  description: string
  category: DocumentCategory
  status: DocumentStatus
  fileUrl: string
  fileName: string
  mimeType: string
  expiresAt: string
  companyId: string
}
