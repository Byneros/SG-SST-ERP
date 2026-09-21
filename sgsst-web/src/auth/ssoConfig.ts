export type SsoConfigValues = {
  issuer: string
  clientId: string
  clientSecret: string
  authorizationEndpoint: string
  tokenEndpoint: string
  jwksUri: string
  userinfoEndpoint: string
  scopes: string
  defaultRole: 'EMPLOYEE' | 'SST' | 'AUDITOR' | 'ADMIN'
  isActive: boolean
}
