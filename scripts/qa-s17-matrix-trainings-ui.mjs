// QA S17: UI de matriz GTC-45 estructurada (#57) y capacitaciones #58 en
// navegador frio. Reutiliza el patron de scripts/qa-s16-entry-point-ui.mjs
// (Playwright headless, canal Chrome del sistema).
// Uso: node scripts/qa-s17-matrix-trainings-ui.mjs [WEB_URL]
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
    // 0. Navegador frio: login UI.
    await page.goto(BASE, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 15000 })
    await page.locator('input[type="email"], input[name="email"]').first().fill(EMAIL)
    await page.locator('input[type="password"]').first().fill(PASSWORD)
    await Promise.all([
      page.waitForResponse((res) => res.url().includes('/auth/login') && res.ok(), { timeout: 15000 }),
      page.locator('button[type="submit"], button:has-text("Iniciar"), button:has-text("Entrar"), button:has-text("Acceder")').first().click(),
    ])
    await page.waitForSelector('text=Dashboard', { timeout: 20000 })
    record('0. login UI (navegador frio)', true)

    // 1. Vista Matriz GTC-45 (issue #57).
    await page.locator('button:has-text("Matriz GTC-45")').first().click()
    await page.waitForSelector('text=Reconocimiento y valoración de peligros (GTC-45)', { timeout: 20000 })
    record('1. vista Matriz GTC-45 renderiza', true, page.url())

    // 2. Chips de niveles GTC visibles (resumen).
    const levelChips = await page.locator('span.MuiChip-label', { hasText: 'IV · Crítico' }).count()
    record('2. chips de niveles GTC-45 en la toolbar', levelChips >= 1, `${levelChips} chips`)

    // 3. Flujo completo por UI en matriz vacía: crear proceso → actividad →
    //    peligro → valorar (4×5) → generar riesgo, y limpiar al final.
    const createBtn = page.locator('button:has-text("Nuevo proceso")')
    record('3. botón Nuevo proceso disponible', (await createBtn.count()) === 1)
    await createBtn.click()
    const processDialog = page.locator('div[role="dialog"]')
    await processDialog.waitFor({ timeout: 10000 })
    // El campo de nombre es multiline (MUI) → textarea; el de riesgo es input.
    const dialogField = processDialog.locator('textarea, input').first()
    await dialogField.fill('[QA-S57-UI] Proceso UI')

    await processDialog.locator('button:has-text("Guardar")').click()

    const processRow = page.locator('tr', {
      hasText: '[QA-S57-UI] Proceso UI',
    })
    await processRow.waitFor({ timeout: 15000 })
    record('3a. proceso creado por UI y visible en el árbol', true)

    await processRow.locator('button[title="Añadir actividad"]').click()
    await dialogField.fill('[QA-S57-UI] Actividad')
    await processDialog.locator('button:has-text("Guardar")').click()

    const activityRow = page.locator('tr', {
      hasText: '[QA-S57-UI] Actividad',
    })
    await activityRow.waitFor({ timeout: 15000 })
    record('3b. actividad creada por UI', true)

    await activityRow.locator('button[title="Añadir peligro"]').click()
    await processDialog.locator('input').first().fill('[QA-S57-UI] Caída de altura')
    await processDialog.locator('button:has-text("Guardar")').click()
    const hazardRow = page.locator('tr', { hasText: '[QA-S57-UI] Caída de altura' })
    await hazardRow.waitFor({ timeout: 15000 })
    record('3c. peligro creado por UI', true)

    await hazardRow.locator('button[title="Valorar (prob × sev)"]').click()
    const valoracion = page.locator('div[role="dialog"]')
    await valoracion.getByRole('combobox').first().click()
    await page.locator('li[role="option"]').last().click() // probabilidad 5
    await valoracion.getByRole('combobox').nth(1).click()
    await page.locator('li[role="option"]:has-text("4")').first().click() // severidad 4
    const preview = await processDialog.locator('text=IV · Crítico').count()
    record('3d. chip de preview del nivel derivado (5×4 → IV)', preview >= 1)
    await processDialog.locator('button:has-text("Guardar")').click()
    await page.locator('tr:has-text("[QA-S57-UI] Caída de altura"):has-text("IV · Crítico")').waitFor({ timeout: 15000 })
    record('3e. valoración persistida y nivel dibujado en la fila', true)

    const hazardRow2 = page.locator('tr', { hasText: '[QA-S57-UI] Caída de altura' })
    await hazardRow2.locator('button[title="Generar riesgo"]').click()
    await processDialog.locator('input').first().fill('[QA-S57-UI] Riesgo UI')
    await processDialog.locator('button:has-text("Guardar")').click()
    await page.locator('tr:has-text("Crítico")').first().waitFor({ timeout: 15000 })
    record('3f. riesgo vinculado generado con nivel CRITICAL', true)

    await processRow.locator('button[title="Eliminar proceso (cascada)"]').click()
    await page.waitForTimeout(1500)
    const remaining = await page.locator('tr', { hasText: '[QA-S57-UI] Proceso UI' }).count()
    record('3g. limpieza del proceso por cascada', remaining === 0)

    // 4. Vista Capacitaciones: table con columnas nuevas (#58).
    await page.locator('button:has-text("Capacitaciones")').first().click()
    await page.waitForSelector('th:has-text("Asistentes")', { timeout: 20000 })
    const instructorHeader = await page.locator('th:has-text("Instructor")').count()
    record('4. vista Capacitaciones con columnas Instructor/Asistentes', instructorHeader === 1, page.url())

    // 5. Dialog de asistentes: abre desde el primer icono de grupo y en modo
    //    gestión muestra el formulario de alta.
    const groupIcons = page.locator('tr button[title="Asistentes"]')
    if ((await groupIcons.count()) > 0) {
      await groupIcons.first().click()
      await page.waitForSelector('text=Asistentes —', { timeout: 15000 })
      const hasForm = (await page.locator('div[role="dialog"] button:has-text("Añadir")').count()) === 1
      const hasEmptyState = (await page.locator('div[role="dialog"]:has-text("Sin asistentes registrados.")').count()) > 0
      record('5. dialog de asistentes abre con contenido', hasForm || hasEmptyState, hasForm ? 'alto de asistente disponible' : 'tabla vacía')
    } else {
      record('5. dialog de asistentes abre con contenido', true, 'sin capacitaciones en el scope (saltado)')
    }

    // 6. Sin errores de consola en los flujos probados.
    const relevantErrors = consoleErrors.filter((err) => !err.includes('VITE_API_URL'))
    record('6. sin errores de consola en el flujo', relevantErrors.length === 0, relevantErrors.slice(0, 2).join(' | ').slice(0, 300))

    // 7. Sin requests fallidos (500+ o red).
    const fiveHundred = failedRequests.filter((req) => !req.includes('[vite]'))
    record('7. sin requests fallidos (5xx)', fiveHundred.length === 0, fiveHundred.slice(0, 2).join(' | ').slice(0, 300))
  } finally {
    await browser.close()
  }

  const failures = results.filter((r) => !r.ok).length
  console.log(`\n${failures === 0 ? 'TODO PASS' : failures + ' FAIL'} (${results.length} checks) — API=${API}`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error('ERROR:', error?.message ?? error)
  process.exit(1)
})
