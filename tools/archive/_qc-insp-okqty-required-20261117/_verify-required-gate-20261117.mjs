/**
 * _verify-required-gate-20261117.mjs — 「必填没填不能提交审批 / 不能审核」回归(仅测试库)
 *
 * 用户口径(2026-11-17 第二轮):
 *   「为什么来料检验单没有必填的验证，必填没填也可以提交审批。不点保存可以直接提交审批和审核（而且没有必填校验）」
 *
 * 修前:后端只有保存(载荷口径)与审核(QC_INSP 合格数量)两处,提交审批 / 审批通过**一处都没有**:
 *   草稿(合格数量空)直接「提交审批」→ 200 审批中;「审批通过」→ 200 已审核。
 * 修后:三个状态推进点都按**库里的单据**核表头+明细必填(见 ButtonService.ensureDocRequiredFilled)。
 *
 * 用法(仓库根):node tools/archive/_qc-insp-okqty-required-20261117/_verify-required-gate-20261117.mjs
 * 只动测试库;脚本自己造的单据在结尾弃审 + 删除。
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
const made = []

// ① 草稿(合格数量空)直接提交审批 → 必须被拦
const d = await call('保存为草稿', { ...head, 编号: '', detail: { items: [{ 物料编码: 'YJ-XH-002', 送检数量: 10 }] } })
const no = d.body?.data?.编号
if (no) made.push(no)
ok(!!no, '准备一张合格数量为空的草稿', no || JSON.stringify(d.body).slice(0, 120))

const sub = await call('提交审批', { 编号: no })
ok(sub.body?.code !== 200 && String(sub.body.message || '').includes('不能为空'),
  '草稿(必填没填)直接「提交审批」被拦(修前 200 审批中)', `${sub.status}/${sub.body?.code} ${sub.body?.message || ''}`)

// ② 审核同一张草稿 → 被拦
const aud = await call('审核', { 编号: no })
ok(aud.body?.code !== 200 && String(aud.body.message || '').includes('不能为空'),
  '草稿(必填没填)直接「审核」被拦', aud.body?.message || '')

// ②b 「送检数量 0 / 合格数量 0」的行不许混过检验(2026-11-17 第二轮口径:默认 0 会帮助跳过检验)
const zeroRes = await call('保存为草稿', {
  ...head, 编号: '', detail: { items: [{ 物料编码: 'YJ-XH-002', 送检数量: 0, 合格数量: 0 }] },
})
const zeroNo = zeroRes.body?.data?.编号
if (zeroNo) made.push(zeroNo)
ok(!!zeroNo, '准备一张「送检 0 / 合格 0」的草稿', zeroNo || JSON.stringify(zeroRes.body).slice(0, 120))
const zeroAud = await call('审核', { 编号: zeroNo })
ok(zeroAud.body?.code !== 200 && String(zeroAud.body.message || '').includes('送检数量必须大于 0'),
  '「送检 0 / 合格 0」的草稿审核被拦(别让它"跳过检验")', zeroAud.body?.message || '')
const zeroSub = await call('提交审批', { 编号: zeroNo })
ok(zeroSub.body?.code !== 200 && String(zeroSub.body.message || '').includes('送检数量'),
  '「送检 0 / 合格 0」的草稿提交审批同样被拦', zeroSub.body?.message || '')

// ③ 补齐必填 → 保存 → 提交审批 → 审批通过 全部通过
const save = await call('保存', { ...head, 编号: no, detail: { items: [{ 物料编码: 'YJ-XH-002', 送检数量: 10, 合格数量: 8, 不合格数量: 2 }] } })
ok(save.body?.code === 200, '补齐必填后「保存」通过', save.body?.message || '')
const sub2 = await call('提交审批', { 编号: no })
ok(sub2.body?.code === 200, '补齐必填后「提交审批」通过', `${sub2.body?.code} ${sub2.body?.message || ''}`)
const appr = await call('审批通过', { 编号: no })
ok(appr.body?.code === 200, '补齐必填后「审批通过」通过', `${appr.body?.code} ${appr.body?.message || ''}`)

// ④ 清场:弃审 + 删除(顺带把审核/审批自动生成的下游草稿作废)
for (const x of made) {
  await call('弃审', { 编号: x })
  const del = await call('删除单据', { 编号: x })
  console.log('清场', x, '删除 →', del.body?.code)
}
console.log(fail === 0 ? '\n[RESULT] PASS' : `\n[RESULT] FAIL(${fail} 项)`)
process.exit(fail === 0 ? 0 : 1)
