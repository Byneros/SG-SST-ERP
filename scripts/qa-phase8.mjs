// QA Fase 8: flujo completo de Evaluaciones Res. 0312 e Indicadores.
// Valida API (crear/editar/respond, metas/mediciones) y UI en navegador
// (dashboard con cumplimiento, tabla de evaluaciones e indicadores).
// Uso: node scripts/qa-phase8.mjs [WEB_URL]  (VITE_API_URL para la API)
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const BASE = process.argv[2] ?? 'http://localhost:5173'
const API = process.env.VITE_API_URL ?? 'http://localhost:3002/api/v1'
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), 'qa-artifacts')
mkdirSync(OUT_DIR, { recursive: true })

// Scope multi-tenant: los DTOs de creacion exigen companyId explicito.
const SCOPE = { companyId: '' }

const results = []
function record(name, ok, detail = '') {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
}

async function apiLogin() {
  const response = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@sgsst.com', password: 'Admin12345' }),
  })
  if (!response.ok) throw new Error(`login ${response.status}`)
  return response.json()
}

async function api(token, method, path, body) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await response.json().catch(() => null)
  return { status: response.status, data }
}

async function expectApi(token, method, path, body, name, assert) {
  const { status, data } = await api(token, method, path, body)
  try {
    const detail = assert?.(data)
    record(`${name} (${status})`, true, typeof detail === 'string' ? detail : '')
  } catch (error) {
    record(`${name} (${status})`, false, `${error.message} | body=${JSON.stringify(data).slice(0, 300)}`)
  }
}

