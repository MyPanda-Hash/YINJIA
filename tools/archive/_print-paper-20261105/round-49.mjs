// round-49: 纸张设置端到端 —— A4 → 出 A4 横的 PDF(内容仍 210×148);再切回 A5
const task = await taskSpace(1)
const page = task.page('p1')
await page.goto('http://localhost:5173/#/sys/printStation', { timeout: 30000 })
await page.waitForTimeout(3500)

const api = async (path, body, method = 'POST') => page.evaluate(async ({ path, body, method }) => {
  const token = localStorage.getItem('mes_token') || ''
  const r = await fetch('/api/px/print' + path, {
    method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: body ? JSON.stringify(body) : undefined,
  })
  return await r.json()
}, { path, body, method })

// ① 改成 A4
const s1 = await api('/station', { stationName: '打印电脑-01', enabled: true, types: ['PICK_SLIP'], paper: 'A4' })
console.log('设置 A4 => stationPaper =', s1?.data?.stationPaper, '| stations =', JSON.stringify((s1?.data?.stations || []).map(x => [x.name, x.paper, x.online])))
await page.waitForTimeout(1200)

// ② 发一张单
const e1 = await api('/enqueue', { 类型: 'PICK_SLIP', 工单号: 'GD-PAPER-A4', 工单行号: 1, 领料单号: 'LL-PAPER-A4', 打印日期: '2026-11-05', 来源: 'verify', 明细: [{ 材料名称: 'A4 测试料', 规格: '100*200', 单位: '张', 请领数量: 3, 实发数量: 1, 备注: '' }] })
console.log('发单(A4) =>', JSON.stringify({ queued: e1?.data?.queued, targets: e1?.data?.targets }))
await page.waitForTimeout(9000)

// ③ 切回 A5 再发一张
await api('/station', { stationName: '打印电脑-01', enabled: true, types: ['PICK_SLIP'], paper: 'A5' })
await page.waitForTimeout(800)
const e2 = await api('/enqueue', { 类型: 'PICK_SLIP', 工单号: 'GD-PAPER-A5', 工单行号: 1, 领料单号: 'LL-PAPER-A5', 打印日期: '2026-11-05', 来源: 'verify', 明细: [{ 材料名称: 'A5 测试料', 规格: '100*200', 单位: '张', 请领数量: 3, 实发数量: 1, 备注: '' }] })
console.log('发单(A5) =>', JSON.stringify({ queued: e2?.data?.queued, targets: e2?.data?.targets }))
await page.waitForTimeout(9000)

const st = await api('/station', undefined, 'GET')
console.log('最近出纸 =>', JSON.stringify((st?.data?.recent || []).slice(0, 3).map(x => x.工单号 + ' ' + x.来源)))
