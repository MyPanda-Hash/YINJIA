// round-11: 用 queryFormDataList + keyword 精确定位单据,读出明细里的 仓库/仓位;随后清理本轮造的测试单。
const fs = await import('node:fs/promises')
const task = await taskSpace('gen-noscroll-prefill-20261113')
const page = task.page('p1')
await page.waitForTimeout(300)
const token = await page.evaluate(() => localStorage.getItem('mes_token') || '')
const post = async (path, body) => {
  const res = await page.fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
    body: JSON.stringify(body || {}),
  })
  return { status: res.status, body: JSON.parse(String(res.body || '{}')) }
}
const call = (panelCode, buttonName, formData) => post('/api/px/callButton', { panelCode, buttonName, formData, buttonParam: {} })

/** 取某面板里包含 docNo 的那张单的明细行(自动找出 detail 里的数组 + 按单据编号过滤) */
async function rowsOf(panelCode, docNo) {
  const res = await post('/api/px/queryFormDataList', { panelCode, condition: {}, keyword: docNo, pageNo: 1, pageSize: 20 })
  const list = res.body?.data?.list || []
  for (const d of list) {
    const det = d?.detail && typeof d.detail === 'object' ? d.detail : {}
    for (const v of Object.values(det)) {
      if (!Array.isArray(v) || !v.length) continue
      const hit = v.filter((it) => String(it['单据编号'] || d['编号'] || '') === docNo)
      if (hit.length) return { detailKeys: Object.keys(det), rows: hit }
      // detail 行没有单据编号列时,只要这张单就是目标单就整体返回
      if (String(d['编号'] || '') === docNo) return { detailKeys: Object.keys(det), rows: v }
    }
  }
  return { detailKeys: [], rows: [] }
}

const out = {}
out.recv = await rowsOf('QC_RECV', 'SL-2026-11-0001')
out.pi = await rowsOf('PURCHASE_IN', 'PI-2026-11-0005')
console.log('RECV keys=' + JSON.stringify(out.recv.detailKeys) + ' rows=' + JSON.stringify(
  out.recv.rows.map((it) => ({ 物料编码: it['物料编码'], 仓库: it['仓库'], 仓位: it['仓位'], 仓位名称: it['仓位名称'] }))))
console.log('PI keys=' + JSON.stringify(out.pi.detailKeys) + ' rows=' + JSON.stringify(
  out.pi.rows.map((it) => ({ 存货编码: it['存货编码'], 仓库: it['仓库'], 仓位: it['仓位'] }))))

// 清理(只在测试库;已审核的先弃审)
const cleanup = []
for (const [panel, no] of [['PURCHASE_IN', 'PI-2026-11-0005'], ['QC_RECV', 'SL-2026-11-0001'], ['PU_ORDER', 'PO-2026-11-0001']]) {
  const un = await call(panel, '弃审', { 编号: no })
  const del = await call(panel, '删除', { 编号: no })
  cleanup.push({ panel, no, 弃审: un.body?.code ?? un.status, 删除: del.body?.code ?? del.status, 原因: del.body?.message })
}
console.log('CLEANUP ' + JSON.stringify(cleanup))
await fs.writeFile('C:/Users/Lenovo/ego/gen-noscroll-prefill-20261113/round-11.json',
  JSON.stringify({ recv: { detailKeys: out.recv.detailKeys, rows: out.recv.rows.map((it) => ({ 物料编码: it['物料编码'], 仓库: it['仓库'], 仓位: it['仓位'] })) },
    pi: { detailKeys: out.pi.detailKeys, rows: out.pi.rows.map((it) => ({ 存货编码: it['存货编码'], 仓库: it['仓库'], 仓位: it['仓位'] })) },
    cleanup }, null, 2), 'utf8')
