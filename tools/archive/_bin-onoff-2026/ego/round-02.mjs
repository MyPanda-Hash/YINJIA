// 仓位字段接通验证（2026-12-01）round-02：走真前端登录态（localStorage.mes_token 取 Bearer），
// 读 5 个面板的明细字段配置，确认「仓位」字段已下发（metadata 数据驱动，不换 jar 也生效）。
// 用法：ego-browser nodejs -e "await import('file:///C:/Users/Lenovo/ego/bin-field-20261201/round-02.mjs')"
const BASE = 'http://127.0.0.1:8090'
const task = await taskSpace('bin-field-20261201')
const page = task.page('p1')
await page.goto(BASE + '/', { timeout: 30000 })
await page.waitForTimeout(3000)

const needLogin = await page.evaluate(() => !localStorage.getItem('mes_token'))
if (needLogin) {
  await page.evaluate(() => {
    const setVal = (el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      s.call(el, v)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    const ins = [...document.querySelectorAll('input')]
    setVal(ins.find((i) => (i.placeholder || '').includes('账号')), 'admin')
    setVal(ins.find((i) => (i.placeholder || '').includes('密码')), '123456')
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('进入系统'))
    if (btn) btn.click()
  })
  await page.waitForTimeout(6000)
}

const panels = ['OTHER_IN', 'OTHER_OUT', 'FINISH_IN', 'MATERIAL_OUT', 'SALE_OUT', 'PURCHASE_IN']
const out = {}
for (const code of panels) {
  out[code] = await page.evaluate(async (panelCode) => {
    const token = localStorage.getItem('mes_token')
    const r = await fetch(`/api/px/getPanelConfig?panelCode=${panelCode}&view=system`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!r.ok) return { httpError: r.status }
    const j = await r.json()
    const cfg = j.data || j
    const bin = (cfg.dataSchema || []).filter((f) => {
      const n = String(f.dataName || '')
      return n === '仓位' || n === '仓位编码'
    })
    return {
      panelName: cfg.panelName || cfg.title || '',
      binFields: bin.map((f) => ({ dataName: f.dataName, key: f.key, type: f.type, refPanel: f.refPanel, refFilter: f.refFilter })),
    }
  }, code)
}
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
console.log(JSON.stringify(out, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/bin-field-20261201/round-02.png' })
await task.finish({ keep: [] })
