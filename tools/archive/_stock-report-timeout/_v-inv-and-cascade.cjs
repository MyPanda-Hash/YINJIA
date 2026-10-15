/* _v-inv-and-cascade.cjs — 库存报表面板「查询弹窗」相关取数耗时(只读)
 * 覆盖:INV 商品档案(archive 全量)、bs_wh、以及库存三面版带条件路径
 */
const BASE = process.env.BASE || 'http://localhost:8090'
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function login() {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  })
  const j = await r.json()
  if (!j?.data?.token) throw new Error('login failed ' + JSON.stringify(j).slice(0, 200))
  return j.data.token
}

async function q(token, body, label) {
  const t = Date.now()
  try {
    const r = await fetch(`${BASE}/api/px/queryFormDataList`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(300000),
    })
    const txt = await r.text()
    const ms = Date.now() - t
    let rows = '?', total = '?'
    try { const j = JSON.parse(txt); rows = j?.data?.list?.length; total = j?.data?.totalSize } catch {}
    console.log(`${label.padEnd(46)} HTTP ${r.status} ${String(ms).padStart(7)} ms  total=${total} rows=${rows} bytes=${txt.length}${ms > 15000 ? '  <<< 超 15s' : ''}`)
    return ms
  } catch (e) {
    console.log(`${label.padEnd(46)} ${Date.now() - t} ms ERR=${e.message}`)
    return -1
  }
}

async function main() {
  const token = await login()
  console.log('[login] ok\n')
  await q(token, { panelCode: 'INV', pageNo: 1, pageSize: 50, condition: {} }, 'INV 商品档案(archive 全量)')
  await sleep(300)
  await q(token, { panelCode: 'INV', pageNo: 1, pageSize: 50, condition: {} }, 'INV 第二次(同进程)')
  await sleep(300)
  await q(token, { panelCode: 'BS_WH', pageNo: 1, pageSize: 200, condition: {} }, 'BS_WH 仓库(参照)')
  await sleep(300)
  for (const p of ['STOCK_BALANCE', 'STOCK_LEDGER', 'STOCK_SUMMARY']) {
    await q(token, { panelCode: p, pageNo: 1, pageSize: 50, condition: {}, advFilters: [] }, `${p} 默认页`)
    await sleep(200)
  }
  // 关键字/高级筛选路径
  await q(token, { panelCode: 'STOCK_LEDGER', pageNo: 1, pageSize: 50, condition: {}, keyword: 'YJ' }, 'STOCK_LEDGER 关键字=YJ')
  await sleep(200)
  await q(token, {
    panelCode: 'STOCK_LEDGER', pageNo: 1, pageSize: 50, condition: {},
    advFilters: [{ field: '仓库', op: 'contains', value: '仓' }],
  }, 'STOCK_LEDGER 高级筛选 仓库~仓')
  await sleep(200)
  await q(token, { panelCode: 'STOCK_LEDGER', pageNo: 1, pageSize: 50, condition: { _whCode: 'CP-02' } }, 'STOCK_LEDGER 仓库编码=CP-02')
  await sleep(200)
  await q(token, {
    panelCode: 'STOCK_LEDGER', pageNo: 1, pageSize: 50,
    condition: { 仓库: '成品B仓', 存货: 'M8x20螺丝', 开始日期: '2026-01-01', 结束日期: '2026-12-31' },
  }, 'STOCK_LEDGER 全条件(期初/期末聚合)')
}
main().catch(e => { console.error(e); process.exit(1) })
