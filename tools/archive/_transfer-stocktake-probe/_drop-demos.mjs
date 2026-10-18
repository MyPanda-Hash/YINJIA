/**
 * 2026-10-18:把两个账套里**旧的演示单**(未带仓位那版)弃审并删除,好重播带真实仓位的新演示单。
 * 顺序必须是「弃审 → 删除单据」:已审核单据直接删会被拒,台账也不会自己回滚。
 */
const base = 'http://127.0.0.1:8090/api'

async function run(factory) {
  const lg = await (await fetch(base + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory }),
  })).json()
  const h = { 'Content-Type': 'application/json; charset=utf-8', Authorization: 'Bearer ' + lg.data.token }
  const post = async (path, body) => {
    try { return await (await fetch(base + path, { method: 'POST', headers: h, body: JSON.stringify(body) })).json() }
    catch (e) { return { code: -1, message: e.message } }
  }
  for (const panel of ['TRANSFER', 'STOCKTAKE']) {
    const r = await post('/px/queryFormDataList', { panelCode: panel, pageNo: 1, pageSize: 200, condition: {} })
    const rows = r.data?.list || []
    console.log(`[${factory}] ${panel} 现有 ${rows.length} 张`)
    for (const row of rows) {
      const no = row['单据编号']
      for (const act of ['弃审', '删除单据']) {
        const res = await post('/px/callButton', { panelCode: panel, buttonName: act, formData: { 编号: no }, buttonParam: {} })
        console.log(`  ${no} ${act} -> ${res.code} ${res.message || ''}`)
      }
    }
  }
}

await run('YJ')
await run('YJ_TEST')
process.exit(0)
