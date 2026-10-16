/*
 * _verify-asm-insp-func-save.mjs — 成品检验单新增字段(客户名称/产线常规功能性结果/结果判断)真落库实测
 * (2026-10-16,一次性探针)
 *
 * 为什么在**测试账套**(factory=YJ_TEST → HSDZ_MES_TEST):要真写库才能证明落库,正式账套只录真实业务。
 * 流程:建探针草稿 → 存一行(含两个新明细列)+ 表头 客户名称 → 重新取数逐一读回 → **删除探针单**。
 *
 * 用法: node tools/archive/_verify-asm-insp-func-save.mjs [http://127.0.0.1:8090]
 */
const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const PANEL = 'QC_ASM_INSP'
const ITEM = '探针-功能性测试'
const FN = '99.1%'        // 产线常规功能性结果
const VERDICT = '合格'    // 结果判断
const CUST = '探针客户-勿用'  // 客户名称(表头)

let pass = 0, fail = 0
const ok = (n, c, x = '') => { c ? (pass++, console.log('  ok   - ' + n)) : (fail++, console.log('  FAIL - ' + n + (x ? '  | ' + x : ''))) }

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
}).then((r) => r.json())
if (!login.data?.token) { console.error('测试账套登录失败'); process.exit(1) }
ok('登录测试账套(factory=YJ_TEST)', login.data?.user?.factory === 'YJ_TEST', String(login.data?.user?.factory))
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.data.token }
const post = async (u, b) => (await fetch(`${BASE}${u}`, { method: 'POST', headers: H, body: JSON.stringify(b) }).then((r) => r.json()))
const callButton = (buttonName, formData) => post('/api/px/callButton', { panelCode: PANEL, buttonName, formData, buttonParam: {} })
const readDoc = async (no) => {
  const r = await post('/api/px/queryFormDataList', { panelCode: PANEL, condition: {}, pageNo: 1, pageSize: 200 })
  return (r.data?.list || r.data?.rows || []).find((x) => (x['单据编号'] || x['编号']) === no)
}

const created = await callButton('保存', {})
const no = created?.data?.['编号'] || created?.['编号']
ok('建探针草稿(测试账套)拿到编号', !!no, JSON.stringify(created).slice(0, 160))
if (!no) process.exit(1)
console.log('   探针单号 = ' + no)

const saved = await callButton('保存', {
  单据编号: no, 编号: no, 单据日期: '2026-10-16', 工单号: 'PROBE-FUNC-0001', 客户名称: CUST,
  detail: { items: [{ 表区: '功能性测试', 行号: 1, 检验项目: ITEM, 检验要求: '余氯去除率≥98%', 检验方法: '加标试验',
                      产线常规功能性结果: FN, 结果判断: VERDICT }] },
})
ok('保存(表头 客户名称 + 明细两个新列)成功', saved?.code === 200, JSON.stringify(saved).slice(0, 240))

const doc = await readDoc(no)
ok('表头「客户名称」落库并读回', doc && doc['客户名称'] === CUST, '读回=' + JSON.stringify(doc?.['客户名称']))
const row = (doc?.detail?.items || []).find((r) => r['检验项目'] === ITEM)
ok('明细行读回(含两个新列)', !!row, JSON.stringify(doc?.detail?.items || []).slice(0, 240))
if (row) {
  ok('「产线常规功能性结果」落库并读回', row['产线常规功能性结果'] === FN, '读回=' + JSON.stringify(row['产线常规功能性结果']))
  ok('「结果判断」落库并读回', row['结果判断'] === VERDICT, '读回=' + JSON.stringify(row['结果判断']))
}

const del = await callButton('删除', { 编号: no, 单据编号: no })
const gone = await readDoc(no)
ok('清理:探针单已删除(测试账套不留痕)', del?.code === 200 && !gone, 'del=' + JSON.stringify(del).slice(0, 140) + ' 仍在=' + !!gone)

console.log(`\n==== 结果:${pass} 通过 / ${fail} 失败 ====`)
process.exit(fail > 0 ? 1 : 0)
