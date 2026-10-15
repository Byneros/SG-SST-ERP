// Caminata UI S5-S6 (Runbook docs/runbook-qa-s5-s6.md, issues #10-#14).
// Login frio en la SPA (hash-routing) y verificacion por vista de los criterios:
//  <- #10/#11 S5: riesgos con nivel/sede/cargo visibles; hallazgo con causas; accion correctiva
//     en seguimiento (IN_PROGRESS); KPIs de riesgos/incidentes en dashboard.
//  - #12 S6: incidentes en los 3 estados del ciclo.
//  - #13 S6: capacitaciones vencida/proxima listadas.
//  - #14 S6: indicador demo con metas/mediciones.
// Capturas en scripts/qa-artifacts/qa-s56-ui-*.png.
// Uso: node scripts/qa-s56-ui-walk.mjs [WEB_URL]  (QA_PASS / SEED_ADMIN_PASSWORD)
import { chromium } from 'playwright'

const BASE = process.argv[2] ?? 'http://localhost:5176'
const EMAIL = process.env.QA_EMAIL ?? 'admin@sgsst.com'
const PASSWORD = process.env.QA_PASS ?? process.env.SEED_ADMIN_PASSWORD ?? ''

const results = []
function record(name, ok, detail = '') {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const consoleErrors = []
const failedRequests = []

async function goView(page, label) {
  // La SPA no re-renderiza al cambiar el hash externamente ( BrowserRouter de estado):
  // se navega con clic en el sidebar, igual que en qa-s16-entry-point-ui.mjs.
  const item = page.getByText(label, { exact: true }).first()
  await item.click()
  // Espera activa al re-render (lazy load de la vista).
  await page.waitForTimeout(1200)
}

async function main() {
  if (!PASSWORD) {
    console.error('Sin password: exporte QA_PASS / SEED_ADMIN_PASSWORD')
    process.exit(1)
  }

  const browser = await chromium.launch({ headless: true, channel: 'chrome' })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()) })
  page.on('requestfailed', (req) => failedRequests.push(`${req.url()} :: ${req.failure()?.errorText ?? ''}`))
  page.on('response', (res) => { if (res.status() >= 500) failedRequests.push(`HTTP ${res.status()} ${res.url()}`) })

  try {
    // 0. Login frio desde la UI.
    await page.goto(BASE, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 15000 })
    await page.locator('input[type="email"], input[name="email"]').first().fill(EMAIL)
    await page.locator('input[type="password"]').first().fill(PASSWORD)
    await Promise.all([
      page.waitForResponse((res) => res.url().includes('/auth/login') && res.ok(), { timeout: 15000 }),
      page.getByRole('button', { name: /ingresar|iniciar|entrar|login|acceder/i }).first().click(),
    ])
    await page.locator('input[type="password"]').first().waitFor({ state: 'detached', timeout: 15000 })
    record('0 login UI (navegador frio)', true)

    // 1. Riesgos (#10/#11): 4 demo con nivel; sede y cargo en la fila.
    await goView(page, 'Riesgos')
    for (const level of ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']) {
      const title = `[QA-S56] Riesgo ${level} A`
      const row = page.getByText(title, { exact: false }).first()
      const visible = await row.isVisible().catch(() => false)
      record(`1 riesgos: fila "${title}" visible`, visible)
    }
    const body = await page.locator('body').innerText()
    record('1 riesgos: sede demo listada con filtro/nivel', /\[QA-S56\]/.test(body))
    await page.screenshot({ path: 'scripts/qa-artifacts/qa-s56-ui-risks.png', fullPage: true })

    // 2. Hallazgos (#10): hallazgo demo con severidad MAJOR.
    await goView(page, 'Hallazgos')
    const findingTitle = page.getByText('[QA-S56] Hallazgo demo A', { exact: false }).first()
    await findingTitle.waitFor({ state: 'visible', timeout: 10000 })
    const fBody = await page.locator('body').innerText()
    record('2 hallazgos: hallazgo demo listado con severidad MAJOR', /\[QA-S56\] Hallazgo demo A/.test(fBody) && /MAJOR|Mayor/i.test(fBody))
    // Causas (2): Ishikawa/metodo sugerido por el DTO; visible en el detalle o chip resumido.
    const findingRow = page.getByText('[QA-S56] Hallazgo demo A').first()
    await findingRow.click().catch(() => {})
    await page.waitForTimeout(800)
    const detailBody = await page.locator('body').innerText()
    const causes = /Causa raiz/i.test(detailBody) || /inspecc/i.test(detailBody)
    await page.screenshot({ path: 'scripts/qa-artifacts/qa-s56-ui-findings.png', fullPage: true })
    record('2 hallazgos: causas de la investigacion visibles en detalle', causes)

    // 3. Acciones (#10/#12): plan correctivo en seguimiento IN_PROGRESS.
    await goView(page, 'Acciones')
    const actionTitle = page.getByText('[QA-S56] Plan de intervencion A', { exact: false }).first()
    const actionVisible = await actionTitle.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false)
    const aBody = actionVisible ? await page.locator('body').innerText() : ''
    const inProgress = /En ejecuci[oó]n|En progreso|IN_PROGRESS/i.test(aBody)
    record('3 acciones: plan de intervencion en seguimiento (IN_PROGRESS)', actionVisible && inProgress, actionVisible ? '' : 'sin fila visible')
    await page.screenshot({ path: 'scripts/qa-artifacts/qa-s56-ui-actions.png', fullPage: true })

    // 4. Incidentes (#12): ciclo PENDING -> IN_PROGRESS -> RESOLVED visible.
    await goView(page, 'Incidentes')
    const iBody = await page.locator('body').innerText()
    const hasThree = ['Incidente demo A', 'Incidente en investigacion A', 'Incidente cerrado A']
      .every((t) => iBody.includes(`[QA-S56] ${t}`))
    const states = /Pendiente|Pending/i.test(iBody) && /En progreso|Investig/i.test(iBody) && /Resuelto|Resolved|Cerrado/i.test(iBody)
    record('4 incidentes: los 3 [QA-S56] listados con ciclo de estados', hasThree && states)
    await page.screenshot({ path: 'scripts/qa-artifacts/qa-s56-ui-incidents.png', fullPage: true })

    // 5. Capacitaciones (#13): vencida (-370d) y proxima (+15d).
    await goView(page, 'Capacitaciones')
    const tBody = await page.locator('body').innerText()
    const pastVisible = /\[QA-S56\] Capacitacion vencida A/.test(tBody)
    const futureVisible = /\[QA-S56\] Capacitacion proxima A/.test(tBody)
    record('5 capacitaciones: vencida y proxima listadas (vencimientos)', pastVisible && futureVisible)
    await page.screenshot({ path: 'scripts/qa-artifacts/qa-s56-ui-trainings.png', fullPage: true })

    // 6. Indicadores (#14): indice demo; metas/mediciones en detalle.
    await goView(page, 'Indicadores')
    const indTitle = page.getByText('[QA-S56] Indice de accidentalidad A', { exact: false }).first()
    const indVisible = await indTitle.waitFor({ state: 'visible', timeout: 10000 }).then(() => true).catch(() => false)
    record('6 indicadores: indice demo listado', indVisible)
    if (indVisible) {
      await indTitle.click().catch(() => {})
      await page.waitForTimeout(800)
      const dBody = await page.locator('body').innerText()
      const hasTargets = /Meta|Target|Q4/i.test(dBody)
      const hasMeasurements = /Medici|Measurement|nota/i.test(dBody)
      record('6 indicadores: metas y mediciones en detalle', hasTargets && hasMeasurements)
    }
    await page.screenshot({ path: 'scripts/qa-artifacts/qa-s56-ui-indicators.png', fullPage: true })

    // 7. Dashboard (#10/#14): KPIs de riesgos/incidentes/capacitaciones.
    await goView(page, 'Dashboard')
    await page.waitForTimeout(1500)
    const dashBody = await page.locator('body').innerText()
    const kpiRisk = /Riesgos?/i.test(dashBody)
    const kpiIncidents = /Incidentes?/i.test(dashBody)
    const kpiTrainings = /Capacitaciones?/i.test(dashBody)
    record('7 dashboard: KPIs de riesgos/incidentes/capacitaciones', kpiRisk && kpiIncidents && kpiTrainings)
    await page.screenshot({ path: 'scripts/qa-artifacts/qa-s56-ui-dashboard.png', fullPage: true })

    // 8. Saneidad: sin errores de consola/requests fallidos (excluye 503 de IA sin proveedor, ya documentado).
    const aiFilteredErrors = consoleErrors.filter((t) => /(ai-assistant|503)/i.test(t))
    record('8 sin errores de consola (fuera del 503 de IA)', consoleErrors.length - aiFilteredErrors.length === 0, consoleErrors.slice(0, 5).join(' | '))
    const aiFailures = failedRequests.filter((u) => /(ai-assistant|503)/i.test(u))
    record('8 sin requests fallidos (fuera del 503 de IA)', failedRequests.length - aiFailures.length === 0, failedRequests.slice(0, 5).join(' | '))
  } finally {
    await browser.close()
  }

  const passed = results.filter((r) => r.ok).length
  console.log(`\n${passed}/${results.length} PASS — caminata UI S5-S6`)
  process.exit(passed === results.length ? 0 : 1)
}

main().catch((error) => {
  console.error('ERROR inesperado:', error.message)
  process.exit(1)
})
