// 只读:取生单弹窗元数据里的「收料超送比例」(服务端权威值),动作名按 PUSH_TARGETS 登记。
const task = await taskSpace('erp-overreceive-20261107')
const page = task.page('p1')
await page.goto('http://36.140.66.163:8090/#/dashboard', { timeout: 60000 })
await page.waitForTimeout(2500)

const out = await page.evaluate(async () => {
  const token = localStorage.getItem('mes_token')
  const post = async (path, body) => {
    const r = await fetch('/api' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(body || {}),
    })
    const t = await r.text()
    if (!t) return { error: 'HTTP ' + r.status + ' empty' }
    try { return JSON.parse(t) } catch (e) { return { error: 'non-json ' + t.slice(0, 200) } }
  }
  const tries = [
    ['QC_RECV', '生成检验或入库单'],
    ['PU_ORDER', '生成送料暂收单'],
    ['PU_ORDER', '生单'],
    ['QC_RECV', '生单'],
  ]
  const res = []
  for (const [panel, action] of tries) {
    const j = await post('/px/push/lines', { panelCode: panel, action, sourceNos: [] })
    const d = j.data || {}
    res.push({
      panel, action, target: d.targetPanel,
      overRatio: d.overRatio, 超送比例: d.overRatio != null ? Math.round(d.overRatio * 100) + '%' : null,
      err: j.message,
    })
  }
  return res
})
console.log(JSON.stringify(out, null, 2))
