// round-06 — 提交前硬校验(planProblemMessages)直测:vite 直接 import 源码模块,不依赖界面操作
//   期望:本道倒挂 + 下道早于上道 两类都能点名;合法链返回空串。顺带收尾:关闭弹窗、语言保持中文。
const task = await taskSpace('chain-order-guard-20261111')
const page = task.page('p1')
await page.goto('http://localhost:5173/?t=' + Date.now() + '#/prod/plan/scheduleBoard', { timeout: 30000 })
await page.waitForTimeout(5000)
await page.keyboard.press('Escape').catch(() => {})
await page.waitForTimeout(400)

const out = await page.evaluate(async () => {
  const m = await import('/src/business/planChainNotice.js')
  const row = (op, start, due) => ({ 工序: op, 计划开工日期: start, 计划完工日期: due })
  const shot = [row('成型', '2026-11-11', '2026-11-13'), row('切炭', '2026-11-01', '2026-11-01')]
  const mixed = [row('成型', '2026-11-13', '2026-11-11'), row('切炭', '2026-11-01', '2026-11-02')]
  const ok = [row('成型', '2026-11-11', '2026-11-13'), row('切炭', '2026-11-13', '2026-11-14')]
  const zh = {
    shot: m.planProblemMessages(shot),
    mixed: m.planProblemMessages(mixed),
    ok: m.planProblemMessages(ok),
  }
  localStorage.setItem('mes_locale', 'en')
  return { zh, locale: localStorage.getItem('mes_locale') }
})
console.log('zh=' + JSON.stringify(out.zh, null, 2))
// 切 en 再算一次(提示必须英文)
await page.goto('http://localhost:5173/?t=' + Date.now() + '#/prod/plan/scheduleBoard', { timeout: 30000 })
await page.waitForTimeout(5000)
const en = await page.evaluate(async () => {
  const m = await import('/src/business/planChainNotice.js')
  const row = (op, start, due) => ({ 工序: op, 计划开工日期: start, 计划完工日期: due })
  return {
    lang: localStorage.getItem('mes_locale'),
    shot: m.planProblemMessages([row('成型', '2026-11-11', '2026-11-13'), row('切炭', '2026-11-01', '2026-11-01')]),
  }
})
console.log('en=' + JSON.stringify(en, null, 2))
await page.evaluate(() => localStorage.setItem('mes_locale', 'zh-CN'))
console.log('restored zh-CN')