// ------- Parte 1: flujos de API (evaluaciones e indicadores) -------
async function phase8ApiFlows() {
  const session = await apiLogin()
  const token = session.accessToken
  SCOPE.companyId = session.user?.companyId ?? session.user?.activeCompanyId ?? ''
  record('Login admin', Boolean(token), `companyId=${SCOPE.companyId ? 'ok' : 'missing'}`)

  // --- Evaluaciones ---
  const evalName = `QA-EVAL-${Date.now()}`
  let evaluationId = ''
  await expectApi(token, 'POST', '/sgsst-evaluations', {
    name: evalName,
    riskClass: 'IV',
    period: '2026',
    companyId: SCOPE.companyId,
    items: [
      { numeral: '1.1', section: 'Gestion', question: 'Politica SG-SST firmada y divulgada', maxScore: 10 },
      { numeral: '1.2', section: 'Gestion', question: 'Asignacion de responsabilidades SST', maxScore: 10 },
      { numeral: '2.1', section: 'Analisis', question: 'Matriz de peligros actualizada', maxScore: 10 },
    ],
  }, 'Crear evaluacion con 3 items', (data) => {
    evaluationId = data.id
    if (!evaluationId) throw new Error('sin id')
    if (data.items?.length !== 3) throw new Error(`items=${data.items?.length}`)
    return '3 items PENDING'
  })

  const itemsResponse = await api(token, 'GET', `/sgsst-evaluations/${evaluationId}`)
  const firstItem = itemsResponse.data?.items?.[0]
  record('GET evaluacion con items', Boolean(firstItem?.id), `item=${firstItem?.id ?? 'none'}`)

  // Responder item 1: conforme (10/10). El denominador son los items
  // respondidos (excluye PENDING y NOT_APPLICABLE).
  await expectApi(token, 'PATCH', `/sgsst-evaluations/items/${firstItem.id}`, {
    status: 'COMPLIANT',
    notes: 'QA: documento publicado',
  }, 'PATCH item COMPLIANT recalcula', (data) => {
    const item = data.items?.find((row) => row.id === firstItem.id)
    if (item?.status !== 'COMPLIANT') throw new Error('item no COMPLIANT')
    if (data.compliancePercent !== 100) throw new Error(`compliance=${data.compliancePercent}`)
    return 'compliance=100% (1 item respondido)'
  })

  // Item 2: parcial (5/10) → (10+5)/(10+10) = 75%.
  await expectApi(token, 'PATCH', `/sgsst-evaluations/items/${itemsResponse.data.items[1].id}`, {
    status: 'PARTIAL',
    score: 5,
  }, 'PATCH item PARTIAL score=5', (data) => {
    if (data.compliancePercent !== 75) throw new Error(`compliance=${data.compliancePercent}`)
    return 'compliance=75%'
  })

  // Item 3: no aplica — se excluye del denominador (mantiene 75%).
  await expectApi(token, 'PATCH', `/sgsst-evaluations/items/${itemsResponse.data.items[2].id}`, {
    status: 'NOT_APPLICABLE',
  }, 'PATCH item NOT_APPLICABLE excluye del denominador', (data) => {
    if (data.compliancePercent !== 75) throw new Error(`compliance=${data.compliancePercent}`)
    if (data.status !== 'COMPLETED') throw new Error(`status=${data.status}`)
    return 'compliance=75% y COMPLETED'
  })

  // Agregar un item nuevo vía endpoint Fase 7: la evaluación estaba COMPLETED
  // y con un item PENDING nuevo debe volver a IN_PROGRESS (recalcula).
  await expectApi(token, 'POST', `/sgsst-evaluations/${evaluationId}/items`, {
    items: [{ numeral: '3.1', section: 'Verificacion', question: 'Inspecciones planeadas ejecutadas', maxScore: 10 }],
  }, 'POST /items agrega item y recalcula estado', (data) => {
    if (data.items?.length !== 4) throw new Error(`items=${data.items?.length}`)
    if (data.status !== 'IN_PROGRESS') throw new Error(`status=${data.status}`)
    return '4 items, vuelve a IN_PROGRESS'
  })

  // --- Indicadores ---
  const indicatorName = `QA-IND-${Date.now()}`
  let indicatorId = ''
  await expectApi(token, 'POST', '/indicators', {
    name: indicatorName,
    code: `IF-QA-${Date.now() % 100000}`,
    unit: '%',
    formulaDefinition: '(accidentes / empleados) * 100',
    direction: 'LOWER_IS_BETTER',
    value: 0,
    companyId: SCOPE.companyId,
  }, 'Crear indicador', (data) => {
    indicatorId = data.id
    if (!indicatorId) throw new Error('sin id')
  })

  await expectApi(token, 'PUT', `/indicators/${indicatorId}/targets`, {
    targets: [
      { period: '2026-Q1', target: 2 },
      { period: '2026-Q2', target: 1.5 },
    ],
  }, 'PUT /targets define 2 metas', (data) => {
    if (data.length !== 2) throw new Error(`targets=${data.length}`)
    return 'Q1=2, Q2=1.5'
  })

  await expectApi(token, 'POST', `/indicators/${indicatorId}/measurements`, {
    measurements: [
      { period: '2026-Q1', value: 2.4, notes: 'QA sobre meta' },
    ],
  }, 'POST /measurements actualiza value vigente', (data) => {
    if (data.value !== 2.4) throw new Error(`value=${data.value}`)
    if (data.measurements?.length !== 1) throw new Error(`measurements=${data.measurements?.length}`)
    return 'value=2.4 (>meta 2 → fuera de meta)'
  })

  // Medición bajo meta → indicador cumple.
  await expectApi(token, 'POST', `/indicators/${indicatorId}/measurements`, {
    measurements: [{ period: '2026-Q2', value: 1.2 }],
  }, 'POST /measurements Q2 bajo meta', (data) => {
    if (data.value !== 1.2) throw new Error(`value=${data.value}`)
    return 'value=1.2 (<=meta 1.5 → cumple)'
  })

  // GET /indicators sin siteId (regresión del bug @IsOptional).
  await expectApi(token, 'GET', '/indicators?page=1&pageSize=5', undefined, 'GET /indicators sin siteId no da 400', (data) => {
    if (!Array.isArray(data.data)) throw new Error('sin data')
    return `${data.meta.total} indicadores`
  })

  // Dashboard con bloque de cumplimiento (Fase 7.4 consumida por el frontend).
  await expectApi(token, 'GET', '/dashboard/summary', undefined, 'Dashboard expone compliance', (data) => {
    const compliance = data.compliance
    if (!compliance) throw new Error('sin compliance')
    if (compliance.evaluationsCount < 1) throw new Error('evaluationsCount<1')
    if (compliance.evaluationsAvgCompliance === null) throw new Error('avg null')
    if (compliance.indicatorsOffTarget !== 0) throw new Error(`offTarget=${compliance.indicatorsOffTarget} (Q2=1.2<=1.5)`)
    return `evals=${compliance.evaluationsCount} avg=${compliance.evaluationsAvgCompliance}% offTarget=${compliance.indicatorsOffTarget}`
  })

  return { token, evaluationId, evalName, indicatorId, indicatorName }
}

