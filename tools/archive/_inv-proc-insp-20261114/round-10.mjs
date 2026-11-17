const task = await taskSpace('inv-proc-insp-20261114')
const page = task.page('p1')
const shot = async (name) => {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(400)
  } catch (e) {}
  await page.screenshot({ path: `C:/Users/vigna/ego/inv-proc-insp-20261114/${name}.png` })
}
// ① 退出当前 YJ_TEST 会话 → 登录页
await page.goto('http://127.0.0.1:8090/#/panelx/list/INV', { timeout: 30000 })
await page.evaluate(() => localStorage.removeItem('mes_token'))
await page.reload({ waitUntil: 'load' }).catch(() => {})
await page.waitForTimeout(5000)
// ② 选择正式账套 YJ(工厂下拉第 1 项)并登录
const selects = await page.evaluate(() => [...document.querySelectorAll('.el-select')].map((el, i) => ({ i, text: (el.textContent || '').replace(/\s+/g, ' ').trim() })))
const facIdx = selects.findIndex((s) => s.text.includes('YINJIA-MES'))
if (facIdx >= 0) await page.click(`.el-select:nth-of-type(${facIdx + 1})`, { label: '选择登录工厂' }).catch(() => {})
await page.waitForTimeout(800)
await page.evaluate(() => {
  const items = [...document.querySelectorAll('.el-select-dropdown__item')]
  const yj = items.find((el) => (el.textContent || '').trim() === 'YINJIA-MES')
  if (yj) yj.click()
})
await page.waitForTimeout(600)
await page.evaluate(() => {
  const setVal = (el, v) => {
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
  }
  const ins = [...document.querySelectorAll('input')]
  const acc = ins.find((i) => (i.placeholder || '').includes('账号'))
  const pwd = ins.find((i) => (i.placeholder || '').includes('密码'))
  if (acc) setVal(acc, 'admin')
  if (pwd) setVal(pwd, '123456')
  const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
  if (btn) btn.click()
})
await page.waitForTimeout(7000)
await page.goto('http://127.0.0.1:8090/#/panelx/list/INV', { timeout: 30000 })
await page.waitForTimeout(8000)
const zh = await page.evaluate(() => {
  const ths = [...document.querySelectorAll('.el-table__header th')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
  const tr = document.querySelector('.el-table__body tbody tr')
  const tds = tr ? [...tr.querySelectorAll('td')].map((td) => (td.textContent || '').trim()) : []
  return { hash: location.hash, factory: localStorage.getItem('mes_factory'), flagIdx: ths.findIndex((t) => t.startsWith('是否过程检验')), ths: ths.slice(0, 10), code: tds[2], flagCells: [tds[6], tds[6]] }
})
console.log('ZH @ YJ:', JSON.stringify(zh))
await shot('round-10-yj-zh')
// ③ 切英文:验证字段标签译名(Process Inspection)
await page.evaluate(() => localStorage.setItem('mes_locale', 'en'))
await page.reload({ waitUntil: 'load' }).catch(() => {})
await page.waitForTimeout(8000)
const en = await page.evaluate(() => {
  const ths = [...document.querySelectorAll('.el-table__header th')].map((el) => (el.textContent || '').replace(/\s+/g, ' ').trim())
  return { flagIdx: ths.findIndex((t) => t.startsWith('Process Inspection')), ths: ths.slice(0, 10) }
})
console.log('EN @ YJ:', JSON.stringify(en))
await shot('round-10-yj-en')
// ④ 恢复中文
await page.evaluate(() => localStorage.setItem('mes_locale', 'zh-CN'))
await page.reload({ waitUntil: 'load' }).catch(() => {})
await page.waitForTimeout(6000)
