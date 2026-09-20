// Verifica que EMPLOYEE no pueda navegar a Empresas (selectView lo bloquea).
export default async function run(page, ui) {
  const out = {}
  const s = await ui.snapshot()
  const empresas = s.match(/@(e\d+) button "Empresas"/)?.[1]
  if (!empresas) {
    out.navEmpresas = 'no existe en el DOM'
    return out
  }
  await ui.click(empresas)
  await page.waitForTimeout(1500)
  out.tituloTrasClick = await page.evaluate(
    () => document.querySelector('h6')?.textContent ?? '',
  )
  out.bloqueado = out.tituloTrasClick !== 'Empresas'
  return out
}
