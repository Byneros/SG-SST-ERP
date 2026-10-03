// S3.1 — Prueba integral multiempresa (Issue #6). Transcribe el runbook
// docs/runbook-s3-1-prueba-multiempresa.md (P1–P4) contra la API dev.
// Uso: docker exec -w /app sgsst_api node s31-isolation-check.mjs
const API = 'http://localhost:3002/api/v1'

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

// Algunos listados devuelven { data: [...] } y otros un array plano (inconsistencia
// menor de la API detectada en esta corrida). Normalizar:
const rows = (j) => (Array.isArray(j) ? j : (j?.data ?? []))

// Logins de ambas empresas (A = seed, B = El Roble).
const loginA = await api('POST', '/auth/login', { email: 'admin@sgsst.com', password: 'Admin12345' })
check('login admin empresa A (seed)', loginA.status === 201, `status=${loginA.status}`)
const tokenA = loginA.json?.accessToken ?? loginA.json?.token

const loginB = await api('POST', '/auth/login', { email: 'admin@elroble.com', password: 'RobleAdmin2026*' })
check('login admin empresa B (El Roble)', loginB.status === 201, `status=${loginB.status}`)
const tokenB = loginB.json?.accessToken ?? loginB.json?.token

// Recursos de B y de A.
const empsB = await api('GET', '/employees?page=1&pageSize=50', undefined, tokenB)
const empB = rows(empsB.json)[0]
const sitesB = await api('GET', '/sites?page=1&pageSize=50', undefined, tokenB)
const siteB = rows(sitesB.json)[0]
const incsB = await api('GET', '/incidents?page=1&pageSize=50', undefined, tokenB)
const incB = rows(incsB.json)[0]
check('datos de B disponibles (sede, empleado, incidencia)', Boolean(empB && siteB && incB))

const empsA = await api('GET', '/employees?page=1&pageSize=50', undefined, tokenA)
const empA = rows(empsA.json).find((e) => e.companyId !== empB?.companyId)
check('datos de A disponibles (empleado)', Boolean(empA))
const companyB = empB?.companyId

// P1 — Usuario A no puede consultar empleados de B.
check('P1 GET /employees/{id de B} como A -> 404', (await api('GET', `/employees/${empB.id}`, undefined, tokenA)).status === 404)
const p1List = await api('GET', `/employees?companyId=${companyB}`, undefined, tokenA)
check('P1 GET /employees?companyId={B} como A -> 403/404', p1List.status === 403 || p1List.status === 404, `status=${p1List.status}`)
// Direccion inversa: B no consulta empleados de A.
check('P1+ GET /employees/{id de A} como B -> 404', (await api('GET', `/employees/${empA.id}`, undefined, tokenB)).status === 404)

// P2 — Usuario A no puede consultar ni modificar sedes de B.
check('P2 GET /sites/{sede de B} como A -> 404', (await api('GET', `/sites/${siteB.id}`, undefined, tokenA)).status === 404)
check('P2 PATCH /sites/{sede de B} como A -> 404', (await api('PATCH', `/sites/${siteB.id}`, { name: 'intruso' }, tokenA)).status === 404)

// P3 — Usuario A no puede modificar registros de B.
check('P3 PATCH /incidents/{id de B} como A -> 404', (await api('PATCH', `/incidents/${incB.id}`, { title: 'intrusion-test' }, tokenA)).status === 404)

// P4 — companyId manipulado no evade el scope.
const p4Post = await api('POST', '/incidents', {
  title: 'intrusion-test', description: 'intento con companyId ajeno', date: '2026-10-01', companyId: companyB,
}, tokenA)
check('P4 POST /incidents con companyId de B como A -> 403/404', p4Post.status === 403 || p4Post.status === 404, `status=${p4Post.status}`)
const p4Get = await api('GET', `/incidents?companyId=${companyB}`, undefined, tokenA)
check('P4 GET /incidents?companyId={B} como A -> 403/404', p4Get.status === 403 || p4Get.status === 404, `status=${p4Get.status}`)

// Sin fugas en listados: A no ve nada de B.
const listA = await api('GET', '/incidents?page=1&pageSize=100', undefined, tokenA)
const leak = rows(listA.json).some((i) => i.companyId === companyB)
check('aislamiento en listado: A no ve incidencias de B', !leak, `leak=${leak}`)

// B intacto tras los intentos de intrusión.
const incsBAfter = await api('GET', '/incidents?page=1&pageSize=50', undefined, tokenB)
const intact = rows(incsBAfter.json).some((i) => i.id === incB.id && i.title === incB.title)
check('registro de B intacto tras los intentos', intact)
const empsBAfter = await api('GET', `/employees/${empB.id}`, undefined, tokenB)
check('empleado de B intacto tras los intentos', empsBAfter.status === 200 && empsBAfter.json?.position === empB.position)

console.log(`\nempresaA=${loginA.json?.companyId ?? 'n/a'} empresaB=${companyB}`)
