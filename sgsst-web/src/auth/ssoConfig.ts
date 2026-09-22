export type SsoProtocol = 'OIDC' | 'SAML'

export type SsoConfigValues = {
  protocol: SsoProtocol
  issuer: string
  clientId: string
  clientSecret: string
  authorizationEndpoint: string
  tokenEndpoint: string
  jwksUri: string
  userinfoEndpoint: string
  scopes: string
  idpEntityId: string
  idpSsoUrl: string
  idpCertificate: string
  spEntityId: string
  defaultRole: 'EMPLOYEE' | 'SST' | 'AUDITOR' | 'ADMIN'
  /** Mapeo grupo del IdP -> rol, como texto JSON (vacio = sin overrides). */
  roleGroups: string
  isActive: boolean
}
