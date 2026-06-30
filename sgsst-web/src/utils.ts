import type { ExternalDeliveryFilters, Paginated, ReportExportFilters, TableState } from './types'

export function tableParams(state: TableState) {
  return {
    page: state.page,
    pageSize: state.pageSize,
    search: state.search || undefined,
    isActive:
      state.isActive === 'all' ? undefined : state.isActive === 'active' ? true : false,
  }
}

export function reportExportParams(state: TableState, filters: ReportExportFilters) {
  return {
    page: state.page,
    pageSize: state.pageSize,
    search: state.search || undefined,
    status: filters.status === 'all' ? undefined : filters.status,
    companyId: filters.companyId || undefined,
    requestedById: filters.requestedById || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
  }
}

export function externalDeliveryParams(state: TableState, filters: ExternalDeliveryFilters) {
  return {
    page: state.page,
    pageSize: state.pageSize,
    search: state.search || undefined,
    provider: filters.provider === 'all' ? undefined : filters.provider,
    status: filters.status === 'all' ? undefined : filters.status,
    companyId: filters.companyId || undefined,
  }
}

export function isPaginated<T>(value: unknown): value is Paginated<T> {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'data' in value &&
      'meta' in value &&
      Array.isArray((value as Paginated<T>).data),
  )
}

export function sanitize<T extends Record<string, string | boolean>>(values: T) {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      typeof value === 'string' ? value.trim() || undefined : value,
    ]),
  )
}

export function initials(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}
