// round-33: 真实链路 —— 打印代理(每4秒轮询) + 按站点配置派单
const task = await taskSpace(1)
const page = task.page('p1')
await page.goto('http://localhost:5173/#/sys/printStation', { timeout: 30000 })
await page.waitForTimeout(3000)

const out = await page.evaluate(async () => {
  const token = localStorage.getItem('mes_token') || ''
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
  const api = async (method, path, body) => {
    const r = await fetch('/api/px/print' + path, { method, headers: H, body: body ? JSON.stringify(body) : undefined })
    return await r.json()
  }
  const log = []

  // ① 代理心跳过之后,清单里应该出现「打印电脑-01」,默认关闭(没设置的不开)
  const st0 = await api('GET', '/station')
  const list0 = (st0?.data?.stations || []).map((s) => ({ name: s.name, enabled: s.enabled, types: s.types, online: s.online, source: s.source }))
  log.push({ case: '清单(代理刚上来,还没配置)', stations: list0 })

  // ② 没配置 ⇒ 手机端拿到 queued:false
  const e0 = await api('POST', '/enqueue', { 类型: 'PICK_SLIP', 工单号: 'GD-AGENT-0', 工单行号: 1, 来源: 'verify' })
  log.push({ case: '站点没开 ⇒ 不入队', queued: e0?.data?.queued, reason: e0?.data?.reason, message: e0?.data?.message })

  // ③ 在面板上给这台电脑打开开关 + 勾「生产领料单」
  await api('POST', '/station', { stationName: '打印电脑-01', enabled: true, types: ['PICK_SLIP'] })
  const st1 = await api('GET', '/station')
  log.push({
    case: '配置后',
    mine: (st1?.data?.stations || []).filter((s) => s.name === '打印电脑-01').map((s) => ({ name: s.name, enabled: s.enabled, types: s.types, online: s.online })),
  })

  // ④ 再发一张 ⇒ 应该派给「打印电脑-01」
  const e1 = await api('POST', '/enqueue', { 类型: 'PICK_SLIP', 工单号: 'GD-AGENT-1', 工单行号: 1, 产品名称: '代理链路测试', 来源: 'verify' })
  log.push({ case: '配置后发单', queued: e1?.data?.queued, targets: e1?.data?.targets, message: e1?.data?.message })
  return log
})
console.log(JSON.stringify(out, null, 2))

// 等代理(4 秒一轮)+ 绘制 PDF
await page.waitForTimeout(14000)
const st2 = await page.evaluate(async () => {
  const token = localStorage.getItem('mes_token') || ''
  const r = await fetch('/api/px/print/station', { headers: { Authorization: 'Bearer ' + token } })
  const j = await r.json()
  return { queueSize: j?.data?.queueSize, recent: (j?.data?.recent || []).slice(0, 3).map((x) => ({ 时间: x.时间, 工单号: x.工单号, 来源: x.来源 })) }
})
console.log(JSON.stringify(st2, null, 2))
