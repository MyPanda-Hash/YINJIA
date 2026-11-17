/**
 * round-07:后端**提交闸门**与列表接口的接口级对账(用页面自带的登录态直接打接口)。
 *
 * ① 只确认 1 项 → 提交必须被拒(用户口径「全部物料确认完毕后,才可以提交」);
 * ② 撤回那一笔 → 未完成列表回到干净状态;
 * ③ 已完成列表能按关键字取到刚提交的 PL2611170001(含产品编码/产品名称/打印次数)。
 */
const task = await taskSpace('mix-doc-20261118')
const page = task.page('p1')
await page.goto('http://localhost:5173/#/panelx/list/MOBILE_MIX_SCAN', { timeout: 30000 })
await page.waitForTimeout(2500)

const out = await page.evaluate(async () => {
  const token = localStorage.getItem('mes_token') || ''
  const call = async (method, url, body) => {
    const r = await fetch(url, {
      method,
      headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + token },
      body: body ? JSON.stringify(body) : undefined,
    })
    const text = await r.text()
    let json = null
    try { json = JSON.parse(text) } catch { /* 非 JSON */ }
    return { status: r.status, json, text: text.slice(0, 300) }
  }

  const scan = await call('POST', '/api/px/mix/scan', {
    工单号: 'GD-2026-11-0015', 工单行号: 1, 物料编号: 'YJ-TJHZ-001', 物料名称: '雅可比CS(80-200)',
    计划用量: 86.172, 实际用量: 80, 物料批次: '20261118001',
  })
  const saveBlocked = await call('POST', '/api/px/mix/save', { 工单号: 'GD-2026-11-0015', 工单行号: 1 })
  const rowId = scan.json?.data?.['行id']
  const undo = rowId ? await call('POST', '/api/px/mix/undo', { 行id: rowId }) : null
  const open = await call('GET', '/api/px/mix/open?keyword=GD-2026-11-0015')
  const docs = await call('GET', '/api/px/mix/docs?keyword=PL2611170001')
  return { scan, saveBlocked, undo, open, docs }
})

console.log('== ① 只确认 1 项(scan) ==')
console.log(JSON.stringify(out.scan, null, 2))
console.log('== ② 此时提交必须被拒(save) ==')
console.log(JSON.stringify(out.saveBlocked, null, 2))
console.log('== ③ 撤回该笔(undo) ==')
console.log(JSON.stringify(out.undo, null, 2))
console.log('== ④ 未完成列表(应无 GD-2026-11-0015) ==')
console.log(JSON.stringify(out.open, null, 2))
console.log('== ⑤ 已完成列表按单号查(PL2611170001) ==')
console.log(JSON.stringify(out.docs, null, 2))
