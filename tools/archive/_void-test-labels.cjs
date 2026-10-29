/**
 * _void-test-labels.cjs — 作废本次验证产生的材料码打印记录(释放预约)(2026-10-29)
 *
 * 只动「打印人 = 验证脚本用的供应商账号」且「批次号以 ML 开头或为当日公式号」的记录,
 * 走正规 /px/puLabel/void 接口(与界面「作废」同一口径),不直接改库。
 */
const BASE = 'http://127.0.0.1:8090/'

async function call(p, { method = 'GET', token, body } = {}) {
  const r = await fetch(BASE + p.replace(/^\//, ''), {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await r.text()
  try { return JSON.parse(text) } catch (e) { return { raw: text } }
}

async function main() {
  const at = (await call('api/auth/login', { method: 'POST', body: { userName: 'admin', password: '123456', factory: 'YJ' } })).data.token
  const orderNo = process.argv[2] || 'YJ-20261012-11'
  const d = (await call('api/px/puLabel/dialog?orderNo=' + encodeURIComponent(orderNo), { token: at })).data
  const recs = d.records || []
  console.log(`订单 ${orderNo} 的打印记录 ${recs.length} 条`)
  let voided = 0
  for (const r of recs) {
    const docNo = r['单据编号']
    const batch = String(r['批次号'] || '')
    const by = String(r['打印人'] || '')
    if (by !== 'kbl01') { console.log(`  跳过 ${docNo}(打印人=${by},不是验证账号)`); continue }
    if (!(batch.startsWith('ML') || batch === '20261029')) { console.log(`  跳过 ${docNo}(批次=${batch})`); continue }
    const v = await call('api/px/puLabel/void', { method: 'POST', token: at, body: { docNo } })
    console.log(`  作废 ${docNo}(批次 ${batch}) -> ${v.code}`)
    if (v.code === 200) voided++
  }
  const after = (await call('api/px/puLabel/dialog?orderNo=' + encodeURIComponent(orderNo), { token: at })).data
  console.log(`作废 ${voided} 条;剩余记录 ${(after.records || []).length} 条`)
  const lines = after.lines || []
  console.log('可打印量已恢复: ' + lines.slice(0, 7).map((l) => `行${l['行号']}=${l['剩余可打']}`).join(' '))
}
main().catch((e) => { console.error('[FATAL]', e); process.exitCode = 2 })
