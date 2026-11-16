/* round-22:切 English → 复核纸面合并行标签与导航 → 截图 → 切回中文 */
const fs = await import('node:fs/promises')
const OUT = 'C:/Users/vigna/ego/sample-insp-module-20261116/'
const task = await taskSpace(1)
const page = (await task.pages())[0]
await page.goto('http://localhost:5173/#/panelx/list/INSP_COMMISSION', { timeout: 60000 })
await page.waitForTimeout(5000)
await page.click('.locale-switch', { label: 'open language menu' })
await page.waitForTimeout(900)
const items = await page.evaluate(() => [...document.querySelectorAll('.el-dropdown-menu__item, .el-select-dropdown__item')].map((e) => (e.textContent || '').trim()).filter(Boolean).slice(0, 30))
console.log('locale items:', JSON.stringify(items))
const picked = await page.evaluate(() => {
  const all = [...document.querySelectorAll('.el-dropdown-menu__item, .el-select-dropdown__item')]
  const hit = all.find((e) => /English/i.test(e.textContent || ''))
  if (!hit) return false
  hit.click(); return true
})
console.log('pick English:', picked)
await page.waitForTimeout(4000)
const en = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.ic-grid tr')].slice(0, 3).map((tr) => (tr.querySelector('th')?.innerText || '').replace(/\s+/g, ' ').trim())
  const nv = document.querySelector('.leftnav')?.innerText || ''
  const navLine = nv.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 20)
  // 纸面合并行输入框 placeholder(英文界面应显示英文字段名)
  const partyPh = [...document.querySelectorAll('.ic-grid tr')].slice(0, 3).map((tr) => [...tr.querySelectorAll('input')].map((i) => i.placeholder || i.value))
  return { th: rows, nav: navLine, partyPh }
})
console.log('EN:', JSON.stringify(en, null, 2))
async function shotPaper(file, scale = 1.3) {
  const url = await page.evaluate(async (sc) => {
    const m = await import('/node_modules/.vite/deps/modern-screenshot.js')
    const el = document.querySelector('.ic-sheet')
    const w0 = Math.max(el.scrollWidth, el.offsetWidth)
    const h0 = Math.max(el.scrollHeight, el.offsetHeight)
    return await m.domToPng(el, { scale: sc, backgroundColor: '#ffffff', width: w0, height: h0 })
  }, scale)
  if (url.err) { console.log('SHOT FAIL', url.err); return }
  await fs.writeFile(OUT + file, Buffer.from(String(url).split(',')[1], 'base64'))
  console.log('shot', file)
}
await shotPaper('round-22-english.png')
// 切回中文
await page.click('.locale-switch', { label: 'open language menu' })
await page.waitForTimeout(800)
const back = await page.evaluate(() => {
  const all = [...document.querySelectorAll('.el-dropdown-menu__item, .el-select-dropdown__item')]
  const hit = all.find((e) => /简体中文|中文/.test(e.textContent || ''))
  if (!hit) return false
  hit.click(); return true
})
console.log('back to zh:', back)
await page.waitForTimeout(1500)
