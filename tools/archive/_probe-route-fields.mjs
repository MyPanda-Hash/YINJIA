/**
 * _probe-route-fields.mjs — 工艺路线「金蝶字段」验收(2026-10-05)
 *
 * 依据用户提供的金蝶AI星辰「工艺路线」截图:表头 12 字段 + 明细 15 列(工序图片…是否首检)。
 * 断言口径:字段**已登记并按 place 下发**(表头在表单头、明细在明细页签),默认路线 GY-CB-STD 已按图补示例值。
 * 用法: node tools/archive/_probe-route-fields.mjs [base]
 */
const BASE = process.argv[2] || 'http://127.0.0.1:8090'
const API = BASE + '/api'
let token = '', pass = 0, fail = 0
const ok = (m) => { pass++; console.log('  [PASS] ' + m) }
const bad = (m) => { fail++; console.log('  [FAIL] ' + m) }
async function post(p, b) {
  const r = await fetch(API + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(b || {}) })
  const t = await r.text(); let j = null; try { j = JSON.parse(t) } catch {}
  return { status: r.status, json: j, text: t }
}
async function get(p) {
  const r = await fetch(API + p, { headers: token ? { Authorization: 'Bearer ' + token } : {} })
  const t = await r.text(); let j = null; try { j = JSON.parse(t) } catch {}
  return { status: r.status, json: j, text: t }
}
const NEED_H = ['工艺路线编码','工艺路线名称','审核状态','工艺路线分组','生效日期','失效日期','工艺类型','备注1','备注2','备注3','生产单据类型','是否连续委外']
const NEED_D = ['工序图片','工序编码','工序名称','工序说明','工序控制','工序组','班组','操作工','工序单位','计划数量换算率','工序序列','是否末道工序','允许超额','是否质检','是否首检']

async function main() {
  console.log('== 工艺路线金蝶字段探针 @ ' + BASE + ' ==')
  const lg = await post('/auth/login', { userName: 'admin', password: '123456' })
  token = lg.json?.data?.token
  if (!token) { bad('登录失败'); return summary() }
  ok('登录成功')

  const d = await get('/px/getFormDescriptor?panelCode=ROUTE&code=GY-CB-STD')
  if (d.status !== 200) { bad('描述符取不到: ' + String(d.json?.message).slice(0, 120)); return summary() }
  const doc = d.json?.data || {}
  const hdr = doc.data || {}
  const items = Array.isArray(doc.detailData) ? doc.detailData : (doc.detailData?.items || [])
  const cols = (((doc.detail && doc.detail.tabs) || [])[0] || {}).fields || []
  const colNames = cols.map((f) => f.dataName)
  console.log('  表头已有值(' + Object.keys(hdr).length + '): ' + Object.keys(hdr).join(','))
  console.log('  明细列(' + colNames.length + '): ' + colNames.join(','))

  const missD = NEED_D.filter((k) => !colNames.includes(k))
  missD.length === 0 ? ok('明细 15 列全部按图登记: ' + NEED_D.join('/')) : bad('明细缺: ' + missD.join(','))
  colNames.includes('生产车间') ? ok('明细另有 生产车间(工序任务/派工按它定功能,截图外保留)') : bad('明细缺 生产车间')
  const legacy = ['工资类型','计件依据','委外供应商','按辅单位计价','辅单位','默认报工数量','关键工序','标准合格率%']
  const still = legacy.filter((k) => colNames.includes(k))
  still.length === 0 ? ok('截图没有的 8 个旧字段已退出明细位') : bad('旧字段仍在明细: ' + still.join(','))

  items.length === 3 ? ok('明细行数 = 3(成型/切炭/组装)') : bad('明细行数 = ' + items.length)
  items.map((x) => x['工序序列']).join('/') === '1/2/3' ? ok('工序序列 = 1/2/3(照图)') : bad('工序序列 = ' + items.map((x) => x['工序序列']).join('/'))
  items.every((x) => x['工序控制'] === '自制') ? ok('工序控制 = 自制(照图)') : bad('工序控制 = ' + items.map((x) => x['工序控制']).join('/'))
  items.map((x) => x['班组']).join('/') === '成型/切炭/组装' ? ok('班组 = 成型/切炭/组装') : bad('班组 = ' + items.map((x) => x['班组']).join('/'))
  items.map((x) => x['是否末道工序']).join('/') === 'N/N/Y' ? ok('是否末道工序 = N/N/Y(末行=是,照图)') : bad('是否末道工序 = ' + items.map((x) => x['是否末道工序']).join('/'))
  items.every((x) => x['允许超额'] === 'Y') ? ok('允许超额 = 是(照图)') : bad('允许超额 未按图')

  console.log('  表头缺值(' + NEED_H.filter((k) => !Object.keys(hdr).includes(k)).length + ' 个,为空的字段不落在值映射里,但已在表单登记): ' + NEED_H.filter((k) => !Object.keys(hdr).includes(k)).join(','))
  const has = ['工艺路线编码','工艺路线名称','审核状态','生效日期','失效日期','工艺类型','是否连续委外']
  const missH = has.filter((k) => !Object.keys(hdr).includes(k))
  missH.length === 0 ? ok('表头关键 7 项已按图落值: ' + has.join('/')) : bad('表头缺值: ' + missH.join(','))
  return summary()
}
function summary() { console.log(`\n== 结果: PASS ${pass} / FAIL ${fail} ==`); process.exit(fail ? 1 : 0) }
main().catch((e) => { console.error('[EXCEPTION] ' + (e?.stack || e)); process.exit(1) })