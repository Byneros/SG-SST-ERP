// S3.2 — Flujo empresa → sede → empleado → usuario (Issue #7).
// Ejecuta el recorrido completo via API como ADMIN de la empresa B y verifica
// que el usuario creado solo accede a su empresa.
// Uso: docker exec -w /app sgsst_api node s32-flow-check.mjs
const API = 'http://localhost:3002/api/v1'
const STAMP = String(Date.now()).slice(-6)

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

const rows = (j) => (Array.isArray(j) ? j : (j?.data ?? []))

function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' :: ' + detail : ''}`)
  if (!ok) process.exitCode = 1
}

// 0) Contexto: empresa B (El Roble) ya provisionada con sede principal y empleados.
const loginB = await api('POST', '/auth/login', { email: 'admin@elroble.com', password: 'RobleAdmin2026*' })
check('0. login ADMIN empresa B', loginB.status === 201, `status=${loginB.status}`)
const adminToken = loginB.json?.accessToken ?? loginB.json?.token
const companyIdB = (rows((await api('GET', '/sites', undefined, adminToken)).json))[0]?.companyId
check('0. companyId de B resuelto del token/contexto', Boolean(companyIdB), companyIdB ?? '')

// 1) Crear sede asociada (paso "crear una sede asociada" del flujo).
const site = await api('POST', '/sites', {
  name: 'Sede Norte', code: `SN-${STAMP}`, address: 'Km 7 via Pamplona',
  city: 'Bucaramanga', department: 'Santander', isMain: false, companyId: companyIdB,
}, adminToken)
check('1. sede creada para B', site.status === 201, `status=${site.status}`)
const siteId = site.json?.id

// 2) Registrar empleado asociado a la empresa y sede.
const emp = await api('POST', '/employees', {
  firstName: 'Marta', lastName: 'Suarez', document: `CC-10${STAMP}`, documentType: 'CC',
  position: 'Supervisora SST', companyId: companyIdB, siteId,
  contractType: 'INDEFINITE', employmentStatus: 'ACTIVE', hireDate: '2026-01-15',
}, adminToken)
check('2. empleado creado en B con sede', emp.status === 201, `status=${emp.status}`)
const employeeId = emp.json?.id

// 3) Crear usuario y asignarle rol (SST). El contrato exige companyId en el body;
//    solo se acepta el propio del actor (uno ajeno -> 403, ausente -> 400).
const email = `sst.${STAMP}@elroble.com`
const user = await api('POST', '/users', {
  name: 'Marta Suarez', email, password: 'SstRoble2026*', role: 'SST', companyId: companyIdB,
}, adminToken)
check('3. usuario creado con rol SST', user.status === 201, `status=${user.status} ${JSON.stringify(user.json).slice(0, 120)}`)
check('3. el usuario queda en la empresa de B (no en otra)', user.json?.companyId === companyIdB, `companyId=${user.json?.companyId}`)

// 4) Iniciar sesion con el usuario creado.
const newUserLogin = await api('POST', '/auth/login', { email, password: 'SstRoble2026*' })
check('4. login del usuario creado', newUserLogin.status === 201, `status=${newUserLogin.status}`)
const newToken = newUserLogin.json?.accessToken ?? newUserLogin.json?.token

// 5) Verificar que solo accede a su empresa.
const theirSites = rows((await api('GET', '/sites?page=1&pageSize=50', undefined, newToken)).json)
check('5a. solo ve sedes de su empresa', theirSites.length === 2 && theirSites.every((s) => s.companyId === companyIdB), `sites=${theirSites.length}`)

const theirEmps = rows((await api('GET', '/employees?page=1&pageSize=50', undefined, newToken)).json)
check('5b. ve los 4 empleados de su empresa', theirEmps.length === 4 && theirEmps.every((e) => e.companyId === companyIdB), `emps=${theirEmps.length}`)

// Control cruzado: la empresa A (seed) existe y tiene otros datos que el nuevo usuario no debe ver.
const tokenA = (await api('POST', '/auth/login', { email: 'admin@sgsst.com', password: 'Admin12345' })).json?.accessToken
const empAid = rows((await api('GET', '/employees?page=1&pageSize=50', undefined, tokenA)).json).find((e) => e.companyId !== companyIdB)?.id
const siteAid = rows((await api('GET', '/sites?page=1&pageSize=50', undefined, tokenA)).json).find((s) => s.companyId !== companyIdB)?.id

check('5c. no consulta empleado de otra empresa (404)', (await api('GET', `/employees/${empAid}`, undefined, newToken)).status === 404)
check('5d. no consulta sede de otra empresa (404)', (await api('GET', `/sites/${siteAid}`, undefined, newToken)).status === 404)
check('5e. companyId manipulado no evade el scope (403/404)', [403, 404].includes((await api('GET', `/employees?companyId=1472d34f-ba55-4fb9-8491-473b11f7e59d`, undefined, newToken)).status))

console.log(`\nempresaB=${companyIdB} sedeNueva=${siteId} empleado=${employeeId} usuario=${email}`)
