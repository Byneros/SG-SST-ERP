// Verifica la vista Sedes sobre una sesion ya autenticada en la SPA.
export default async function run(page, ui) {
  const out = {}
  // Ir al Dashboard por si quedo otra vista abierta.
  const s0 = await ui.snapshot()
  const dash = s0.match(/@(e\d+) button "Dashboard"/)?.[1]
  if (dash) await ui.click(dash)
  await page.waitForTimeout(1500)

  const sNav = await ui.snapshot()
  const sedes = sNav.match(/@(e\d+) button "Sedes"/)?.[1]
  out.navSedes = sedes ? 'visible' : 'NO VISIBLE'
  if (!sedes) return out
  await ui.click(sedes)
  await page.waitForTimeout(2500)

  out.vista = await page.evaluate(() => {
    const tds = [...document.querySelectorAll('td')].map((c) => c.textContent ?? '')
    return {
      titulo: document.querySelector('h6')?.textContent,
      filas: document.querySelectorAll('tbody tr').length,
      planta: tds.some((t) => t.includes('Planta Norte')),
      bodega: tds.some((t) => t.includes('Bodega Sur')),
      sedeQa: tds.some((t) => t.includes('Sede QA Automatica')),
      principal: tds.some((t) => t.includes('(principal)')),
      botonesTabla: [...document.querySelectorAll('tbody button')].length,
      botonesHabilitados: [...document.querySelectorAll('tbody button')].filter((b) => !b.disabled).length,
      bannerEmpresa: document.body.innerText.includes('Empresa'),
    }
  })
  return out
}
