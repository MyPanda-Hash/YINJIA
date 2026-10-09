/**
 * _probe-route-doc.mjs — 工艺路线「表头+工序明细」验收(2026-10-05)
 *
 * 用户口径:工艺路线要能一个编码对应多道工序(底表仍 bs_route,改 doc 头行同表)。
 * 覆盖:① 面板配置 = doc + 头行同表(bs_route) + code_col/group_col=工艺路线编码
 *      ② 读一张既有路线(GY-CB-STD)= 表头(路线名) + 明细 N 行工序
 *      ③ 保存一张**新路线(2 道工序)** → bs_route 落 2 行同编码(证明一个编码多工序可存)
 *
 * ⚠ 自清理:探针建的路由由外层 SQL 硬删(编码 GY-TEST-PROBE)。
 * 用法: node tools/archive/_probe-route-doc.mjs [base]
 */
const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const API = BASE + '/api'
const TEST_CODE = 'GY-TEST-PROBE'
let token = ''
let pass = 0, fail = 0
const ok = (m) => { pass++; console.log('  [PASS] ' + m) }
const bad = (m) => { fail++; console.log('  [FAIL] ' + m) }

async function post(path, body) {
  const r = await fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}),
  })
  const t = await r.text()
  let j = null
  try { j = JSON.parse(t) } catch { /* 非 JSON */ }
  return { status: r.status, json: j, text: t }
}
async function get(path) {
  const r = await fetch(API + path, { headers: token ? { Authorization: 'Bearer ' + token } : {} })
  const t = await r.text()
  let j = null
  try { j = JSON.parse(t) } catch { /* 非 JSON */ }
  return { status: r.status, json: j, text: t }
}
const msg = (r) => r.json?.message || r.text?.slice(0, 200)

async function main() {
  console.log('== 工艺路线「表头+明细」探针 @ ' + BASE + ' ==')
  const lg = await post('/auth/login', { userName: 'admin', password: '123456' })
  token = lg.json?.data?.token
  if (!token) { bad('登录失败: ' + msg(lg)); return summary() }
  ok('登录成功')

  // ① 面板配置(响应不含物理表名,按可见键判定;底表仍是 bs_route 由 DB 侧核对)
  const cfg = (await get('/px/getPanelConfig?panelCode=ROUTE')).json?.data || {}
  const cfgText = JSON.stringify(cfg)
  console.log('  配置片段: ' + cfgText.slice(0, 200))
  cfgText.includes('"autoCodeField":"工艺路线编码"') ? ok('单号字段 = 工艺路线编码(一条路线一单号)')
    : bad('autoCodeField 不是 工艺路线编码')
  cfgText.includes('工艺路线编码') ? ok('配置含 工艺路线编码(编码/分组列)') : bad('配置里没有 工艺路线编码')
  cfgText.includes('"doc"') ? ok('面板形态 = doc(单据式,一条路线一单)') : bad('面板形态不是 doc')

  // ② 读既有路线:表头 + 明细
  const d = await get('/px/getFormDescriptor?panelCode=ROUTE&code=GY-CB-STD')
  const doc = d.json?.data || {}
  const items = Array.isArray(doc.detailData) ? doc.detailData : (doc.detailData?.items || [])
  const hdr = doc.data || doc
  console.log(`  既有路线 GY-CB-STD: 表头名称='${hdr['工艺路线名称'] || ''}' 明细 ${items.length} 行`)
  String(hdr['工艺路线名称'] || '') === '炭棒标准路线' ? ok('表头读到路线名 = 炭棒标准路线')
    : bad('表头路线名 = ' + (hdr['工艺路线名称'] || '(空)'))
  items.length === 3 ? ok('明细 3 行 = 成型/切炭/组装(一个编码对应多道工序)')
    : bad('明细行数 = ' + items.length + '(期望 3)')
  const ops = items.map((x) => String(x['工序名称'] || '')).filter(Boolean)
  ops.join('→') === '成型→切炭→组装' ? ok('明细工序顺序 = ' + ops.join('→')) : bad('明细工序 = ' + ops.join('/'))

  // ③ 新建一张 2 道工序的路线(证明"一个编码多工序"可存)
  const save = await post('/px/callButton', {
    panelCode: 'ROUTE', buttonName: '保存',
    formData: {
      编号: TEST_CODE, 工艺路线编码: TEST_CODE, 工艺路线名称: '探针测试路线', 停用: 0, 状态: '启用',
      detail: { items: [
        { 加工顺序: 1, 工序编码: 'OP-CX', 工序名称: '成型', 加工方式: '自制', 生产车间: '成型' },
        { 加工顺序: 2, 工序编码: 'OP-ZZ', 工序名称: '组装', 加工方式: '自制', 生产车间: '组装' },
      ] },
    },
    buttonParam: {},
  })
  const sv = save.json?.data || {}
  save.status === 200 ? ok('保存新路线成功:' + (sv['编号'] || sv['编号清单'] || JSON.stringify(sv).slice(0, 80)))
    : bad('保存新路线失败: ' + msg(save))

  // 回读:新路线应有 2 行工序
  const d2 = await get('/px/getFormDescriptor?panelCode=ROUTE&code=' + TEST_CODE)
  const doc2 = d2.json?.data || {}
  const items2 = Array.isArray(doc2.detailData) ? doc2.detailData : (doc2.detailData?.items || [])
  items2.length === 2 ? ok('回读新路线:明细 2 行(一编码=两工序可存)') : bad('新路线明细行数 = ' + items2.length + '(期望 2)')
  String((doc2.data || doc2)['工艺路线名称'] || '') === '探针测试路线' ? ok('新路线表头名 = 探针测试路线')
    : bad('新路线表头名异常')

  console.log('\n清理:DELETE FROM bs_route WHERE 工艺路线编码 = N\'' + TEST_CODE + '\' (+ yj_doc_status 同行)')
  return summary()
}

function summary() {
  console.log(`\n== 结果: PASS ${pass} / FAIL ${fail} ==`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error('[EXCEPTION] ' + (e?.stack || e)); process.exit(1) })
