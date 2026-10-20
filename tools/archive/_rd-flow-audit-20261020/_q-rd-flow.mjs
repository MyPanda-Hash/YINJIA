/**
 * 只读探针:研发「项目流程管控」/api/px/rdFlow 的活体输出(登录 → 取项目 → 打印每条的一句话说流程判定)。
 * 用法: node _q-rd-flow.mjs http://127.0.0.1:8090 admin 123456 [keyword] [YJ|YJ_TEST]
 * 判据:
 *   · 200 且 projects 数组非空 = 接口通、权限通(admin 恒过);
 *   · 每条打印 approvalNo / 当前环节 / 待办人 / 停留天数 —— 与页面表格逐行对得上。
 */
const [base = 'http://127.0.0.1:8090', user = 'admin', pass = '123456', keyword = '', factory = ''] =
  process.argv.slice(2)

const { buildFlow } = await import('file:///C:/INCER/YINJIA-MES/frontend/src/core/rd/flowStages.js')

async function req(path, opts = {}) {
  const r = await fetch(base + path, opts)
  const t = await r.text()
  try { return JSON.parse(t) } catch { throw new Error(`HTTP ${r.status} ${t.slice(0, 200)}`) }
}

const login = await req('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: user, password: pass, ...(factory ? { factory } : {}) }),
})
const token = login?.data?.token
if (!token) { console.log('登录失败:', JSON.stringify(login).slice(0, 300)); process.exit(2) }
const auth = { Authorization: 'Bearer ' + token }

const res = await req('/api/px/rdFlow' + (keyword ? '?keyword=' + encodeURIComponent(keyword) : ''), { headers: auth })
console.log('base =', base, '| factory =', factory || '(默认/正式账套)')
console.log('code =', res.code, '| message =', res.message)
const data = res.data || {}
const names = data.names || {}
const list = data.projects || []
console.log('projects =', list.length, '| truncated =', data.truncated)
const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
for (const p of list) {
  const f = buildFlow(p, names, now)
  console.log(
    `  ${p.approvalNo} | ${p.projectName || '-'} | 定级=${p.level || '-'} | 当前=${f.currentName || '已完成'}` +
      ` | 待办=${f.pendingWith.name || '-'} | 停留=${f.stuckDays}天 | ${f.doneCount}/${f.total}`,
  )
  if (list.length <= 3) console.log('     headline =', f.headline)
}
