import type { Paginated, TableState } from './types'

export function tableParams(state: TableState) {
  return {
    page: state.page,
    pageSize: state.pageSize,
    search: state.search || undefined,
    isActive:
      state.isActive === 'all' ? undefined : state.isActive === 'active' ? true : false,
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

export function sanitize<T extends Record<string, string>>(values: T) {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, value.trim() || undefined]),
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
