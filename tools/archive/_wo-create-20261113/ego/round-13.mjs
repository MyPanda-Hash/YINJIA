// round-13：英文「列设置」弹窗（button 文案 = Columns）
const entry = (await listTaskSpaces()).find((s) => s.name === 'wo-create-20261113')
const t = await taskSpace(entry.id)
const page = (await t.pages())[0]
const errors = []
page.on?.('pageerror', (e) => errors.push(String(e)))
const sleep = (ms) => page.waitForTimeout(ms)
await page.evaluate(() => localStorage.setItem('mes_locale', 'en'))
await page.reload({ timeout: 30000 })
await sleep(5000)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.wol-btns button')].find((b) => (b.textContent || '').trim() === 'Columns')
  btn?.click()
})
await sleep(1800)
const colEn = await page.evaluate(() => {
  const d = document.querySelector('.csd-dialog')
  if (!d) return null
  return {
    title: (d.querySelector('.el-dialog__title') || {}).textContent || '',
    items: [...d.querySelectorAll('.csd-label')].map((x) => (x.textContent || '').trim()).slice(0, 40),
    tip: (d.querySelector('.csd-tip') || {}).textContent || '',
    count: (d.querySelector('.csd-count') || {}).textContent || '',
  }
})
console.log('英文列设置=' + JSON.stringify(colEn).slice(0, 1600))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-create-20261113/r13-en-colset.png' })
await page.evaluate(() => localStorage.setItem('mes_locale', 'zh-CN'))
await page.reload({ timeout: 30000 })
await sleep(3000)
console.log('pageerrors=' + JSON.stringify(errors))
