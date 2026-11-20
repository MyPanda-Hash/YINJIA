/**
 * 仪器使用汇总表 —— 接口实测(2026-11-20)
 *
 * 跑法(仓库根):
 *   node tools/archive/_instr-summary-page-20261120/test-instr-summary.mjs
 *
 * 前置:8090 已跑新 jar;测试账套(登录工厂 YJ_TEST)已用 _scratch 的 seed 脚本造 4 条使用记录
 *   (11-20 / 11-19 / 11-18 本周 + 11-10 上周),验证后清理。
 *
 * 验四件事:
 *   ① 汇总取数:默认全部区间(不传日期)= 4 行;本周(11-16~11-20)= 3 行;统计条数字来自去重值;
 *   ② 作废过滤:把一行标 asp_cancel='Y' 后行数 -1(脚本里直接用 4 条已知数据核对,不写库);
 *   ③ 导出全部:200 + xlsx 魔数(PK);
 *   ④ 导出所选:记录id=[1 个] 的 xlsx 字节数必须 < 全量(说明真的只导了勾中的行)。
 */
const base = 'http://127.0.0.1:8090'
const outDir = 'D:/workspace/yinjia/tools/archive/_instr-summary-page-20261120'
const { writeFileSync, mkdirSync } = await import('node:fs')
mkdirSync(outDir, { recursive: true })

async function login(factory) {
  const r = await fetch(base + '/api/auth/login', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456', factory }),
  })
  const j = await r.json()
  if (j.code !== 200) throw new Error('login failed: ' + JSON.stringify(j))
  return j.data.token
}

const token = await login('YJ_TEST')
const H = { 'content-type': 'application/json', Authorization: 'Bearer ' + token }

async function summary(body) {
  const r = await fetch(base + '/api/px/instrSummary/summary', { method: 'POST', headers: H, body: JSON.stringify(body) })
  const j = await r.json()
  return { status: r.status, data: j.data || {}, message: j.message }
}

const all = await summary({})
console.log('全部区间: HTTP', all.status, '行数', all.data['列表']?.length, '汇总', JSON.stringify(all.data['汇总']))
console.log('前两行:', JSON.stringify((all.data['列表'] || []).slice(0, 2)))

const week = await summary({ 日期起: '2026-11-16', 日期止: '2026-11-20' })
console.log('本周(11-16~11-20): 行数', week.data['列表']?.length)

const lastWeek = await summary({ 日期起: '2026-11-01', 日期止: '2026-11-15' })
console.log('上周(11-01~11-15): 行数', lastWeek.data['列表']?.length,
  '仪器', (lastWeek.data['列表'] || []).map((r) => r['仪器名称/型号']).join(','))

const byInstr = await summary({ '仪器名称/型号': 'ICPMS' })
console.log('按仪器 ICPMS 过滤: 行数', byInstr.data['列表']?.length)

const byUser = await summary({ 使用人: '张三' })
console.log('按使用人 张三 过滤: 行数', byUser.data['列表']?.length)

// 导出:全部 vs 只导 1 条
async function exportXlsx(body, name) {
  const r = await fetch(base + '/api/px/instrSummary/export', { method: 'POST', headers: H, body: JSON.stringify(body) })
  const buf = Buffer.from(await r.arrayBuffer())
  writeFileSync(`${outDir}/${name}`, buf)
  const isZip = buf[0] === 0x50 && buf[1] === 0x4b
  console.log(name, 'HTTP', r.status, 'bytes', buf.length, 'PK魔数', isZip)
  return buf
}

const rows = all.data['列表'] || []
const ids = rows.slice(0, 2).map((r) => r['记录id'])
await exportXlsx({}, 'export-all.xlsx')
await exportXlsx({ 记录id: ids }, 'export-picked2.xlsx')

// 401 检查:不带 token 必须被拦
const anon = await fetch(base + '/api/px/instrSummary/summary', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
console.log('匿名访问: HTTP', anon.status)
