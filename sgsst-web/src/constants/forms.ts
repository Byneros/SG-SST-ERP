import type {
  CompanyFormValues,
  DashboardSummary,
  DocumentFormValues,
  EmployeeFormValues,
  PageMeta,
  TableState,
  UserFormValues,
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
}
