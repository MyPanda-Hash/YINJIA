/**
 * round-08:两条**口径级**对账
 * ① 同一物料再确认 = **覆盖**(不是累加):先 30 再 80 ⇒ 实投 80,同一行 id 不变;
 * ② 刚提交的 PL2611170001 取数(`/px/mix/doc`)与纸面《成型配料记录》的 17 列对得上。
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
    return { status: r.status, json }
  }

  const one = await call('POST', '/api/px/mix/scan', {
    工单号: 'GD-2026-11-0015', 工单行号: 1, 物料编号: 'YJ-TJHZ-001', 物料名称: '雅可比CS(80-200)',
    计划用量: 86.172, 实际用量: 30,
  })
  const two = await call('POST', '/api/px/mix/scan', {
    工单号: 'GD-2026-11-0015', 工单行号: 1, 物料编号: 'YJ-TJHZ-001', 物料名称: '雅可比CS(80-200)',
    计划用量: 86.172, 实际用量: 80, 物料批次: '20261118009',
  })
  const task1 = await call('GET', '/api/px/mix/task?orderNo=GD-2026-11-0015&lineNo=1')
  const undoId = two.json?.data?.['行id'] || one.json?.data?.['行id']
  const undo = undoId ? await call('POST', '/api/px/mix/undo', { 行id: undoId }) : null
  const doc = await call('GET', '/api/px/mix/doc?docNo=PL2611170001')
  return { one, two, task1, undo, doc }
})

console.log('== ① 第一次确认 30 ==')
console.log(JSON.stringify(out.one.json?.data, null, 2))
console.log('== ① 同一物料再确认 80(应覆盖,行 id 不变) ==')
console.log(JSON.stringify(out.two.json?.data, null, 2))
console.log('== ① 明细页面取数(实投应为 80,不是 110) ==')
console.log(JSON.stringify((out.task1.json?.data?.明细 || []).map((l) => ({
  物料编号: l.物料编号, 应投: l.应投, 实投: l.实投, 待投: l.待投, 批号: l.物料批次, 已确认: l.已确认,
})), null, 2))
console.log('== ① 撤回(清掉这次验证的草稿) ==')
console.log(JSON.stringify(out.undo?.json, null, 2))
console.log('== ② 已保存单据 PL2611170001 的纸面取数 ==')
const d = out.doc.json?.data || {}
console.log(JSON.stringify({
  标题: d.标题, 文件编码: d.文件编码, 车间: d.车间, 产品编号: d.产品编号, 产品名称: d.产品名称,
  配料批次号: d.配料批次号, 配料人: d.配料人, 开始时间: d.开始时间, 结束时间: d.结束时间,
  计划用量合计: d.计划用量合计, 实际用量合计: d.实际用量合计, 打印次数: d.打印次数,
  明细: d.明细,
}, null, 2))
