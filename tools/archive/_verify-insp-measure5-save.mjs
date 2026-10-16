/*
 * _verify-insp-measure5-save.mjs — 「5 个测量值能真落库」端到端实测(2026-10-16,一次性探针)
 *
 * 为什么在**测试账套**(factory=YJ_TEST → HSDZ_MES_TEST)跑:要真写库才能证明落库,
 * 而正式账套只录真实业务 —— 所以本探针:建一张探针草稿 → 存一行带 5 个测量值的明细 →
 * 重新取数核对(值从库里读回来)→ **删除该探针单**(不留痕)。
 *
 * 断言:
 *   ① 建单成功拿到编号;② 保存 5 个测量值成功;③ 重新取数,5 个值逐一读回一致(真落库);
 *   ④ 清理:探针单已删除(在测试账套里不留测试数据)。
 *
 * 用法: node tools/archive/_verify-insp-measure5-save.mjs [http://127.0.0.1:8090]
 */
const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const PANEL = 'QC_ASM_INSP'
const ITEM = '探针-五格测量值'
const VALUES = [11.1, 22.2, 33.3, 44.4, 55.5]

let pass = 0, fail = 0
const ok = (n, c, x = '') => { c ? (pass++, console.log('  ok   - ' + n)) : (fail++, console.log('  FAIL - ' + n + (x ? '  | ' + x : ''))) }

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
}).then((r) => r.json())
if (!login.data?.token) { console.error('测试账套登录失败:', JSON.stringify(login).slice(0, 200)); process.exit(1) }
ok('登录到测试账套(factory=YJ_TEST)', login.data?.user?.factory === 'YJ_TEST', String(login.data?.user?.factory))
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.data.token }
const post = async (u, b) => (await fetch(`${BASE}${u}`, { method: 'POST', headers: H, body: JSON.stringify(b) }).then((r) => r.json()))
const callButton = (buttonName, formData) => post('/api/px/callButton', { panelCode: PANEL, buttonName, formData, buttonParam: {} })
const readDoc = async (no) => {
  const r = await post('/api/px/queryFormDataList', { panelCode: PANEL, condition: {}, pageNo: 1, pageSize: 200 })
  const list = r.data?.list || r.data?.rows || []
  return list.find((x) => (x['单据编号'] || x['编号']) === no)
}

/* ① 建探针草稿 */
const created = await callButton('保存', {})
const no = created?.data?.['编号'] || created?.['编号']
ok('建单(测试账套)拿到编号', !!no, JSON.stringify(created).slice(0, 200))
if (!no) { console.log('\n无法建单,后续跳过'); process.exit(1) }
console.log('   探针单号 = ' + no)

const probeRow = { 表区: '检验项目', 行号: 1, 检验项目: ITEM }
VALUES.forEach((v, i) => { probeRow['测量值' + (i + 1)] = v })

/* ② 存一行带 5 个测量值的明细 */
const saved = await callButton('保存', {
  单据编号: no, 编号: no, 单据日期: '2026-10-16', 工单号: 'PROBE-M5-0001',
  detail: { items: [probeRow] },
})
ok('保存明细(含 测量值1..5)成功', saved?.code === 200, JSON.stringify(saved).slice(0, 300))

/* ③ 重新取数核对(值是从库里读回来的) */
const doc = await readDoc(no)
const back = (doc?.detail?.items || []).find((r) => r['检验项目'] === ITEM)
ok('重新取数找到该行', !!back, JSON.stringify(doc?.detail?.items || []).slice(0, 300))
if (back) {
  const bad = VALUES.filter((v, i) => Number(back['测量值' + (i + 1)]) !== v)
  ok('5 个测量值逐一读回一致(真落库)', bad.length === 0,
    '读回 = ' + VALUES.map((v, i) => back['测量值' + (i + 1)]).join(',') + ' 期望 = ' + VALUES.join(','))
}

/* ④ 清理探针单 */
const del = await callButton('删除', { 编号: no, 单据编号: no })
const gone = await readDoc(no)
ok('清理:探针单已删除(测试账套不留测试数据)', del?.code === 200 && !gone,
  'del=' + JSON.stringify(del).slice(0, 160) + ' 仍在=' + !!gone)

console.log(`\n==== 结果:${pass} 通过 / ${fail} 失败 ====`)
process.exit(fail > 0 ? 1 : 0)
