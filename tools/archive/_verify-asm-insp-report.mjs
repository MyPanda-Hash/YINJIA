/*
 * _verify-asm-insp-report.mjs — 「组装成品检验记录表」导出实测(2026-10-16,一次性探针)
 *
 * 验:
 *   ① 面板有该模板(前端「导出报表」入口按它显隐):/api/report/templates?panelCode=QC_ASM_INSP 里能看到;
 *   ② 导 PDF/xlsx 成功(HTTP 200 + 有字节);
 *   ③ 版式**按当前明细里实际存在的检验项目动态生成** —— 落盘后由 tools/archive/_PdfText.java 抽文本核对:
 *      表头(检验时间/客户名称/产品编码/型号（mm）/批号/抽检总量/结果判断)+ 每个表区组名 + 每个检验项目名。
 * 用法: node tools/archive/_verify-asm-insp-report.mjs <panelCode> <docNo> [http://127.0.0.1:8090]
 */
import fs from 'node:fs'
import path from 'node:path'

const PANEL = process.argv[2] || 'QC_ASM_INSP'
const DOC = process.argv[3] || ''
const BASE = (process.argv[4] || 'http://127.0.0.1:8090').replace(/\/$/, '')
const FACTORY = process.argv[5] || 'YJ'          // YJ=正式账套;YJ_TEST=测试账套
const HERE = import.meta.dirname

let pass = 0, fail = 0
const ok = (n, c, x = '') => { c ? (pass++, console.log('  ok   - ' + n)) : (fail++, console.log('  FAIL - ' + n + (x ? '  | ' + x : ''))) }

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: FACTORY }),
}).then((r) => r.json())
if (!login.data?.token) { console.error('登录失败'); process.exit(1) }
const H = { Authorization: 'Bearer ' + login.data.token }

/* ① 模板在不在 */
const tpls = await fetch(`${BASE}/api/report/templates?panelCode=${PANEL}`, { headers: H }).then((r) => r.json())
const list = tpls.data || []
console.log('   模板: ' + JSON.stringify(list).slice(0, 300))
ok('面板已登记「组装成品检验记录表」模板', list.some((t) => t.code === 'qc_asm_insp' || t.templateCode === 'qc_asm_insp'),
  JSON.stringify(list).slice(0, 200))

/* ② 导出 */
const url = `${BASE}/api/report/export?code=qc_asm_insp&panelCode=${PANEL}&docNo=${encodeURIComponent(DOC)}&format=pdf`
const res = await fetch(url, { headers: H })
const buf = res.ok ? Buffer.from(await res.arrayBuffer()) : Buffer.alloc(0)
console.log(`   导出: HTTP ${res.status}, ${buf.length} 字节`)
ok('导出 PDF 成功(HTTP 200 且有字节)', res.status === 200 && buf.length > 1000, `status=${res.status} bytes=${buf.length}`)
if (buf.length > 1000) {
  const out = path.join(HERE, `_verify-asm-insp-report-${DOC}.pdf`)
  fs.writeFileSync(out, buf)
  console.log('   PDF: ' + out)
}

console.log(`\n==== 结果:${pass} 通过 / ${fail} 失败 ====`)
process.exit(fail > 0 ? 1 : 0)
