export default async function run(page, ui) {
  const out = {}
  await page.setViewportSize({ width: 1680, height: 1050 })
  await page.evaluate(() => {
    window.__errs = []
    window.addEventListener('error', (e) => window.__errs.push(String(e.error?.stack || e.message)))
    window.addEventListener('unhandledrejection', (e) => window.__errs.push('rej: ' + String(e.reason?.stack || e.reason)))
  })

  await page.waitForFunction(
    () => document.body.innerText.includes('Iniciar sesion'),
    { timeout: 20000 },
  )
  await page.waitForTimeout(800)

  // Login como ADMIN
  const s = await ui.snapshot()
  await ui.fill(s.match(/@(e\d+) textbox "Correo"/)[1], 'admin@sgsst.com')
  await ui.fill(s.match(/@(e\d+) textbox "Contrasena"/)[1], 'Admin12345')
  await ui.click(s.match(/@(e\d+) button "Iniciar sesion"/)[1])
  await page.waitForFunction(
    () => document.body.innerText.includes('Rol de sesion'),
    { timeout: 20000 },
  )
  out.login = 'ok'

  // Navegar a Sedes
  const sNav = await ui.snapshot()
  const sedesBtn = sNav.match(/@(e\d+) button "Sedes"/)?.[1]
  out.navSedes = sedesBtn ? 'visible' : 'NO VISIBLE'
  if (!sedesBtn) return out
  await ui.click(sedesBtn)
  await page.waitForTimeout(2500)

  // La tabla debe mostrar las sedes sembradas
  out.tabla = await page.evaluate(() => ({
    plantaNorte: [...document.querySelectorAll('td')].some((c) => c.textContent?.includes('Planta Norte')),
    bodegaSur: [...document.querySelectorAll('td')].some((c) => c.textContent?.includes('Bodega Sur')),
    principal: [...document.querySelectorAll('td')].some((c) => c.textContent?.includes('(principal)')),
    filas: document.querySelectorAll('tbody tr').length,
    errores: window.__errs ?? [],
  }))

  // Crear una sede nueva desde el dialogo
  const s2 = await ui.snapshot()
  const nuevo = s2.match(/@(e\d+) button "Nuevo"/)?.[1]
  out.botonNuevo = nuevo ?? 'NO ENCONTRADO'
  if (!nuevo) return out
  await ui.click(nuevo)
  await page.waitForTimeout(1200)

  const dlg = await ui.snapshot()
  const nombre = dlg.match(/@(e\d+) textbox "Nombre[^\"]*"/)?.[1]
  const codigo = dlg.match(/@(e\d+) textbox "Codigo[^\"]*"/)?.[1]
  const direccion = dlg.match(/@(e\d+) textbox "Direccion[^\"]*"/)?.[1]
  const ciudad = dlg.match(/@(e\d+) textbox "Ciudad[^\"]*"/)?.[1]
  const depto = dlg.match(/@(e\d+) textbox "Departamento[^\"]*"/)?.[1]
  const guardar = dlg.match(/@(e\d+) button "Guardar"/)?.[1]
  out.dialogo = { nombre, codigo, direccion, ciudad, depto, guardar } 
  if (!nombre || !guardar) { out.errorDialogo = dlg; return out }

  await ui.fill(nombre, 'Sede QA Automatica')
  if (codigo) await ui.fill(codigo, 'SEDE-QA')
  if (direccion) await ui.fill(direccion, 'Calle 10 # 5-20')
  if (ciudad) await ui.fill(ciudad, 'Bogota')
  if (depto) await ui.fill(depto, 'Cundinamarca')
  await ui.click(guardar)
  await page.waitForTimeout(3000)

  out.creacion = await page.evaluate(() => ({
    sedeQaEnTabla: [...document.querySelectorAll('td')].some((c) => c.textContent?.includes('Sede QA Automatica')),
    filas: document.querySelectorAll('tbody tr').length,
    errores: window.__errs ?? [],
  }))

  // Empresa readonly para no-SUPER_ADMIN dentro del dialogo se verifica por codigo;
  // aqui validamos el estado final del modulo.
  out.erroresFinales = await page.evaluate(() => window.__errs ?? [])
  return out
}
