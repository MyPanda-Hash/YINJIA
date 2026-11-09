// 8090(jar 内 static)复验:手机端加标水列随测试项目变
const task = await taskSpace('lab-mobile-template-20261109')
const page = task.page('p1')
const OUT = 'C:/Users/Lenovo/ego/lab-mobile-template-20261109'
const base = 'http://127.0.0.1:8090'

try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
} catch (e) { /* ignore */ }

await page.goto(base + '/#/login', { timeout: 40000 })
await page.waitForTimeout(1500)
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
await page.waitForTimeout(9000)

const pick = async (name) => {
  await page.click('css:.labm-field .el-select >> nth=0')
  await page.waitForTimeout(1000)
  const opts = await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown__item')].map((e) => (e.textContent || '').trim()))
  const i = opts.findIndex((t) => t.includes(name))
  if (i < 0) return { opts, ok: false }
  await page.click(`css:.el-select-dropdown__item >> nth=${i}`)
  await page.waitForTimeout(2000)
  return { opts, ok: true }
}

for (const [name, tag] of [['除汞', '8090-除汞'], ['除VOC', '8090-除VOC']]) {
  const r = await pick(name)
  const s = await page.evaluate(() => ({
    hint: (document.querySelector('.labm-tpl')?.textContent || '').replace(/\s+/g, ' ').trim(),
    groups: [...document.querySelectorAll('.labm-drow-body .labm-grp')].map((e) => e.textContent.trim()),
    labels: [...document.querySelectorAll('.labm-drow-body .labm-field > label')].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim()),
  }))
  console.log(tag + ' opts=' + JSON.stringify(r.opts) + '\n   hint=' + JSON.stringify(s.hint) + '\n   groups=' + JSON.stringify(s.groups) + '\n   labels=' + JSON.stringify(s.labels))
  await page.evaluate(() => { document.querySelector('.labm-sec2')?.scrollIntoView({ block: 'start' }) })
  await page.waitForTimeout(500)
  await page.screenshot({ path: `${OUT}/${tag}.png` })
}
