// QA S16 Fase L: entry point contextual del asistente en navegador frio.
// Valida el criterio del issue #54: desde un modulo el entry point abre el
// chat con el asistente especializado correcto (?assistant= en el hash),
// la vista del asistente muestra el nombre del modulo y no hay errores de
// consola en el flujo afectado.
// Uso: node scripts/qa-s16-entry-point-ui.mjs [WEB_URL]
import { chromium } from 'playwright'

const BASE = process.argv[2] ?? 'http://localhost:5176'
const API = process.env.VITE_API_URL ?? 'http://localhost:3002/api/v1'
const EMAIL = process.env.QA_EMAIL ?? 'admin@sgsst.com'
const PASSWORD = process.env.QA_PASS ?? process.env.SEED_ADMIN_PASSWORD ?? ''

const results = []
function record(name, ok, detail = '') {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const consoleErrors = []
const failedRequests = []

async function main() {
  if (!PASSWORD) {
    console.error('Sin password: exporte QA_PASS / SEED_ADMIN_PASSWORD')
    process.exit(1)
  }

  const browser = await chromium.launch({ headless: true, channel: 'chrome' })
  const page = await browser.newPage()
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('requestfailed', (req) => {
    failedRequests.push(`${req.url()} :: ${req.failure()?.errorText ?? ''}`)
  })
  page.on('response', (res) => {
    if (res.status() >= 500) failedRequests.push(`HTTP ${res.status()} ${res.url()}`)
  })

  try {
    // 0. Navegador frio: sin sesion -> login UI.
    await page.goto(BASE, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 15000 })
    const emailField = page.locator('input[type="email"], input[name="email"]').first()
    const passwordField = page.locator('input[type="password"]').first()
    await emailField.fill(EMAIL)
    await passwordField.fill(PASSWORD)
    await Promise.all([
      page.waitForResponse((res) => res.url().includes('/auth/login') && res.ok(), { timeout: 15000 }),
      page.getByRole('button', { name: /ingresar|iniciar|entrar|login|acceder/i }).first().click(),
    ])
    // La SPA tarda en reemplazar el login por el dashboard: espera activa,
    // no un timeout fijo que marca falsos negativos en arranques lentos.
    await page
      .locator('input[type="password"]')
      .first()
      .waitFor({ state: 'detached', timeout: 15000 })
    record('0 login UI (navegador frio)', true)

    // 1. Modulo de riesgos con entry point contextual (navegacion por la UI,
    // no goto con hash: la SPA gestiona la vista con estado interno).
    await page.getByText('Riesgos', { exact: true }).first().click()
    const askButton = page.getByRole('button', { name: 'Preguntar al asistente' }).first()
    await askButton.waitFor({ state: 'visible', timeout: 15000 })
    record('1 entry point "Preguntar al asistente" visible en Riesgos', true)

    // 2. Click -> vista del asistente con ?assistant=risks en el hash.
    await askButton.click()
    await page.waitForTimeout(1200)
    const hash = await page.evaluate(() => window.location.hash)
    record(
      '2 hash #/aiAssistant?assistant=risks tras el click',
      hash.includes('aiAssistant') && hash.includes('assistant=risks'),
      hash,
    )

    // 3. La vista del chat muestra el asistente especializado activo.
    const assistantTitle = page.getByText(/Asistente de riesgos/i).first()
    await assistantTitle.waitFor({ state: 'visible', timeout: 10000 })
    record('3 vista del chat con el asistente especializado activo', true)

    // 4. Sin errores de consola ni requests fallidos (excluye 503 acotado sin proveedor IA, ya documentado).
    const aiNoProvider = consoleErrors.filter((text) => /ai-assistant|503/i.test(text))
    const realErrors = consoleErrors.length - aiNoProvider.length
    record('4 sin errores de consola en el flujo', realErrors === 0, consoleErrors.slice(0, 5).join(' | '))
    const aiFailures = failedRequests.filter((url) => /ai-assistant|503/.test(url))
    const realFailures = failedRequests.length - aiFailures.length
    record('5 sin requests fallidos (fuera del 503 sin proveedor IA)', realFailures === 0, failedRequests.slice(0, 5).join(' | '))
  } finally {
    await browser.close()
  }

  const passed = results.filter((r) => r.ok).length
  console.log(`\n${passed}/${results.length} PASS`)
  process.exit(passed === results.length ? 0 : 1)
}

main().catch((error) => {
  console.error('ERROR inesperado:', error.message)
  process.exit(1)
})