// ------- Parte 2: flujos de UI en navegador -------
async function phase8UiFlows(context, { evalName, indicatorName }) {
  const page = await context.newPage()
  const consoleErrors = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  // Sesion inyectada en localStorage (mismo esquema que usa api/client.ts):
  // evita depender de los labels del formulario de login.
  const session = await apiLogin()
  await page.addInitScript(
    ([token, storedUser, refreshToken]) => {
      localStorage.setItem('sgsst_token', token)
      localStorage.setItem('sgsst_refresh_token', refreshToken ?? '')
      localStorage.setItem('sgsst_user', JSON.stringify(storedUser))
    },
    [session.accessToken, session.user, session.refreshToken],
  )

  // Dashboard: tarjetas de cumplimiento.
  await page.goto(`${BASE}/#/dashboard`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)

  // Dashboard: tarjetas de cumplimiento.
  const complianceCard = page.getByText('Cumplimiento 0312', { exact: false }).first()
  const offTargetCard = page.getByText('Indicadores fuera de meta', { exact: false }).first()
  const auditsCard = page.getByText('Auditorias pendientes', { exact: false }).first()
  const overdueCard = page.getByText('Acciones correctivas vencidas', { exact: false }).first()
  const cardsVisible = await Promise.all([
    complianceCard.isVisible().catch(() => false),
    offTargetCard.isVisible().catch(() => false),
    auditsCard.isVisible().catch(() => false),
    overdueCard.isVisible().catch(() => false),
  ])
  record('Dashboard: 4 tarjetas de cumplimiento visibles', cardsVisible.every(Boolean), cardsVisible.join(','))
  await page.screenshot({ path: `${OUT_DIR}/dashboard-compliance.png`, fullPage: true })

  // Vista Evaluaciones Res. 0312.
  await page.getByText('Evaluacion Res. 0312', { exact: true }).first().click()
  await page.waitForTimeout(1200)
  const evalRow = page.getByText(evalName).first()
  record('Evaluaciones: fila de la evaluacion QA visible', await evalRow.isVisible().catch(() => false))

  // Abrir dialogo por el icono editar de la fila.
  await evalRow.locator('xpath=ancestor::tr').getByRole('button').first().click()
  await page.waitForTimeout(1000)
  const dialogVisible = await page.getByText('Items de la evaluacion', { exact: false }).isVisible().catch(() => false)
  record('Dialogo evaluacion: bloque de items visible', dialogVisible)
  await page.screenshot({ path: `${OUT_DIR}/evaluacion-dialogo.png`, fullPage: true })
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)

  // Vista Indicadores.
  await page.getByText('Indicadores', { exact: true }).first().click()
  await page.waitForTimeout(1200)
  const indicatorRow = page.getByText(indicatorName).first()
  record('Indicadores: fila del indicador QA visible', await indicatorRow.isVisible().catch(() => false))
  const trend = page.getByText(/2026-Q2: 1\.2/).first()
  record('Indicadores: tendencia muestra Q2=1.2', await trend.isVisible().catch(() => false))

  // Dialogo del indicador: metas y mediciones.
  await indicatorRow.locator('xpath=ancestor::tr').getByRole('button').first().click()
  await page.waitForTimeout(1000)
  const targetsBlock = await page.getByText('Metas por periodo', { exact: false }).isVisible().catch(() => false)
  const measurementsBlock = await page.getByText('Mediciones', { exact: true }).isVisible().catch(() => false)
  record('Dialogo indicador: metas y mediciones visibles', targetsBlock && measurementsBlock, `targets=${targetsBlock} mediciones=${measurementsBlock}`)
  await page.screenshot({ path: `${OUT_DIR}/indicador-dialogo.png`, fullPage: true })
  await page.keyboard.press('Escape')

  record('Sin errores de consola criticos', consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '))
  await page.close()
}

// ------- Ejecucion -------
const context = await chromium
  .launch({ headless: true, channel: 'chrome' })
  .then((browser) => browser.newContext({ viewport: { width: 1440, height: 900 } }))
try {
  const data = await phase8ApiFlows()
  await phase8UiFlows(context, data)
} catch (error) {
  record('Flujo QA', false, String(error))
} finally {
  await context.close()
  writeFileSync(`${OUT_DIR}/qa-results.json`, JSON.stringify(results, null, 2))
  const failed = results.filter((row) => !row.ok)
  console.log(`\n${results.length - failed.length}/${results.length} checks OK`)
  process.exit(failed.length > 0 ? 1 : 0)
}
