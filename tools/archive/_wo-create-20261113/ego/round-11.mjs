// round-11：英文界面走查（8091 最终 jar / 最终静态产物）
//  - 生产工单页：工单类型列头 = Work Order Type；按钮 新增=New、列设置=…
//  - 新增生产工单弹窗：标题/页签/字段英文；临时工单页签说明英文
//  - 列设置弹窗：标题/列项英文
const entry = (await listTaskSpaces()).find((s) => s.name === 'wo-create-20261113')
const t = await taskSpace(entry.id)
const page = (await t.pages())[0]
const errors = []
page.on?.('pageerror', (e) => errors.push(String(e)))
const sleep = (ms) => page.waitForTimeout(ms)

await page.goto('http://127.0.0.1:8091/#/prod/plan/workOrderList', { timeout: 30000 })
await sleep(1500)
// 切英文：写 localStorage + 刷新（LOCALE_KEY 从 @/i18n 导出，值为 'yj_locale'）
const key = await page.evaluate(async () => {
  const m = await import('/assets/index-CXDSQikN.js').catch(() => null)
  return m && m.LOCALE_KEY ? m.LOCALE_KEY : null
}).catch(() => null)
console.log('LOCALE_KEY=' + key)
await page.evaluate((k) => { localStorage.setItem(k || 'yj_locale', 'en') }, key)
await page.reload({ timeout: 30000 })
await sleep(4500)
const en = await page.evaluate(() => ({
  buttons: [...document.querySelectorAll('.wol-btns button')].map((b) => (b.textContent || '').trim()).filter(Boolean),
  headers: [...document.querySelectorAll('.wol-table th')].map((th) => (th.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 22),
  hasTypeHeader: [...document.querySelectorAll('.wol-table th')].some((th) => (th.textContent || '').trim() === 'Work Order Type'),
}))
console.log('英文按钮=' + JSON.stringify(en.buttons))
console.log('英文列头=' + JSON.stringify(en.headers))
console.log('工单类型列头英文=' + en.hasTypeHeader)
// 打开新增弹窗（英文）
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('.wol-btns button')].find((b) => ['New', '新增'].includes((b.textContent || '').trim()))
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
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-create-20261113/r11-en-create.png' })
// 临时页签说明英文
await page.evaluate(() => {
  const tab = [...document.querySelectorAll('.woc-tabs .el-tabs__item')].find((x) => (x.textContent || '').trim() === 'Temporary Work Order' || (x.textContent || '').trim() === '临时工单')
  tab?.click()
})
await sleep(800)
const tempEn = await page.evaluate(() => ({
  alert: (document.querySelector('.woc-dlg .el-alert') || {}).textContent?.replace(/\s+/g, ' ').trim().slice(0, 240),
  subTitle: (document.querySelector('.woc-dlg .woc-sub-t') || {}).textContent?.trim(),
}))
console.log('英文临时页签=' + JSON.stringify(tempEn))
await page.screenshot({ path: 'C:/Users/vigna/ego/wo-create-20261113/r11-en-temp.png' })
// 关掉弹窗，回中文
await page.keyboard.press('Escape')
await page.evaluate(() => localStorage.setItem('yj_locale', 'zh-CN'))
await page.reload({ timeout: 30000 })
await sleep(3000)
console.log('恢复中文 headers=' + JSON.stringify((await page.evaluate(() => [...document.querySelectorAll('.wol-table th')].map((th) => (th.textContent || '').trim()).filter(Boolean).slice(0, 6)))))
console.log('pageerrors=' + JSON.stringify(errors))
