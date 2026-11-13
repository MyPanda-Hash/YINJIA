import fs from 'node:fs/promises'

const OUT = 'C:/Users/Lenovo/ego/purchase-in-source-20261111'
await fs.mkdir(OUT, { recursive: true })

const task = await taskSpace('purchase-in-source-20261111')
const page = task.page('p1')

await page.goto('http://localhost:5173/#/panelx/form/PURCHASE_IN?code=PI-2026-11-0001', { timeout: 40000 })
await page.waitForTimeout(3500)

const cands = await page.evaluate(() => {
  const out = []
  const all = [...document.querySelectorAll('header *, .topbar *, .navbar *, [class*=lang] *')]
  for (const el of all) {
    const t = (el.textContent || '').trim()
    if (!t || t.length > 6) continue
    if (!/^(中|EN|English|简体中文|语言)$/.test(t)) continue
    out.push({ tag: el.tagName, cls: el.className, text: t })
  }
  return out.slice(0, 20)
})
console.log('cands=' + JSON.stringify(cands, null, 1))

const clicked = await page.evaluate(() => {
  const all = [...document.querySelectorAll('*')]
  const hit = all.find((el) => {
    const t = (el.textContent || '').trim()
    if (t !== '中文' && t !== '中') return false
    if (el.children.length > 2) return false
    const r = el.getBoundingClientRect()
    return r.top < 40 && r.width > 0 && r.width < 120
  })
  if (!hit) return null
  hit.click()
  return { tag: hit.tagName, cls: hit.className, text: (hit.textContent || '').trim() }
})
console.log('clicked=' + JSON.stringify(clicked))
await page.waitForTimeout(1000)

const langs = await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown__item, .el-dropdown-menu__item, li')]
  .filter((e) => e.offsetParent !== null).map((e) => (e.innerText || '').replace(/\s+/g, ' ').trim())
  .filter((t) => t && t.length < 30).slice(0, 20))
console.log('langs=' + JSON.stringify(langs))

const picked = await page.evaluate(() => {
  const items = [...document.querySelectorAll('.el-select-dropdown__item, .el-dropdown-menu__item, li')]
    .filter((e) => e.offsetParent !== null)
  const en = items.find((e) => /^(English|EN|英语)$/i.test((e.innerText || '').trim()))
  if (en) { en.click(); return (en.innerText || '').trim() }
  return null
})
console.log('picked=' + picked)
await page.waitForTimeout(3000)

await page.goto('http://localhost:5173/#/panelx/form/PURCHASE_IN?code=PI-2026-11-0001', { timeout: 40000 })
await page.waitForTimeout(4000)
const en = await page.evaluate(() => {
  const fields = [...document.querySelectorAll('.udl-fields .field')].slice(-3).map((el) => ({
    label: (el.querySelector('label')?.innerText || '').replace(/\s+/g, ' ').trim(),
    value: el.querySelector('input, textarea')?.value || '',
  }))
  return { title: (document.querySelector('.head .title')?.innerText || '').replace(/\s+/g, ' '), tail: fields }
})
console.log('en=' + JSON.stringify(en))
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
await page.screenshot({ path: OUT + '/r18-new-pi-en.png' })
console.log('shot=r18-new-pi-en.png')
