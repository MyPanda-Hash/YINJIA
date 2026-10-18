/**
 * _q-rd-progress.mjs — 「项目进度查询没有数据」取证:进度单头/明细 + 实施计划状态(只读)
 * 用法: node tools/archive/_rd-progress-20261016/_q-rd-progress.mjs [baseUrl] [factory]
 */
const BASE = (process.argv[2] || 'http://36.140.66.163:8090').replace(/\/$/, '') + '/api'
const FACTORY = process.argv[3] || ''
const post = async (p, b, token) => (await (await fetch(BASE + p, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(b || {}),
})).json())
const lg = await post('/auth/login', { userName: 'admin', password: '123456', ...(FACTORY ? { factory: FACTORY } : {}) })
if (lg?.code !== 200) { console.log('登录失败', JSON.stringify(lg).slice(0, 120)); process.exit(1) }
const token = lg.data.token
console.log('== ' + BASE + (FACTORY ? ' [' + FACTORY + ']' : '') + ' ==')

for (const panel of ['RD_PROGRESS', 'RD_PLAN', 'RD_APPROVAL']) {
  const q = await post('/px/queryFormDataList', { panelCode: panel, condition: {}, pageNo: 1, pageSize: 10 }, token)
  const d = q.data || {}
  console.log(`\n-- ${panel}: totalSize=${d.totalSize} list=${(d.list || []).length}`)
  for (const row of (d.list || []).slice(0, 5)) {
    const key = Object.keys(row.detail || {})[0]
    const n = key ? (row.detail[key] || []).length : 0
    console.log(`   ${row['单据编号'] || row['编号']} 状态=${row['单据状态'] || '-'} 明细(${key})=${n} 行${row['项目名称'] ? ' 项目=' + row['项目名称'] : ''}`)
    if (panel === 'RD_PROGRESS' && n) console.log('     样例:', JSON.stringify((row.detail[key] || []).slice(0, 2)))
  }
}
