import axios, { AxiosHeaders } from 'axios'
import type { AuthUser } from '../types'

export type ReportKind =
  | 'employees'
  | 'expired-documents'
  | 'audits'
  | 'summary'
  | 'annual-plan'
  | 'surveillance'
export type ReportFormat = 'csv' | 'pdf'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api/v1',
})

const tokenKey = 'sgsst_token'
const refreshTokenKey = 'sgsst_refresh_token'
const userKey = 'sgsst_user'
let unauthorizedHandler: (() => void) | undefined
let refreshPromise: Promise<string> | undefined

export function getStoredSession() {
  const token = localStorage.getItem(tokenKey) ?? ''
  const refreshToken = localStorage.getItem(refreshTokenKey) ?? ''
  const storedUser = localStorage.getItem(userKey)
  const user = storedUser ? (JSON.parse(storedUser) as AuthUser) : null
  return { token, refreshToken, user }
}

export function saveSession(token: string, user: AuthUser, refreshToken?: string) {
  localStorage.setItem(tokenKey, token)
  if (refreshToken) {
    localStorage.setItem(refreshTokenKey, refreshToken)
  }
  localStorage.setItem(userKey, JSON.stringify(user))
  api.defaults.headers.common.Authorization = `Bearer ${token}`
}

export function clearSession() {
  localStorage.removeItem(tokenKey)
  localStorage.removeItem(refreshTokenKey)
  localStorage.removeItem(userKey)
  delete api.defaults.headers.common.Authorization
}

export function setUnauthorizedHandler(handler: () => void) {
  unauthorizedHandler = handler
}

export function readApiError(error: unknown) {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message
    return Array.isArray(message) ? message.join(', ') : message || error.message
  }
  return 'Ocurrio un error inesperado'
}

export async function downloadReport(kind: ReportKind, format: ReportFormat, companyId?: string) {
  const response = await api.get(`/reports/${kind}.${format}`, {
    params: companyId ? { companyId } : undefined,
    responseType: 'blob',
  })
  const blob = new Blob([response.data], {
    type: format === 'pdf' ? 'application/pdf' : 'text/csv;charset=utf-8',
  })
  const href = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = href
  link.download = `${kind}.${format}`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(href)
}

export async function downloadDocument(documentId: string, fileName = 'documento') {
  const response = await api.get(`/documents/${documentId}/download`, {
    responseType: 'blob',
  })
  const blob = new Blob([response.data], {
    type: String(response.headers['content-type'] ?? 'application/octet-stream'),
  })
  const href = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = href
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(href)
}

export async function downloadReportExport(exportId: string, fileName = 'reporte') {
  const response = await api.get(`/reports/exports/${exportId}/download`, {
    responseType: 'blob',
  })
  const blob = new Blob([response.data], {
    type: String(response.headers['content-type'] ?? 'application/octet-stream'),
  })
  const href = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = href
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(href)
}

export async function scheduleReport(kind: ReportKind, format: ReportFormat, companyId?: string) {
  const response = await api.post(`/reports/${kind}.${format}/schedule`, undefined, {
    params: companyId ? { companyId } : undefined,
  })
  return response.data as { success: boolean; queued: boolean; jobId?: string; fileUrl?: string }
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(tokenKey)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

function asAxiosHeaders(raw: unknown): AxiosHeaders {
  const headers = new AxiosHeaders()
  if (raw && typeof raw === 'object') {
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (value !== undefined && value !== null) {
        headers.set(key, String(value))
      }
    }
  }
  return headers
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const originalRequest = error.config
      const refreshToken = localStorage.getItem(refreshTokenKey)
      const headers = originalRequest ? asAxiosHeaders(originalRequest.headers) : new AxiosHeaders()
      const alreadyRetried = headers?.get('x-retry-refresh') === 'true'
      if (refreshToken && originalRequest && !alreadyRetried) {
        try {
          refreshPromise =
            refreshPromise ??
            api
              .post('/auth/refresh', { refreshToken }, { headers: { 'x-retry-refresh': 'true' } })
              .then((response) => {
                saveSession(response.data.accessToken, response.data.user, response.data.refreshToken)
                return response.data.accessToken as string
              })
              .finally(() => {
                refreshPromise = undefined
              })
          const accessToken = await refreshPromise
          headers.set('Authorization', `Bearer ${accessToken}`)
          headers.set('x-retry-refresh', 'true')
          originalRequest.headers = headers
          return api(originalRequest)
        } catch {
          // Only the request that observes the settled failed refresh clears the
          // session, so concurrent 401s don't fire the handler multiple times.
          if (!refreshPromise) {
            clearSession()
            unauthorizedHandler?.()
          }
        }
      } else {
        clearSession()
        unauthorizedHandler?.()
      }
    }
    return Promise.reject(error)
  },
)
