// 仓位字段接通验证（2026-12-01）：从现役 8090 的 /api/px/getPanelConfig 读三个面板的明细字段，
// 确认新登记的「仓位」字段真的下发给前端（metadata 是数据驱动，不需要换 jar）。
// 用法：ego-browser nodejs -e "await import('file:///C:/Users/Lenovo/ego/bin-field-20261201/round-01.mjs')"
const BASE = 'http://127.0.0.1:8090'
const task = await taskSpace('bin-field-20261201')
const page = task.page('p1')
await page.goto(BASE + '/', { timeout: 30000 })
await page.waitForTimeout(3500)

// 会话过期 → 自动登录（登录工厂默认 YJ = 正式库）
const loggedIn = await page.evaluate(() => !document.querySelector('input[placeholder*="密码"]'))
if (!loggedIn) {
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
  await page.waitForTimeout(5000)
}

const panels = ['OTHER_IN', 'OTHER_OUT', 'FINISH_IN', 'MATERIAL_OUT', 'SALE_OUT']
const out = {}
for (const code of panels) {
  out[code] = await page.evaluate(async (panelCode) => {
    const r = await fetch(`/api/px/getPanelConfig?panelCode=${panelCode}&view=system`, { credentials: 'include' })
    if (!r.ok) return { httpError: r.status }
    const j = await r.json()
    const cfg = j.data || j
    const detail = (cfg.dataSchema || []).filter((f) => String(f.key || '').includes('仓位'))
    return {
      panelName: cfg.panelName || cfg.title || '',
      detailBin: detail.map((f) => ({
        dataName: f.dataName, key: f.key, type: f.type,
        refPanel: f.refPanel || f.ref || null, refFilter: f.refFilter || null, hidden: f.hidden, visible: f.visible,
      })),
    }
  }, code)
}
try {
  const w = await page.cdp('Browser.getWindowForTarget', {})
  if (w && w.windowId) await task.cdp('Browser.setWindowBounds', { windowId: w.windowId, bounds: { windowState: 'normal' } })
  await page.waitForTimeout(400)
} catch (e) { console.log('restore skip: ' + e.message) }
console.log(JSON.stringify(out, null, 2))
await page.screenshot({ path: 'C:/Users/Lenovo/ego/bin-field-20261201/round-01.png' })
await task.finish({ keep: [] })
