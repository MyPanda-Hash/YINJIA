/*
 * _verify-asm-insp-fixed-cells.mjs — 固定列「归一化合并」+「检验结果列」落格实测(2026-10-16,一次性探针)
 *
 * 造数(测试账套,用完删)一行:表区=外观、检验项目=**外观-端盖两头**(带表区前缀,模拟计划表带入)、
 *   检验结果=无异常、结果判断=合格 —— 导出后应看到:
 *     ① 外观组只有「端盖两头」**一列**(数据行的 外观-端盖两头 按归一化并进固定列,不重复成两列);
 *     ② 该列的格子里有 无异常(检验结果列)与 合格(行级判定);
 *     ③ 报表文本里**不出现**「外观-端盖两头」这个带前缀的长名。
 * 用法: node tools/archive/_verify-asm-insp-fixed-cells.mjs [base]
 */
const BASE = (process.argv[2] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const PANEL = 'QC_ASM_INSP'

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
  单据编号: no, 编号: no, 单据日期: '2026-10-16', 工单号: 'PROBE-FIXED-0001',
  detail: {
    items: [
      // ① 外观:带表区前缀的项目名(模拟计划表带入的「外观-端盖两头」)→ 应并进固定列「端盖两头」
      { 表区: '外观', 行号: 1, 检验项目: '外观-端盖两头', 检验结果: '无异常', 结果判断: '合格' },
      // ② 尺寸:整组一列的占位行(与「带入固定检验项」落的那行同名)→ 值进「按照尺寸检验项目填充」列
      { 表区: '尺寸', 行号: 2, 检验项目: '按照尺寸检验项目填充',
        测量值1: 44.5, 测量值2: 44.6, 测量值3: 44.5, 结果判断: '合格' },
      // ③ 出货重量:同上
      { 表区: '出货重量', 行号: 3, 检验项目: '按照重量检验项目填充', 测量值1: 178.2 }
    ]
  },
})
ok('保存三行(外观固定项 / 尺寸占位行 / 出货重量占位行)', saved?.code === 200, JSON.stringify(saved).slice(0, 200))

const res = await fetch(`${BASE}/api/report/export?code=qc_asm_insp&panelCode=${PANEL}&docNo=${encodeURIComponent(no)}&format=pdf`,
  { headers: { Authorization: H.Authorization } })
const buf = res.ok ? Buffer.from(await res.arrayBuffer()) : Buffer.alloc(0)
ok('导出报表 PDF 成功', res.status === 200 && buf.length > 1000, `status=${res.status} bytes=${buf.length}`)
if (buf.length > 1000) {
  const fs = await import('node:fs')
  const path = await import('node:path')
  const out = path.join(import.meta.dirname, `_verify-asm-insp-fixed-cells-${no}.pdf`)
  fs.writeFileSync(out, buf)
  console.log('   PDF: ' + out + '   ← 交给 tools/_PdfText.java 抽文本核对')
}
const del = await callButton('删除', { 编号: no, 单据编号: no })
ok('清理:探针单已删除', del?.code === 200, JSON.stringify(del).slice(0, 140))
console.log('   待核对单号 = ' + no)

console.log(`\n==== 结果:${pass} 通过 / ${fail} 失败 ====`)
process.exit(fail > 0 ? 1 : 0)
