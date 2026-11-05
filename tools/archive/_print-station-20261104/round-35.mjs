// round-35: 重建后再跑一遍真实链路(代理轮询 → 派单 → 出纸 PDF)
const task = await taskSpace(1)
const page = task.page('p1')
await page.reload()
await page.waitForTimeout(3000)
await page.goto('http://localhost:5173/#/sys/printStation', { timeout: 30000 })
await page.waitForTimeout(4000)

const out = await page.evaluate(async () => {
  const token = localStorage.getItem('mes_token') || ''
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
  const api = async (m, p, b) => {
    const r = await fetch('/api/px/print' + p, { method: m, headers: H, body: b ? JSON.stringify(b) : undefined })
    return await r.json()
  }
  const st = await api('GET', '/station')
  const list = (st?.data?.stations || []).map((s) => ({ name: s.name, enabled: s.enabled, types: s.types, online: s.online, source: s.source }))
  const e = await api('POST', '/enqueue', { 类型: 'PICK_SLIP', 工单号: 'GD-AGENT-2', 工单行号: 1, 产品名称: '重建后链路测试', 来源: 'verify' })
  return { list, enq: { queued: e?.data?.queued, targets: e?.data?.targets, message: e?.data?.message } }
})
console.log(JSON.stringify(out, null, 2))
await page.waitForTimeout(13000)
console.log(JSON.stringify(await page.evaluate(async () => {
  const token = localStorage.getItem('mes_token') || ''
  const r = await fetch('/api/px/print/station', { headers: { Authorization: 'Bearer ' + token } })
  const j = await r.json()
  const q = (s) => [...document.querySelectorAll(s)].map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim())
  return {
    queueSize: j?.data?.queueSize,
    recent: (j?.data?.recent || []).slice(0, 2).map((x) => ({ 时间: x.时间, 工单号: x.工单号, 来源: x.来源 })),
    uiStations: q('.ps-station'), uiBadge: q('.ps-badge'),
  }
}), null, 2))
