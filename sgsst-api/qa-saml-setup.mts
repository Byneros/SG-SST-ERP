import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { createHash, randomBytes, createCipheriv } from 'crypto';
import { readFileSync } from 'fs';

const JWT_SECRET = (readFileSync('.env', 'utf8').match(/JWT_SECRET=(.+)/)?.[1] ?? 'dev-only-change-me').trim();
const key = () => createHash('sha256').update(JWT_SECRET).digest();
function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv.toString('base64'), encrypted.toString('base64'), cipher.getAuthTag().toString('base64')].join(':');
}

// Cert del IdP simulador (auto-firmado por SAMLify)
function selfSign(): string {
  // SAMLify genera el cert al vuelo; para el simulador usamos el que expone en /metadata
  return '';
}

const p = new PrismaClient({ adapter: new PrismaPg({ connectionString: 'postgresql://postgres:postgres@localhost:5433/sgsst' }) });

const companyId = '1472d34f-ba55-4fb9-8491-473b11f7e59d';
const idpEntityId = 'urn:sgsst:mock-idp';
const idpSsoUrl = 'http://127.0.0.1:3600/sso';
const cert = process.argv[2] ?? '';

const data = {
  protocol: 'SAML',
  issuer: '',
  clientId: '',
  clientSecret: encryptSecret('-'),
  authorizationEndpoint: '',
  tokenEndpoint: '',
  jwksUri: null,
  userinfoEndpoint: null,
  scopes: '',
  idpMetadata: null,
  idpEntityId,
  idpSsoUrl,
  idpCertificate: cert || null,
  spEntityId: null,
  defaultRole: 'EMPLOYEE',
  roleGroups: { 'SG-SST-Admins': 'ADMIN' } as object | null,
  isActive: true,
};

const existing = await p.ssoProvider.findUnique({ where: { companyId } });
if (existing) {
  await p.ssoProvider.update({ where: { id: existing.id }, data });
  console.log('UPDATED provider for company', companyId);
} else {
  await p.ssoProvider.create({ data: { ...data, companyId } });
  console.log('CREATED provider for company', companyId);
}
await p.$disconnect();
