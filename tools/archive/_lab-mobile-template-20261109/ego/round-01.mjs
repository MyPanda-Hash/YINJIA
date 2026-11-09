// 手机端「加标水配置记录表」:明细列随「测试项目」变(2026-11-09 第五轮)验证
// 5173 = 源码即时生效;登录工厂 YJ(正式库)
const task = await taskSpace('lab-mobile-template-20261109')
const page = task.page('p1')
const OUT = 'C:/Users/Lenovo/ego/lab-mobile-template-20261109'
const base = 'http://localhost:5173'

async function restoreWindow() {
  try {
    const w = await page.cdp('Browser.getWindowForTarget', {})
    if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
    await page.waitForTimeout(300)
  } catch (e) { /* ignore */ }
}

await restoreWindow()
await page.goto(base + '/#/login', { timeout: 40000 })
await page.waitForTimeout(1200)
await page.evaluate(async () => {
  const r = await fetch('/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ' }),
  })
  const j = await r.json()
  localStorage.setItem('mes_token', j.data.token)
  localStorage.setItem('mes_user', JSON.stringify(j.data.user || {}))
  localStorage.setItem('mes_factory', JSON.stringify({ code: 'YJ', name: 'YINJIA-MES' }))
})
await page.goto(base + '/#/panelx/list/MOBILE_LAB_SPIKE_WATER', { timeout: 40000 })
await page.reload({ timeout: 60000 })
await page.waitForTimeout(8000)

const snap = async (tag) => {
  const s = await page.evaluate(() => ({
    headerLabels: [...document.querySelectorAll('.labm-field > label')].map((e) => (e.textContent || '').trim()).slice(0, 6),
    tplHint: (document.querySelector('.labm-tpl')?.textContent || '').replace(/\s+/g, ' ').trim(),
    groups: [...document.querySelectorAll('.labm-drow-body .labm-grp')].map((e) => (e.textContent || '').trim()),
    rowLabels: [...document.querySelectorAll('.labm-drow-body .labm-field > label')].map((e) => (e.textContent || '').trim()),
  }))
  console.log(`[${tag}] hint="${s.tplHint}"\n    groups=${JSON.stringify(s.groups)}\n    row=${JSON.stringify(s.rowLabels)}`)
  await restoreWindow()
  await page.screenshot({ path: `${OUT}/${tag}.png` })
  return s
}

await snap('00-未选测试项目')

// 打开「测试项目」下拉(表头里第一个 el-select)
const pickItem = async (name) => {
  await page.click('css:.labm-field .el-select >> nth=0')
  await page.waitForTimeout(1200)
  const opts = await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown__item')].map((e) => (e.textContent || '').trim()))
  const i = opts.findIndex((t) => t.includes(name))
  console.log(`   下拉(${opts.length})=${JSON.stringify(opts)} → 选「${name}」idx=${i}`)
  if (i < 0) return false
  await page.click(`css:.el-select-dropdown__item >> nth=${i}`)
  await page.waitForTimeout(2000)
  return true
}

for (const [name, tag] of [['除汞', '01-除汞'], ['除铅', '02-除铅'], ['除VOC', '03-除VOC'], ['NSF 42-余氯', '04-余氯未设计']]) {
  if (await pickItem(name)) await snap(tag)
}
