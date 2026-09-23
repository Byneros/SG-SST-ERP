/**
 * Siembra el provider SAML de QA para la empresa indicada (Fase 9.4).
 *
 * Descarga la metadata del IdP mock (qa-saml-idp.mts, puerto 3600), extrae
 * cert + URL SSO con el mismo parser que usa la API (saml-metadata.ts) y
 * guarda/actualiza el SsoProvider con roleGroups de ejemplo.
 *
 * Uso:
 *   node -e "console.log('companyId?')"  # ver COMPANY_ID abajo
 *   npx tsx qa-saml-setup.mts <companyId>
 *
 * El companyId por defecto es la primera empresa activa de la BD local.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { createHash, randomBytes, createCipheriv } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseIdpMetadata } from './src/modules/sso/saml/saml-metadata.js';

const JWT_SECRET = (readFileSync('.env', 'utf8').match(/JWT_SECRET=(.+)/)?.[1] ?? 'dev-only-change-me').trim();
const key = () => createHash('sha256').update(JWT_SECRET).digest();
function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv.toString('base64'), encrypted.toString('base64'), cipher.getAuthTag().toString('base64')].join(':');
}

const IDP_METADATA_URL = 'http://127.0.0.1:3600/metadata';

const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: 'postgresql://postgres:postgres@localhost:5433/sgsst' }) });

async function main() {
  let companyId = process.argv[2];
  if (!companyId) {
    const company = await p.company.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' } });
    if (!company) throw new Error('No hay empresas en la BD. Pasa un companyId como argumento.');
    companyId = company.id;
    console.log('Usando la primera empresa activa:', company.name, `(${company.id})`);
  } else {
    const company = await p.company.findUnique({ where: { id: companyId } });
    if (!company) throw new Error(`Empresa ${companyId} no encontrada`);
    console.log('Empresa destino:', company.name, `(${company.id})`);
  }

  // Descargar metadata del IdP mock y extraer cert + SSO URL (mismo parser que la API).
  const response = await fetch(IDP_METADATA_URL);
  if (!response.ok) throw new Error(`IdP mock no disponible en ${IDP_METADATA_URL} (levanta qa-saml-idp.mts)`);
  const xml = await response.text();
  const parsed = parseIdpMetadata(xml);
  if (!parsed) throw new Error('No fue posible extraer cert/SSO URL de la metadata del IdP mock');
  console.log('IdP mock OK. SSO URL:', parsed.ssoUrl);

  const data = {
    protocol: 'SAML' as const,
    issuer: '',
    clientId: '',
    clientSecret: encryptSecret('-'),
    authorizationEndpoint: '',
    tokenEndpoint: '',
    jwksUri: null,
    userinfoEndpoint: null,
    scopes: '',
    idpMetadata: null,
    idpEntityId: 'urn:sgsst:mock-idp',
    idpSsoUrl: parsed.ssoUrl,
    idpCertificate: parsed.certificate,
    spEntityId: null,
    defaultRole: 'EMPLOYEE' as const,
    roleGroups: { 'SG-SST-Admins': 'ADMIN', 'SST-Team': 'SST', Auditores: 'AUDITOR' },
    isActive: true,
  };

  const existing = await p.ssoProvider.findUnique({ where: { companyId } });
  if (existing) {
    await p.ssoProvider.update({ where: { id: existing.id }, data });
    console.log('UPDATED provider para', companyId);
  } else {
    await p.ssoProvider.create({ data: { ...data, companyId } });
    console.log('CREATED provider para', companyId);
  }
  console.log('roleGroups sembrado:', JSON.stringify(data.roleGroups));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => p.$disconnect());
