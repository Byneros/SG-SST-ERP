// Escenario de prueba: empresa + admin + sede + empleados + incidencias.
// La empresa y el admin se crean con Prisma (defaults correctos); el resto via API
// autenticada como el nuevo admin, validando scope y aislamiento multi-tenant.
// Idempotente: una segunda corrida reutiliza la empresa/admin y los datos demo
// existentes (chequeo previo por email y nombre) en lugar de fallar con P2002
// y dejar una empresa huerfana.
import bcrypt from 'bcrypt'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const API = 'http://localhost:3002/api/v1'
const STAMP = String(Date.now()).slice(-6)
const ADMIN_EMAIL = 'admin@elroble.com'
const COMPANY_NAME = 'Constructora El Roble S.A.S.'

async function api(method, path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* vacio */ }
  return { status: res.status, json }
}

function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' :: ' + detail : ''}`)
  if (!ok) process.exitCode = 1
}

// 1) Control: login del admin del seed.
const seedLogin = await api('POST', '/auth/login', { email: 'admin@sgsst.com', password: 'Admin12345' })
check('login seed admin (control)', seedLogin.status === 201, `status=${seedLogin.status}`)

// 2) Empresa + admin de la empresa (Prisma; POST /companies exige SUPER_ADMIN, ausente del seed).
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL ?? '' }),
})
let companyId
const existingAdmin = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } })
if (existingAdmin?.companyId) {
  companyId = existingAdmin.companyId
  check('empresa+admin ya existen (reutilizados)', true, `companyId=${companyId}`)
} else {
  if (existingAdmin) {
    console.error(`FAIL usuario ${ADMIN_EMAIL} existe sin companyId; estado inconsistente: revisar BD manualmente.`)
    process.exit(1)
  }
  // Empresa huerfana de una corrida abortada: reutilizarla en lugar de duplicar.
  const existingCompany = await prisma.company.findFirst({ where: { name: COMPANY_NAME } })
  if (existingCompany) {
    companyId = existingCompany.id
    check('empresa huerfana reutilizada (le falta el admin)', true, `companyId=${companyId}`)
  } else {
    const company = await prisma.company.create({
      data: {
        name: COMPANY_NAME, nit: `901${STAMP}-4`,
        riskClass: 'CLASS_IV', economicActivity: 'Construccion de edificaciones residenciales',
        city: 'Bucaramanga', department: 'Santander', address: 'Calle 45 # 12-30',
        phone: '+57 607 555 0143', email: 'contacto@elroble.com', arl: 'POSITIVA',
      },
    })
    companyId = company.id
    check('empresa creada', Boolean(companyId), `id=${companyId}`)
  }
  const passwordHash = bcrypt.hashSync('RobleAdmin2026*', 12)
  const admin = await prisma.user.create({
    data: {
      name: 'Ana Gutierrez', email: ADMIN_EMAIL, password: passwordHash,
      role: 'ADMIN', companyId,
    },
  })
  check('usuario ADMIN creado', Boolean(admin.id), 'email=admin@elroble.com clave=RobleAdmin2026*')
}
await prisma.$disconnect()

// 3) Login del nuevo admin (su token queda scoped a su empresa).
const adminLogin = await api('POST', '/auth/login', { email: 'admin@elroble.com', password: 'RobleAdmin2026*' })
check('login nuevo admin', adminLogin.status === 201, `status=${adminLogin.status}`)
const adminToken = adminLogin.json?.accessToken ?? adminLogin.json?.token

// 4) Sede principal (reutilizada si ya existe para la empresa).
let site = null
const sitesResponse = await api('GET', '/sites?page=1&pageSize=50', undefined, adminToken)
site = (sitesResponse.json?.data ?? []).find((s) => s.companyId === companyId && s.name === 'Obra Ciudadela') ?? null
if (site) {
  check('sede ya existe (reutilizada)', true, `id=${site.id}`)
} else {
  const created = await api('POST', '/sites', {
    name: 'Obra Ciudadela', code: `OB-${STAMP}`, address: 'Via Giron km 4',
    city: 'Bucaramanga', department: 'Santander', isMain: true, companyId,
  }, adminToken)
  check('sede creada', created.status === 201, `status=${created.status} ${JSON.stringify(created.json).slice(0, 140)}`)
  site = created.json
}
const siteId = site?.id

// 5) Empleados (reutilizados por nombre si ya existen en la empresa).
const employees = [
  { firstName: 'Carlos', lastName: 'Martinez', position: 'Oficial de obra' },
  { firstName: 'Luisa', lastName: 'Fernandez', position: 'Auxiliar administrativa' },
  { firstName: 'Jorge', lastName: 'Ramirez', position: 'Operador de retroexcavadora' },
]
const employeeIds = []
// Listado completo una sola vez: el match es del lado del cliente porque el
// buscador del backend no cubre firstName+lastName combinados.
const employeesList = (await api('GET', '/employees?page=1&pageSize=100', undefined, adminToken)).json?.data ?? []
for (const [index, employee] of employees.entries()) {
  const match = employeesList.find((e) => e.companyId === companyId && e.firstName === employee.firstName && e.lastName === employee.lastName)
  if (match) {
    employeeIds.push(match.id)
    check(`empleado ${employee.firstName} ya existe (reutilizado)`, true, `id=${match.id}`)
    continue
  }
  const created = await api('POST', '/employees', {
    ...employee, document: `10${STAMP}${index}`, documentType: 'CC', companyId, siteId,
    contractType: 'INDEFINITE', employmentStatus: 'ACTIVE', hireDate: '2025-02-01',
  }, adminToken)
  check(`empleado ${employee.firstName} creado`, created.status === 201, `status=${created.status}`)
  employeeIds.push(created.json?.id)
}

// 6) Incidencias: una con sede asociada y otra sin sede (reutilizadas por titulo).
const incidentsSpec = [
  {
    title: 'Caida de andamio en nivel 2',
    description: 'Andamio sin barandal superior cedio durante instalacion de ventaneria; sin lesionados, se detiene la actividad y se reporta al SST.',
    date: '2026-09-28', withSite: true,
  },
  {
    title: 'Corte menor con herramienta manual',
    description: 'Superficie abrasiva rota provoco corte superficial en antebrazo; se atendio en botiquin y se sustituyo la herramienta.',
    date: '2026-09-25', withSite: false,
  },
]
const incidentIds = []
for (const spec of incidentsSpec) {
  const listResponse = await api('GET', `/incidents?page=1&pageSize=50&search=${encodeURIComponent(spec.title)}`, undefined, adminToken)
  const match = (listResponse.json?.data ?? []).find((i) => i.companyId === companyId && i.title === spec.title)
  if (match) {
    incidentIds.push(match.id)
    check(`incidencia "${spec.title.slice(0, 24)}..." ya existe (reutilizada)`, true, `id=${match.id}`)
    continue
  }
  const created = await api('POST', '/incidents', {
    title: spec.title, description: spec.description, date: spec.date, companyId,
    ...(spec.withSite ? { siteId } : {}),
  }, adminToken)
  check(`incidencia "${spec.title.slice(0, 24)}..." creada`, created.status === 201, `status=${created.status} ${JSON.stringify(created.json).slice(0, 140)}`)
  incidentIds.push(created.json?.id)
}

// 7) Aislamiento multi-tenant: el admin del seed NO ve los datos de la nueva empresa.
const seedToken = seedLogin.json?.accessToken ?? seedLogin.json?.token
const crossList = await api('GET', '/incidents?page=1&pageSize=50', undefined, seedToken)
const leak = (crossList.json?.data ?? []).some((incident) => incident.companyId === companyId)
check('aislamiento multi-tenant (seed no ve datos nuevos)', !leak, `leak=${leak}`)

// 8) El nuevo admin SI ve sus 2 incidencias.
const ownList = await api('GET', '/incidents?page=1&pageSize=50', undefined, adminToken)
const ownCount = (ownList.json?.data ?? []).length
check('nuevo admin ve sus incidencias', ownCount === 2, `count=${ownCount}`)

console.log('\nCREDENCIALES DE PRUEBA:')
console.log('  admin@elroble.com / RobleAdmin2026* (rol ADMIN, Constructora El Roble S.A.S.)')
console.log(`  companyId=${companyId} siteId=${siteId}`)
console.log(`  empleados=${employeeIds.filter(Boolean).length} incidencias=${incidentIds.filter(Boolean).length}`)
