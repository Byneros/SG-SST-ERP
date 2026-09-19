export default async function run(page, ui) {
  const out = {}
  await page.setViewportSize({ width: 1680, height: 1050 })
  // Dev server usa HMR; capturar errores desde el primer momento.
  await page.evaluate(() => {
    window.__errs = []
    window.addEventListener('error', (e) => window.__errs.push(String(e.error?.stack || e.message)))
    window.addEventListener('unhandledrejection', (e) => window.__errs.push('rej: ' + String(e.reason?.stack || e.reason)))
  })

  await page.waitForFunction(
    () => document.body.innerText.includes('Iniciar sesion') || document.body.innerText.includes('Rol de sesion'),
    { timeout: 20000 },
  )
  await page.waitForTimeout(1000)

  if ((await page.evaluate(() => document.body.innerText)).includes('Iniciar sesion')) {
    const s = await ui.snapshot()
    await ui.fill(s.match(/@(e\d+) textbox "Correo"/)[1], 'empleado@sgsst.com')
    await ui.fill(s.match(/@(e\d+) textbox "Contrasena"/)[1], 'Admin12345')
    await ui.click(s.match(/@(e\d+) button "Iniciar sesion"/)[1])
    await page.waitForTimeout(3000)
    out.login = 'ok'
  }

  const sNav = await ui.snapshot()
  await ui.click(sNav.match(/@(e\d+) button "Incidentes"/)[1])
  await page.waitForTimeout(3200)

  out.dom = await page.evaluate(() => ({
    appVacio: (document.querySelector('#app')?.innerHTML.length ?? 0) < 40,
    botones: document.querySelectorAll('button').length,
    errores: window.__errs ?? [],
  }))

  const s2 = await ui.snapshot()
  out.botonNuevo = s2.match(/@(e\d+) button "Nuevo"/)?.[1] ?? 'NO ENCONTRADO'
  if (out.botonNuevo !== 'NO ENCONTRADO') {
    await ui.click(out.botonNuevo)
    await page.waitForTimeout(1200)
    const dlg = await ui.snapshot()
    // MUI agrega " *" a los labels requeridos.
    const titulo = dlg.match(/@(e\d+) textbox "Titulo[^"]*"/)?.[1]
    const desc = dlg.match(/@(e\d+) textbox "Descripcion[^"]*"/)?.[1]
    const guardar = dlg.match(/@(e\d+) button "Guardar"/)?.[1]
    if (titulo && desc && guardar) {
      await ui.fill(titulo, 'Cable expuesto en zona de soldadura')
      await ui.fill(desc, 'Reportado por trabajador durante QA automatizado del flujo EMPLOYEE.')
      await page.evaluate(() => {
        const input = document.querySelector('input[type="date"]')
        if (input) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
          setter.call(input, '2026-09-18')
          input.dispatchEvent(new Event('input', { bubbles: true }))
        }
      })
      await page.waitForTimeout(400)
      await ui.click(guardar)
      await page.waitForTimeout(3500)
      out.incidenteEnTabla = await page.evaluate(() =>
        [...document.querySelectorAll('td')].some((c) => c.textContent?.includes('Cable expuesto')),
      )
      out.erroresFinales = await page.evaluate(() => window.__errs ?? [])
    } else {
      out.errorDialogo = dlg
    }
  }
  return out
}
