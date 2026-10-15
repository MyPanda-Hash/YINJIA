/* _q-final.mjs — 收尾复核:①工艺路线闸门 ②上一任务(工序检验单合格数量)仍在生效。 */
const BASE = process.argv[2] || 'http://127.0.0.1:8090'

async function login() {
  const r = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'HSDZ_MES' }),
  })
  const j = await r.json()
  if (j.code !== 200) throw new Error('login failed')
  return j.data.token
}

;(async () => {
  const tok = await login()
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }

  console.log('=== ① 工艺路线审核状态(/api/px/processTask/routes)===')
  const routes = (await (await fetch(BASE + '/api/px/processTask/routes', { method: 'POST', headers: H, body: '{}' })).json()).data || []
  for (const x of routes) console.log(`  ${x.编码}\t${x.审核状态}\t${x.名称}`)

  console.log('\n=== ② 工序检验单合格数量口径(/api/px/scheduleBoard/trace GD-2026-10-0007)===')
  const t = await (await fetch(BASE + '/api/px/scheduleBoard/trace', {
    method: 'POST', headers: H, body: JSON.stringify({ 工单号: 'GD-2026-10-0007' }),
  })).json()
  const qc = (t.data || {})['质检数据'] || []
  for (const x of qc) console.log(`  ${x.检验单号}\t${x.工序}\t送检=${x.送检数量}\t检验=${x.检验数量}\t合格=${x.合格数量}\t结论=${(t.data['质检汇总'] || {}).结论}`)
  console.log(`  汇总结论: ${(t.data['质检汇总'] || {}).结论}（未检验时合格数量应为 null）`)
})().catch((e) => { console.error('FAIL', e.message); process.exit(1) })
