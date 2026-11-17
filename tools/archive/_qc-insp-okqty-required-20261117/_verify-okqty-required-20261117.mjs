/**
 * _verify-qc-insp-okqty-required-20261117.mjs — 「来料检验单·合格数量必填」回归(仅测试库)
 *
 * 修前实测(2026-11-17):
 *   ① 行里带 合格数量=null → 「保存」400 拦住;
 *   ② 行里**没有** 合格数量 这个键(库里 NULL 的列导出到前端就是这样)→ 「保存」**200 通过**;
 *   ③ 草稿(合格数量空)→ 「审核」**200 通过**,一路审成已审核。
 * 修后要求:
 *   ①' 缺键也算空 → 「保存」400;
 *   ②' 草稿仍可存一半(保存为草稿 200);
 *   ③' 空着审核被拦:「明细第 N 行合格数量不能为空，请先补全再审核」;
 *   ④' 填了合格数量后保存/审核照常通过。
 *
 * 用法(仓库根):node tools/archive/_qc-insp-okqty-required-20261117/_verify-okqty-required-20261117.mjs
 * 只动测试库;脚本自己造的单据在结尾弃审并删除。
 */
const BASE = 'http://127.0.0.1:8090/api'
const PANEL = 'QC_INSP'
let fail = 0
const ok = (cond, name, extra = '') => {
  if (cond) console.log(`[PASS] ${name}${extra ? ' — ' + extra : ''}`)
  else { fail++; console.log(`[FAIL] ${name}${extra ? ' — ' + extra : ''}`) }
}
const login = await (await fetch(`${BASE}/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
})).json()
const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${login.data.token}` }
const post = async (url, body) => {
  const res = await fetch(BASE + url, { method: 'POST', headers: auth, body: JSON.stringify(body) })
  return { status: res.status, body: await res.json() }
}
const call = (buttonName, formData) => post('/px/callButton', { panelCode: PANEL, buttonName, formData })

const today = new Date().toISOString().slice(0, 10)
const head = { 单据日期: today, 供应商: '福建鑫恒碳业有限公司' }
const rowNoKey = { 物料编码: 'YJ-XH-002', 物料名称: '鑫恒酸洗（80-250）', 送检数量: 10 }   // ← 库里 NULL 列导出后的样子:没有「合格数量」键
const rowNull = { ...rowNoKey, 合格数量: null }
const rowFilled = { ...rowNoKey, 合格数量: 8, 不合格数量: 2 }
const made = []

// ①' 缺键 → 保存必须被拦
const s1 = await call('保存', { ...head, 编号: '', detail: { items: [rowNoKey] } })
ok(s1.body?.code !== 200 && String(s1.body.message).includes('合格数量'),
  '缺「合格数量」键的明细行,「保存」被拦(修前 200 通过)', `${s1.status} ${s1.body.message || ''}`)
if (s1.body?.data?.编号) made.push(s1.body.data.编号)

// ①b 显式 null → 保存必须被拦(原有行为,防回归)
const s2 = await call('保存', { ...head, 编号: '', detail: { items: [rowNull] } })
ok(s2.body?.code !== 200 && String(s2.body.message).includes('合格数量'), '合格数量=null 的明细行,「保存」被拦', s2.body.message || '')
if (s2.body?.data?.编号) made.push(s2.body.data.编号)

// ②' 保存为草稿:允许存一半
const d1 = await call('保存为草稿', { ...head, 编号: '', detail: { items: [rowNoKey] } })
const draftNo = d1.body?.data?.编号
ok(d1.body?.code === 200 && !!draftNo, '「保存为草稿」仍允许合格数量留空(草稿存一半)', `${d1.body?.code} 编号=${draftNo || ''}`)
if (draftNo) made.push(draftNo)

// ③' 草稿直接审核:必须被拦(修前一路审成已审核)
if (draftNo) {
  const a1 = await call('审核', { 编号: draftNo })
  ok(a1.body?.code !== 200 && String(a1.body.message || '').includes('合格数量'),
    '草稿(合格数量空)直接「审核」被拦(修前 200 通过)', a1.body?.message || '')
}

// ④' 补上合格数量后保存 + 审核照常通过
const s3 = draftNo
  ? await call('保存', { ...head, 编号: draftNo, detail: { items: [rowFilled] } })
  : { body: { code: -1 } }
ok(s3.body?.code === 200, '补上合格数量后「保存」通过', s3.body?.message || '')
if (draftNo) {
  const a2 = await call('审核', { 编号: draftNo })
  ok(a2.body?.code === 200, '补上合格数量后「审核」通过', a2.body?.message || '')
}

// —— 清场:本次造的单据全部弃审 + 删除 ——
console.log('\n清场:', JSON.stringify([...new Set(made)]))
for (const no of [...new Set(made)]) {
  await call('弃审', { 编号: no })
  const d = await call('删除单据', { 编号: no })
  if (d.body?.code !== 200) await call('删除', { 编号: no })
  console.log('  ', no, '删除 →', d.body?.code)
}
console.log(fail === 0 ? '\n[RESULT] PASS' : `\n[RESULT] FAIL(${fail} 项)`)
process.exit(fail === 0 ? 0 : 1)
