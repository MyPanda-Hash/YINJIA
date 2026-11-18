/**
 * _probe-before-fix-20261117.mjs — **修前取证**:用正确载荷(detail.items)复验「合格数量为空」能不能存/能不能审。
 *
 * 2026-11-17 在测试库跑过一次,结果记在 README §2(缺键保存 200、草稿审核 200 都是这里测出来的)。
 * ⚠ 它会在测试库(HSDZ_MES_TEST)造单据且**不自动清场**,别随手重跑;要回归请用 _verify-okqty-required-20261117.mjs。
 */
const BASE = 'http://127.0.0.1:8090/api'
const PANEL = 'QC_INSP'
const login = await (await fetch(`${BASE}/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
})).json()
const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${login.data.token}` }
const post = async (url, body) => {
  const res = await fetch(BASE + url, { method: 'POST', headers: auth, body: JSON.stringify(body) })
  return { status: res.status, body: await res.json() }
}
const today = new Date().toISOString().slice(0, 10)
const base = { 单据日期: today, 供应商: '福建鑫恒碳业有限公司', 物料编码: 'YJ-XH-002' }

const cases = [
  { name: '① 行里「合格数量」键在、值为 null', items: [{ 物料编码: 'YJ-XH-002', 送检数量: 10, 合格数量: null }] },
  { name: '② 行里没有「合格数量」这个键', items: [{ 物料编码: 'YJ-XH-002', 送检数量: 10 }] },
]
const made = []
for (const c of cases) {
  console.log('\n=== ' + c.name + ' ===')
  const form = { ...base, 编号: '', detail: { items: c.items } }
  const save = await post('/px/callButton', { panelCode: PANEL, buttonName: '保存', formData: form })
  console.log('  「保存」→', save.status, JSON.stringify(save.body).slice(0, 260))
  const no1 = save.body?.data?.编号
  if (no1) made.push(no1)
  // 再试「保存为草稿」:按用户口径草稿不校验必填,应当成功
  const draft = await post('/px/callButton', { panelCode: PANEL, buttonName: '保存为草稿', formData: form })
  console.log('  「保存为草稿」→', draft.status, JSON.stringify(draft.body).slice(0, 200))
  if (draft.body?.data?.编号) made.push(draft.body.data.编号)
  // 对草稿直接审核:这条路径根本不做必填校验
  const no = no1 || draft.body?.data?.编号
  if (no) {
    const audit = await post('/px/callButton', { panelCode: PANEL, buttonName: '审核', formData: { 编号: no } })
    console.log('  「审核」' + no + ' →', audit.status, JSON.stringify(audit.body).slice(0, 200))
  }
}
console.log('\n本次造的单据 =', JSON.stringify([...new Set(made)]))
