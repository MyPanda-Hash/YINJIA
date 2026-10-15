/*
 * _verify-asm-insp-report-cells.mjs — 「行的判定落在自己那一列」实测(2026-10-16,一次性探针)
 *
 * 用户口径:「当前各个行存在的判定结果就是这个的实际体现」⇒ 一行既有测量值又有 结果判断 时,
 * 两者都必须出现在**该检验项目自己的列**里(判定不能被测量值挤掉)。
 *
 * 做法(测试账套,可造数、用完删):
 *   ① 建探针单 → 存一行 测量值1/测量值2 + 结果判断=合格;
 *   ② 导出报表 PDF 落盘(交给 tools/_PdfText.java 抽文本);
 *   ③ 删掉探针单(不留痕)。
 * 用法: node tools/archive/_verify-asm-insp-report-cells.mjs [http://127.0.0.1:8090]
 */
const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const PANEL = 'QC_ASM_INSP'
const ITEM = '探针-测量值加判定'
const V1 = '11.1', V2 = '22.2', VERDICT = '合格'

let pass = 0, fail = 0
const ok = (n, c, x = '') => { c ? (pass++, console.log('  ok   - ' + n)) : (fail++, console.log('  FAIL - ' + n + (x ? '  | ' + x : ''))) }

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: 'YJ_TEST' }),
}).then((r) => r.json())
if (!login.data?.token) { console.error('测试账套登录失败'); process.exit(1) }
const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.data.token }
const post = async (u, b) => (await fetch(`${BASE}${u}`, { method: 'POST', headers: H, body: JSON.stringify(b) }).then((r) => r.json()))
const callButton = (buttonName, formData) => post('/api/px/callButton', { panelCode: PANEL, buttonName, formData, buttonParam: {} })

const created = await callButton('保存', {})
const no = created?.data?.['编号'] || created?.['编号']
ok('建探针草稿(测试账套)', !!no, JSON.stringify(created).slice(0, 160))
if (!no) process.exit(1)
console.log('   探针单号 = ' + no)

const saved = await callButton('保存', {
  单据编号: no, 编号: no, 单据日期: '2026-10-16', 工单号: 'PROBE-CELL-0001',
  detail: { items: [{ 表区: '功能性测试', 行号: 1, 检验项目: ITEM,
                      测量值1: Number(V1), 测量值2: Number(V2), 结果判断: VERDICT }] },
})
ok('保存 一行「测量值1+测量值2+结果判断」(同一行)', saved?.code === 200, JSON.stringify(saved).slice(0, 200))

const res = await fetch(`${BASE}/api/report/export?code=qc_asm_insp&panelCode=${PANEL}&docNo=${encodeURIComponent(no)}&format=pdf`,
  { headers: { Authorization: H.Authorization } })
const buf = res.ok ? Buffer.from(await res.arrayBuffer()) : Buffer.alloc(0)
ok('导出报表 PDF 成功', res.status === 200 && buf.length > 1000, `status=${res.status} bytes=${buf.length}`)
if (buf.length > 1000) {
  const fs = await import('node:fs')
  const path = await import('node:path')
  const out = path.join(import.meta.dirname, `_verify-asm-insp-report-cells-${no}.pdf`)
  fs.writeFileSync(out, buf)
  console.log('   PDF: ' + out + '  ← 交给 tools/_PdfText.java 抽文本核对')
}

const del = await callButton('删除', { 编号: no, 单据编号: no })
ok('清理:探针单已删除', del?.code === 200, JSON.stringify(del).slice(0, 160))
console.log('   探针单号(待抽文本核对)= ' + no)

console.log(`\n==== 结果:${pass} 通过 / ${fail} 失败 ====`)
process.exit(fail > 0 ? 1 : 0)
