const BASE = 'http://127.0.0.1:8090/api'
const post = async (p, body, token) => (await (await fetch(BASE + p, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body),
})).json())
let bad = 0
for (const [label, factory] of [['正式账套 YJ', undefined], ['测试账套 YJ_TEST', 'YJ_TEST']]) {
  const lg = await post('/auth/login', { userName: 'admin', password: '123456', ...(factory ? { factory } : {}) })
  const token = lg.data.token
  const s = await (await fetch(BASE + '/dashboard/stats', { headers: { Authorization: 'Bearer ' + token } })).json()
  const q = s.data.quality
  console.log(`\n[${label}] 质检看板`)
  console.log(`  检验明细总数 ${q.total} / 合格 ${q.pass} / 非合格 ${q.bad} ⇒ 合格率 ${q.passRate}%`)
  console.log(`  结果分布 ${JSON.stringify(q.byResult)}`)
  console.log(`  近7天趋势 ${JSON.stringify(q.trend7)}`)
  console.log(`  不良 TOP ${JSON.stringify((q.defectItems || []).slice(0, 5))}`)
  if (q.passRate === 100 || q.total === 0) { console.log('  ⚠ 仍是 100% 或空'); bad++ }
}
console.log(bad ? `\n[FAIL] ${bad} 个账套不合格` : '\n[OK] 两账套质检看板均非 100%')
process.exit(bad ? 1 : 0)
