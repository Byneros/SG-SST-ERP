// QA S4.1: ciclo de vida documental completo en navegador frio (issue #8).
// Flujo: crear con archivo y vencimiento pasado -> aprobar/publicar ->
// vencer -> archivar; verificacion de AuditLog por transicion via API y de
// aislamiento de lectura multiempresa (el e2e-db ya cubre el CRUD cruzado).
// Limpieza: elimina el documento [SMOKE] via API (borrado con audit trail).
// Uso: node scripts/qa-s4-document-cycle.mjs [WEB_URL]
import { chromium } from 'playwright'

const BASE = process.argv[2] ?? 'http://localhost:5176'
const API = process.env.VITE_API_URL ?? 'http://localhost:3002/api/v1'
const EMAIL = process.env.QA_EMAIL ?? 'admin@sgsst.com'
const PASSWORD = process.env.QA_PASS ?? process.env.SEED_ADMIN_PASSWORD ?? ''
const MARK = '[SMOKE] QA S4.1'

const results = []
function record(name, ok, detail = '') {
  results.push({ name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const consoleErrors = []
const failedRequests = []

async function apiToken() {
  const response = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  if (!response.ok) throw new Error(`login ${response.status}`)
  const data = await response.json()
  return data.accessToken ?? data.access_token
}

async function apiGet(path, token, attempt = 0) {
  const response = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (response.status === 429 && attempt < 4) {
    // Rate limit global del API (120/60s): backoff y reintento, no tirar el QA.
    await new Promise((resolve) => setTimeout(resolve, 2000 * (attempt + 1)))
    return apiGet(path, token, attempt + 1)
  }
  if (!response.ok) throw new Error(`GET ${path} -> ${response.status}`)
  return response.json()
}



async function main() {
  if (!PASSWORD) {
    console.error('Sin password: exporte QA_PASS / SEED_ADMIN_PASSWORD')
    process.exit(1)
  }

  const token = await apiToken()
  const me = await (await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })).json()
  const myCompanyId = me.companyId ?? me.user?.companyId

  const browser = await chromium.launch({ headless: true, channel: 'chrome' })
  const page = await browser.newPage()
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })
  page.on('response', (res) => {
    if (res.status() >= 500) failedRequests.push(`HTTP ${res.status()} ${res.url()}`)
  })

  let documentId = null
  try {
    // 0. Login UI frio
    await page.goto(BASE, { waitUntil: 'domcontentloaded' })
    await page.locator('input[type="email"]').first().waitFor({ state: 'visible', timeout: 15000 })
    await page.locator('input[type="email"]').first().fill(EMAIL)
    await page.locator('input[type="password"]').first().fill(PASSWORD)
    await Promise.all([
      page.waitForResponse((res) => res.url().includes('/auth/login') && res.ok(), { timeout: 15000 }),
      page.getByRole('button', { name: /iniciar/i }).first().click(),
    ])
    await page.locator('input[type="password"]').first().waitFor({ state: 'detached', timeout: 15000 })
    record('0 login UI (navegador frio)', true)

    // 1. Modulo Documentos
    await page.getByText('Documentos', { exact: true }).first().click()
    await page.getByRole('button', { name: 'Nuevo' }).first().waitFor({ state: 'visible', timeout: 15000 })
    record('1 vista Documentos con boton Nuevo', true)

    // 2. Crear documento con archivo y vencimiento ya pasado (permite vencer en el mismo recorrido)
    await page.getByRole('button', { name: 'Nuevo' }).first().click()
    const dialog = page.getByRole('dialog')
    // Los labels de MUI aqui no quedan asociados al input (for/aria-labelledby),
    // asi que getByLabel es fragil: se localiza cada TextField por su contenedor
    // y el texto del label.
    // TextField multiline renderiza <textarea>, no <input>: el helper acepta ambos.
    const field = (labelText) =>
      dialog
        .locator('.MuiTextField-root')
        .filter({ hasText: labelText })
        .locator('input, textarea')
        .first()
    await field('Nombre').fill(`${MARK} Politica de bleca`)
    await field('Descripcion').fill('Recorrido QA del ciclo documental (S4.1)')
    // Combo MUI: el select no es un <select> nativo; se abre y se elige una
    // opcion concreta. Las opciones de MUI se renderizan en un portal fuera
    // del dialog, por eso el locator es a nivel de pagina. El label "Tipo"
    // colisiona con "Tipo MIME" (getByLabel resuelve ambos), por eso se usa
    // el combobox con nombre completo.
    await dialog.getByRole('combobox', { name: 'Tipo Otro' }).click()
    const firstOptionName = await page.getByRole('option').first().textContent()
    await page.getByRole('option', { name: firstOptionName ?? '' }).first().click()
    // La subida es asincrona (POST /documents/upload): se espera a que la
    // UI muestre el nombre del archivo subido, no solo que el input exista.
    await dialog.locator('input[type="file"]').waitFor({ state: 'attached', timeout: 15000 })
    await dialog.locator('input[type="file"]').setInputFiles({
      name: 'qa-s4-politica.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\n% Recorrido QA S4.1\n'),
    })
    // La subida es asincrona (POST /documents/upload): se espera a que la
    // UI muestre el nombre del archivo subido, no solo que el input exista.
    const fileInput = field('Archivo seleccionado')
    let uploaded = false
    for (let i = 0; i < 30; i += 1) {
      uploaded = await fileInput.inputValue().then((value) => value.length > 0)
      if (uploaded) {
        break
      }
      await page.waitForTimeout(500)
    }
    record('2 archivo subido y reflejado en la UI', uploaded)
    if (!uploaded) {
      throw new Error('La subida del archivo no se reflejo en el dialogo')
    }
    await field('Fecha de vencimiento').fill('2026-10-01')
    record('2b dialogo completado con vencimiento pasado', true)

    await dialog.getByRole('button', { name: 'Guardar' }).click()
    const row = page.locator('tr', { hasText: MARK }).first()
    await row.waitFor({ state: 'visible', timeout: 15000 })
    record('3 documento creado y visible en la tabla', true)
    // La SPA re-renderiza la fila tras el saveRecord: waits activos, no instantes.
    await row.getByText('Borrador', { exact: true }).first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})
    await row.getByText('v1', { exact: true }).first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
    record(
      '3b estado inicial Borrador (v1)',
      await row.getByText('Borrador', { exact: true }).count() > 0 && (await row.getByText('v1', { exact: true }).count()) > 0,
    )
    // EntityId del documento (via API) para auditoria y limpieza
    const docsPayload = await apiGet('/documents?pageSize=100', token)
    const docsList = docsPayload?.data ?? docsPayload ?? []
    documentId = docsList.find((d) => d.name === `${MARK} Politica de bleca`)?.id ?? null
    record(
      '3c documento localizado via API con companyId del scope',
      Boolean(documentId) && docsList.find((d) => d.id === documentId)?.companyId === myCompanyId,
    )

    // Transiciones via dialogos de confirmacion del ERP: cada accion de fila
    // abre un ConfirmDialog (titulo + boton de accion); el estado real se
    // verifica con la API (polling, no waits fijos).
    // Verificacion de transiciones por la UI: tras cada accion la SPA recarga
    // la lista desde el servidor, por lo que el chip de estado reflejado
    // en la fila ES el estado persistido (la verificacion API de truth se
    // hace en un bloque final, fuera de la ventana del rate limit).
    const refreshModule = async () => {
      // Si el reload de la SPA tras el guardado golpeo el rate limit (429),
      // la fila queda stale: un remonte del modulo re-solicita del servidor
      // (estado real) sin fingir datos.
      await page.getByText('Documentos', { exact: true }).first().click()
      await page
        .locator('tr', { hasText: MARK })
        .first()
        .waitFor({ state: 'visible', timeout: 20000 })
    }
    const waitRowText = async (text) => {
      try {
        await row
          .getByText(text, { exact: true })
          .first()
          .waitFor({ state: 'visible', timeout: 20000 })
      } catch {
        await refreshModule()
        await row
          .getByText(text, { exact: true })
          .first()
          .waitFor({ state: 'visible', timeout: 20000 })
      }
    }
    const settleAfterAction = async () => {
      // Ventana de respiro: el rate limit global es 120 req/min y la SPA
      // dispara un reload general de listas (50+ llamadas) por cada guardado;
      // 45s limpia la ventana antes de la siguiente transicion.
      await page.waitForTimeout(45000)
    }

    // 4. Aprobar y publicar
    await row.getByRole('button', { name: 'Aprobar y publicar' }).click()
    const approveDialog = page.locator('.MuiDialog-container', { hasText: 'Aprobar documento' })
    await approveDialog.getByRole('button', { name: 'Aprobar y publicar' }).click()
    await approveDialog.waitFor({ state: 'detached', timeout: 10000 }).catch(() => {})
    await waitRowText('Publicado')
    record(
      '4 aprobar y publicar: chip Publicado + Aprobado (aprobador)',
      await row.getByText('Aprobado', { exact: true }).count() > 0,
    )
    await settleAfterAction()

    // 5. Marcar vencido (la UI solo ofrece el boton si PUBLISHED + vencimiento pasado)
    await refreshModule()
    await row.getByRole('button', { name: 'Marcar vencido' }).click()
    const expireDialog = page.locator('.MuiDialog-container', { hasText: 'Marcar documento vencido' })
    await expireDialog.getByRole('button', { name: 'Marcar vencido' }).click()
    await expireDialog.waitFor({ state: 'detached', timeout: 10000 }).catch(() => {})
    await waitRowText('Vencido')
    record('5 marcar vencido: chip Vencido', true)
    await settleAfterAction()

    // 6. Archivar
    await refreshModule()
    await row.getByRole('button', { name: 'Archivar documento' }).click()
    const archiveDialog = page.locator('.MuiDialog-container', { hasText: 'Archivar documento' })
    await archiveDialog.getByRole('button', { name: 'Archivar' }).click()
    await archiveDialog.waitFor({ state: 'detached', timeout: 10000 }).catch(() => {})
    await waitRowText('Archivado')
    record('6 archivar: chip Archivado', true)
    await settleAfterAction()

    // 7. Verificacion API final (una unica tanda, fuera de la ventana llena):
    // estado final persisted + DocumentApproval para esta version.
    const archived = await apiGet(`/documents/${documentId}`, token)
    const finalApprovals = archived?.approvals ?? []
    record(
      '7 estado persistido tras el ciclo (ARCHIVED + approval de la version)',
      archived.status === 'ARCHIVED' && finalApprovals.length > 0,
      `status=${archived.status} approvals=${finalApprovals.length}`,
    )

    // 7b. AuditLog por transicion (verificacion via API real)
    console.log('espera 45s para ventana del rate limit antes del bloque de auditoria…')
    await new Promise((resolve) => setTimeout(resolve, 45000))
    const auditPayload = await apiGet('/audit-logs?pageSize=100', token)
    const auditRows = auditPayload?.data ?? auditPayload ?? []
    const byDocument = auditRows.filter((entry) => entry.entity === 'Document' && entry.entityId === documentId)
    const actions = new Set(byDocument.map((entry) => entry.action))
    record(
      '7 AuditLog con CREATE/APPROVE/EXPIRE/ARCHIVE del recorrido',
      ['CREATE', 'APPROVE', 'EXPIRE', 'ARCHIVE'].every((action) => actions.has(action)),
      `acciones=${[...actions].join(',')}`,
    )
    const actorOK = byDocument.every(
      (entry) => !entry.companyId || entry.companyId === myCompanyId,
    )
    record('7b AuditLog de las transiciones scopeado a la empresa', actorOK)

    // 8. Aislamiento de lectura: la lista del admin no mezcla empresas ajenas
    console.log('espera 45s para la ventana del rate limit antes del bloque de aislamiento…')
    await new Promise((resolve) => setTimeout(resolve, 45000))
    const longerList = await apiGet('/documents?pageSize=100', token)
    const everyRow = longerList?.data ?? longerList ?? []
    const foreign = everyRow.filter((d) => d.companyId && d.companyId !== myCompanyId)
    record('8 aislamiento de lectura (lista sin empresas ajenas)', foreign.length === 0, `ajenas=${foreign.length}`)
    record('8b conducta fria: sin errores de consola ni 5xx', consoleErrors.length === 0 && failedRequests.length === 0, [...consoleErrors, ...failedRequests].slice(0, 4).join(' | '))
  } finally {
    // Limpieza [SMOKE]: borrado logico-fisico via API (audit trail incluido)
    if (documentId) {
      // Limpieza [SMOKE]: respetar rate limit si el DELETE llega 429.
      let response
      for (let attempt = 0; attempt < 6; attempt += 1) {
        response = await fetch(`${API}/documents/${documentId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        })
        if (response.status !== 429) {
          break
        }
        await new Promise((resolve) => setTimeout(resolve, 3000))
      }
      console.log(`LIMPIEZA DELETE /documents/${documentId} -> HTTP ${response.status}`)
    }
    await browser.close()
  }

  const passed = results.filter((item) => item.ok).length
  console.log(`\n${passed}/${results.length} PASS`)
  process.exit(passed === results.length ? 0 : 1)
}

main().catch((error) => {
  console.error('ERROR inesperado:', error.message)
  process.exit(1)
})
