import axios from 'axios'
import type { AuthUser } from '../types'

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

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(tokenKey)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const originalRequest = error.config
      const refreshToken = localStorage.getItem(refreshTokenKey)
      if (refreshToken && originalRequest && !originalRequest.headers?.['x-retry-refresh']) {
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
          originalRequest.headers.Authorization = `Bearer ${accessToken}`
          originalRequest.headers['x-retry-refresh'] = 'true'
          return api(originalRequest)
        } catch {
          clearSession()
          unauthorizedHandler?.()
        }
      } else {
        clearSession()
        unauthorizedHandler?.()
      }
    }
    return Promise.reject(error)
  },
)
