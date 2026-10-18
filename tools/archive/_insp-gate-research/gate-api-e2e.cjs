/**
 * gate-api-e2e.cjs — 检验单生成门禁(成型完成)的**接口级**验证(真实 HTTP,2026-10-16)
 *
 * 为什么有它:单元/探针只能证明判据算得对,**证明不了控制器接线**(422 语义、强制开单的参数与权限、
 * 列表行上的门禁字段)。本脚本打真实接口,在**测试账套**(YJ_TEST)上跑,不碰正式账。
 *
 * 断言:
 *   ① 列表下发门禁字段(可开单/预警放行/门禁档位/原因)与 gate 元信息(档位 + 可强制开单)
 *   ② 未成型行直接建单 → HTTP 422 + 原因话术
 *   ③ 强制开单**不给原因** → 400(不得静默放行)
 *   ④ 强制开单带原因(admin) → 放行并建出草稿
 *
 * 用法:node tools/archive/_insp-gate-research/gate-api-e2e.cjs [base] [factory]
 *   默认 base=http://127.0.0.1:8091/api(第二实例,不打扰 8090)、factory=YJ_TEST
 */
const BASE = process.argv[2] || 'http://127.0.0.1:8091/api'
const FACTORY = process.argv[3] || 'YJ_TEST'
const CRED = { userName: 'admin', password: '123456' }

let authHeader = {}
let fail = 0
function chk(id, name, pass, detail) {
  if (pass) console.log(`  ✓ [${id}] ${name}${detail === undefined ? '' : '  → ' + detail}`)
  else { fail++; console.log(`  ✗ [${id}] ${name}${detail === undefined ? '' : '  → ' + detail}`) }
}

async function api(path, init = {}) {
  const res = await fetch(BASE + path, { ...init, headers: { 'Content-Type': 'application/json', ...authHeader, ...(init.headers || {}) } })
  let body
  try { body = await res.json() } catch { body = { code: res.status, message: 'non-json' } }
  return { http: res.status, body }
}

async function main() {
  const lr = await api('/auth/login', { method: 'POST', body: JSON.stringify({ ...CRED, factory: FACTORY }) })
  const token = lr.body?.data?.token
  if (!token) { console.log('登录失败:', JSON.stringify(lr.body).slice(0, 300)); process.exit(2) }
  authHeader = { Authorization: 'Bearer ' + token }
  console.log(`[login] ok  factory=${lr.body.data.user?.factory}`)

  // ① 列表:门禁字段 + 元信息
  const list = await api('/qc/firstInsp/woLines?pageNo=1&pageSize=200')
  const rows = list.body?.data?.list || []
  const meta = list.body?.data?.gate || {}
  chk('1.1', 'GET /qc/firstInsp/woLines 返回列表', rows.length > 0, rows.length + ' 行')
  chk('1.2', '每行带门禁字段', rows.length > 0 && rows.every((r) => '可开单' in r && '不能开单原因' in r && '门禁档位' in r))
  chk('1.3', '下发 gate 元信息(档位/可强制开单)', !!meta['门禁档位'] && '可强制开单' in meta, JSON.stringify(meta))

  const blocked = rows.find((r) => r['可开单'] === false)
  chk('1.4', '存在被拦截的行(测试账套)', !!blocked, blocked ? `${blocked['工单号']}#${blocked['工单行号']} 完工量=${blocked['成型完工量']} 计划量=${blocked['成型计划量']}` : '无')
  if (!blocked) { console.log('\n无拦截样例,后续断言跳过'); return finish() }
  chk('1.5', '拦截行写明原因', String(blocked['不能开单原因'] || '').length > 0, blocked['不能开单原因'])

  const wo = blocked['工单号']
  const xc = blocked['工单行号']

  // ② 直接建单 → 业务码 422
  //   ⚠ 本项目约定:业务错误走 ApiResult.fail(code,message) ⇒ **HTTP 200 + 体内 code**(不是 HTTP 状态码),
  //     断言必须读 body.code(第 2 轮才发现:原按 r.http 断言全"失败",而实际是断言写错了)。
  const r2 = await api('/qc/firstInsp/fromWoLine', { method: 'POST', body: JSON.stringify({ 工单号: wo, 工单行号: xc }) })
  chk('2.1', '未成型行建单被拦(code=422)', r2.body?.code === 422, 'http=' + r2.http + ' code=' + r2.body?.code)
  chk('2.2', '拦下时带原因话术', /成型/.test(String(r2.body?.message || '')), r2.body?.message)

  // ③ 强制开单但没填原因 → 400(绝不静默放行)
  const r3 = await api('/qc/firstInsp/fromWoLine', { method: 'POST', body: JSON.stringify({ 工单号: wo, 工单行号: xc, 强制开单: true }) })
  chk('3.1', '强制开单缺原因 → code=400', r3.body?.code === 400, 'code=' + r3.body?.code + ' msg=' + r3.body?.message)

  // ④ 强制开单带原因(admin 有权限)→ 放行
  const r4 = await api('/qc/firstInsp/fromWoLine', {
    method: 'POST',
    body: JSON.stringify({ 工单号: wo, 工单行号: xc, 强制开单: true, 强制开单原因: 'e2e 验收:成型报工补录中,先出单' }),
  })
  chk('4.1', '强制开单带原因 → 放行', r4.body?.code === 200, 'code=' + r4.body?.code + ' 单号=' + r4.body?.data?.编号 + ' 已存在=' + r4.body?.data?.已存在)
  if (r4.body?.code === 200) console.log(`      ⚠ 测试账套该行已有首件检验单草稿:${r4.body.data?.['编号']}(如需清理在界面上作废)`)

  finish()
}

function finish() {
  console.log(fail === 0 ? '\n[PASS] 接口级门禁验证全过' : `\n[FAIL] ${fail} 条断言未过`)
  process.exit(fail === 0 ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(3) })
