// round-12：英文界面走查（LOCALE_KEY = mes_locale）
const entry = (await listTaskSpaces()).find((s) => s.name === 'wo-create-20261113')
const t = await taskSpace(entry.id)
const page = (await t.pages())[0]
const errors = []
page.on?.('pageerror', (e) => errors.push(String(e)))
const sleep = (ms) => page.waitForTimeout(ms)

await page.evaluate(() => localStorage.setItem('mes_locale', 'en'))
await page.reload({ timeout: 30000 })
await sleep(5000)
const en = await page.evaluate(() => ({
  buttons: [...document.querySelectorAll('.wol-btns button')].map((b) => (b.textContent || '').trim()).filter(Boolean),
  headers: [...document.querySelectorAll('.wol-table th')].map((th) => (th.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean),
  hasTypeHeader: [...document.querySelectorAll('.wol-table th')].some((th) => (th.textContent || '').trim() === 'Work Order Type'),
}))
console.log('英文按钮=' + JSON.stringify(en.buttons.slice(0, 16)))
console.log('英文列头(含 Work Order Type)=' + en.hasTypeHeader + ' 列头=' + JSON.stringify(en.headers.slice(0, 24)))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-create-20261113/r12-en-list.png' })

// 新增弹窗英文
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.wol-btns button')].find((b) => (b.textContent || '').trim() === 'New')
  btn?.click()
})
await sleep(2500)
const dlg = await page.evaluate(() => {
  const d = [...document.querySelectorAll('.woc-dlg')].find((x) => x.getBoundingClientRect().width > 100)
  if (!d) return null
  return {
    title: (d.querySelector('.el-dialog__title') || {}).textContent || '',
    tabs: [...d.querySelectorAll('.el-tabs__item')].map((x) => (x.textContent || '').trim()),
    labels: [...d.querySelectorAll('.el-form-item__label')].map((x) => (x.textContent || '').trim()),
  }
})
console.log('英文新增弹窗=' + JSON.stringify(dlg))
await page.evaluate(() => {
  const tab = [...document.querySelectorAll('.woc-tabs .el-tabs__item')].find((x) => (x.textContent || '').trim() === 'Temporary Work Order')
  tab?.click()
})
await sleep(900)
const tempEn = await page.evaluate(() => ({
  alert: (document.querySelector('.woc-dlg .el-alert') || {}).textContent?.replace(/\s+/g, ' ').trim().slice(0, 300),
  subTitle: (document.querySelector('.woc-dlg .woc-sub-t') || {}).textContent?.trim(),
  tableHeaders: [...document.querySelectorAll('.woc-dlg .el-table th')].map((x) => (x.textContent || '').trim()),
}))
console.log('英文临时页签=' + JSON.stringify(tempEn))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-create-20261113/r12-en-temp.png' })
await page.keyboard.press('Escape')
await sleep(600)
// 列设置弹窗英文
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.wol-btns button')].find((b) => (b.textContent || '').trim() === 'Column Settings' || (b.textContent || '').trim() === '列设置')
  btn?.click()
})
await sleep(1500)
const colEn = await page.evaluate(() => {
  const d = document.querySelector('.csd-dialog')
  if (!d) return null
  return {
    title: (d.querySelector('.el-dialog__title') || {}).textContent || '',
    items: [...d.querySelectorAll('.csd-label')].map((x) => (x.textContent || '').trim()).slice(0, 40),
    tip: (d.querySelector('.csd-tip') || {}).textContent || '',
  }
})
console.log('英文列设置=' + JSON.stringify(colEn).slice(0, 1200))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-create-20261113/r12-en-colset.png' })
// 恢复中文
await page.evaluate(() => {
  const d = document.querySelector('.csd-dialog')
  const footer = d?.querySelector('.el-dialog__footer')
  const cancel = footer ? [...footer.querySelectorAll('button')].find((b) => /Cancel|取消/i.test((b.textContent || '').trim())) : null
  cancel?.click()
})
await sleep(600)
await page.evaluate(() => localStorage.setItem('mes_locale', 'zh-CN'))
await page.reload({ timeout: 30000 })
await sleep(3500)
const zh = await page.evaluate(() => [...document.querySelectorAll('.wol-table th')].map((th) => (th.textContent || '').trim()).filter(Boolean).slice(0, 6))
console.log('恢复中文列头=' + JSON.stringify(zh))
console.log('pageerrors=' + JSON.stringify(errors))
