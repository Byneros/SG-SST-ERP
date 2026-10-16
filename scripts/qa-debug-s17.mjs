import { chromium } from 'playwright'
const browser = await chromium.launch({ headless: true, channel: 'chrome' })
const page = await browser.newPage()
await page.goto('http://localhost:5176', { waitUntil: 'domcontentloaded' })
await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 15000 })
await page.locator('input[type="email"], input[name="email"]').first().fill('admin@sgsst.com')
await page.locator('input[type="password"]').first().fill('SgSst!Dev2026#Rotada')
const loginResponsePromise = page.waitForResponse(
  (res) => res.url().includes('/auth/login'),
  { timeout: 15000 },
)

await Promise.all([
  loginResponsePromise,
  page.locator(
    'button[type="submit"], button:has-text("Iniciar"), button:has-text("Entrar"), button:has-text("Acceder")',
  ).first().click(),
]).then(async ([response]) => {
  console.log(`[LOGIN] HTTP ${response.status()} ${response.url()}`)

  if (!response.ok()) {
    const body = await response.text().catch(() => '')
    console.log(`[LOGIN] Respuesta: ${body.slice(0, 500)}`)
    throw new Error(`Login rechazado o fallido: HTTP ${response.status()}`)
  }
})
await page.waitForSelector('text=Dashboard', { timeout: 20000 })
await page.locator('button:has-text("Matriz GTC-45")').first().click()
await page.waitForSelector('text=Reconocimiento y valoración de peligros (GTC-45)', { timeout: 20000 })
await page.locator('button:has-text("Nuevo proceso")').click()
await page.waitForTimeout(1500)
const info = await page.evaluate(() => {
  const dialog = document.querySelector('div[role="dialog"]')
  if (!dialog) return 'NO DIALOG'
  const inputs = [...dialog.querySelectorAll('input')].map((i) => ({ type: i.type, id: i.id }))
  const rootAll = [...document.querySelectorAll('input')].length
  return JSON.stringify({ inputs, totalInputsPage: rootAll })
})
console.log('INFO:', info)
await browser.close()
