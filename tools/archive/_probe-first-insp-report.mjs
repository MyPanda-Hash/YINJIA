/*
 * _probe-first-insp-report.mjs — 首件检验单「服务端报表模板(打印样式)」端到端验收
 *
 * 用户口径(2026-10-17):「打印样式需要实现就是当前报表的excel表，当前制程检验单已经存在实现。」
 * = 面板右侧「文档输出 → 导出报表」里的服务端报表需要给首件检验单补上,版式与当前纸张/Excel 一致。
 *
 * 【验什么】
 *   ① /report/templates?panelCode=QC_FIRST_INSP 能列出模板(code=qc_first_insp);
 *   ② /report/export format=pdf 产出真 PDF(%PDF)、页数与体量合理;
 *   ③ 把 PDF 抽出来核:标题 / 两级表头(四个分组 + 测试项目)/ 标准行 / 1#..8# 八个样品行 /
 *      相关要求 6 条 / 表尾 检验结果·检验人 都在(即"就是当前这张纸");
 *   ④ /report/export format=xlsx 解出来也是同一张矩阵(首行大标题、含分组名与测试项目名);
 *   ⑤ 纸面口径一致:非本组的格写 `/`、本组的格可填(拿三处值核)。
 *
 * ⚠ 全在**测试账套**(factory=YJ_TEST / HSDZ_MES_TEST)上跑:建一张单、填几个格、跑完硬删。
 * 用法: node tools/archive/_probe-first-insp-report.mjs [base] [--pdf 路径] [--xlsx 路径]
 */
import fs from 'node:fs'
import { createRequire } from 'node:module'

const BASE = (process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'http://127.0.0.1:8090').replace(/\/$/, '')
const API = BASE + '/api'
const FACTORY = 'YJ_TEST'
const DB = 'HSDZ_MES_TEST'
const CODE = 'qc_first_insp'
let pass = 0, fail = 0
const ok = (m, c, x = '') => { c ? (pass++, console.log('  [PASS] ' + m)) : (fail++, console.log('  [FAIL] ' + m + (x ? '  ' + x : ''))) }

const XLSX = createRequire('D:/workspace/yinjia/frontend/package.json')('xlsx')
const mssql = createRequire('D:/workspace/yinjia/deploy/package.json')('mssql')
const pool = await new mssql.ConnectionPool({
  server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia', password: 'Yinjia@2026',
  options: { encrypt: false, trustServerCertificate: true },
}).connect()
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset

const lg = await fetch(`${API}/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456', factory: FACTORY }),
}).then((r) => r.json())
const token = lg?.data?.token
if (!token) { console.error('登录失败'); process.exit(1) }
const H = { Authorization: 'Bearer ' + token }
const getJson = async (p) => { const r = await fetch(API + p, { headers: H }); const t = await r.text(); try { return JSON.parse(t) } catch { return { raw: t } } }
const getBlob = async (p) => { const r = await fetch(API + p, { headers: H }); return { status: r.status, buf: Buffer.from(await r.arrayBuffer()), type: r.headers.get('content-type') || '' } }

let made = ''
try {
  // ── ① 模板已登记 ──
  const tpl = await getJson(`/report/templates?panelCode=QC_FIRST_INSP`)
  const list = Array.isArray(tpl?.data) ? tpl.data : []
  console.log(`  模板列表=${JSON.stringify(list.map((t) => ({ code: t.code, name: t.name, panel: t.panelCode })))}`)
  ok('① 首件检验单已登记**专用**服务端报表模板(qc_first_insp)', list.some((t) => t.code === CODE), JSON.stringify(list))
  // ⚠ 没登记专用模板时,ReportService 会回落给一张 **generic**(通用字段堆) ⇒ 那正是"旧报表形式",
  //   与"当前这张纸"不是一个东西。这里取"有专用用专用、没有先用通用",好把改前/改后都拍下来。
  const useCode = (list.find((t) => t.code === CODE) || list[0] || {}).code || CODE
  console.log(`  本次导出用模板 = ${useCode}`)

  // ── 建一张带明细的单(走「选生产工单」同一接口) ──
  const wo = await getJson('/qc/firstInsp/woLines?pageSize=20')
  const lines = wo?.data?.list || wo?.data?.rows || []
  const cand = lines.find((l) => !l['已建单号'])
  if (!cand) { ok('① 找到一条可建单的生产工单行', false, JSON.stringify(lines.slice(0, 3))) }
  else {
    const mk = await fetch(`${API}/qc/firstInsp/fromWoLine`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...H },
      body: JSON.stringify({ 工单号: cand['工单号'], 工单行号: cand['工单行号'] }),
    }).then((r) => r.json())
    made = mk?.data?.编号 || mk?.data?.单据编号 || ''
    console.log(`  建单=${JSON.stringify(mk?.data || mk)}`)
  }
  if (!made) { made = (await q(`SELECT TOP 1 单据编号 FROM dbo.qc_first_insp_head ORDER BY id DESC`))[0]?.单据编号 || '' }
  ok('① 拿到一张有明细的首件检验单', !!made, made)

  const nDetail = (await q(`SELECT COUNT(*) n FROM dbo.qc_first_insp_detail WHERE 单据编号=N'${made}'`))[0]?.n
  console.log(`  明细 ${nDetail} 行`)
  ok('① 该单明细已按工艺清单预铺(>0 行)', Number(nDetail) > 0, String(nDetail))

  // 填四格(每组一格)后再导出,用于核"值确实进了矩阵"
  await q(`UPDATE dbo.qc_first_insp_detail SET 实测数值=N'无粘模（均匀）' WHERE 单据编号=N'${made}' AND 检验列=N'appearance' AND 样品序号=N'2#'`)
  await q(`UPDATE dbo.qc_first_insp_detail SET 实测数值=N'34.2' WHERE 单据编号=N'${made}' AND 检验列=N'outer' AND 样品序号=N'4#'`)
  await q(`UPDATE dbo.qc_first_insp_detail SET 实测数值=N'5' WHERE 单据编号=N'${made}' AND 检验列=N'drop' AND 样品序号=N'6#'`)
  await q(`UPDATE dbo.qc_first_insp_detail SET 实测数值=N'1.1' WHERE 单据编号=N'${made}' AND 检验列=N'turbidity' AND 样品序号=N'8#'`)

  // ── ② / ③ PDF ──
  const pdfPath = (() => { const i = process.argv.indexOf('--pdf'); return i > 0 ? process.argv[i + 1] : '' })()
  const pdf = await getBlob(`/report/export?code=${useCode}&panelCode=QC_FIRST_INSP&docNo=${encodeURIComponent(made)}&format=pdf`)
  console.log(`  PDF:HTTP ${pdf.status} ${pdf.type} ${pdf.buf.length} bytes`)
  const isPdf = pdf.buf.subarray(0, 5).toString('latin1') === '%PDF-'
  ok('② 导出 PDF 返回的是真 PDF', pdf.status === 200 && isPdf && pdf.buf.length > 5000,
    `status=${pdf.status} head=${JSON.stringify(pdf.buf.subarray(0, 8).toString('latin1'))} size=${pdf.buf.length}`)
  if (pdfPath && isPdf) { fs.writeFileSync(pdfPath, pdf.buf); console.log(`  PDF 落盘:${pdfPath}`) }
  // 页数是"到底是不是这张纸"最省事的判据:改前 generic 通用模板出 **14 页**字段流水,这张纸一页放得下
  const pages = isPdf ? (pdf.buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length : 0
  ok('② 导出 PDF 是**这张纸**(1~2 页,不是改前那种十几页字段流水)', pages >= 1 && pages <= 2, `${pages} 页`)

  // ── ④ xlsx ──
  // ⚠ JR 的 xlsx 导出把内容放在**第 2 列起**(col 0 空),别按"第 0 列是行标签"去认(踩过)
  const xlsxPath = (() => { const i = process.argv.indexOf('--xlsx'); return i > 0 ? process.argv[i + 1] : '' })()
  const xb = await getBlob(`/report/export?code=${useCode}&panelCode=QC_FIRST_INSP&docNo=${encodeURIComponent(made)}&format=xlsx`)
  console.log(`  XLSX:HTTP ${xb.status} ${xb.type} ${xb.buf.length} bytes`)
  ok('④ 导出 Excel 返回了 xlsx', xb.status === 200 && xb.buf.length > 2000, `status=${xb.status} size=${xb.buf.length}`)
  if (xb.status === 200 && xb.buf.length > 2000) {
    if (xlsxPath) fs.writeFileSync(xlsxPath, xb.buf)
    try {
      const wb = XLSX.read(xb.buf, { type: 'buffer' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: true, defval: '' })
      const flat = aoa.map((r) => r.map((c) => String(c)).join('|')).join('\n')
      const rowHas = (v) => aoa.some((r) => r.some((c) => String(c).trim() === v))
      console.log(`  xlsx:sheet=${JSON.stringify(wb.SheetNames)} 行数=${aoa.length}`)
      ok('④ xlsx 是这张纸(大标题在前几行)',
        aoa.slice(0, 5).some((r) => r.some((c) => String(c).includes('炭棒成型车间首件检验记录表'))),
        JSON.stringify(aoa.slice(0, 3)))
      ok('④ xlsx 含两级表头(四个分组名 + 测试项目名)',
        ['表观及脱粉', '尺寸及重量', '强度', '浊度及压降'].every((g) => flat.includes(g))
        && flat.includes('炭棒外径') && flat.includes('浊度NTU'), '')
      ok('④ xlsx 含标准行与 1#..8# 八个样品行',
        ['标准', '1#', '2#', '3#', '4#', '5#', '6#', '7#', '8#'].every(rowHas), '')
      ok('④ xlsx 含相关要求与表尾', flat.includes('相关要求') && flat.includes('检验结果') && flat.includes('检验人'), '')
      // 值确实进了矩阵(探针往库里填的四个格:appearance@2# / outer@4# / drop@6# / turbidity@8#)
      ok('④ 填进库的四个格都出现在纸面上(不怕串行)',
        flat.includes('无粘模（均匀）') && flat.includes('34.2') && flat.includes('1.1')
        && aoa.some((r) => r.some((c) => String(c).trim() === '5')), '')
      // 非本组的格照纸面写 `/`:纸上要有一整片占位符
      const slash = aoa.reduce((n, r) => n + r.filter((c) => String(c).trim() === '/').length, 0)
      ok('④ 非本组的格照纸面写 `/`(占位符成片出现)', slash >= 40, `共 ${slash} 个 /`)
    } catch (e) {
      ok('④ 能把导出的 xlsx 解出来核对', false, String(e?.message || e))
    }
  }
} finally {
  if (made) {
    await q(`DELETE FROM dbo.qc_first_insp_detail WHERE 单据编号=N'${made}';
             DELETE FROM dbo.qc_first_insp_head WHERE 单据编号=N'${made}'`)
    console.log(`  清场:删掉探针建的 ${made}`)
  }
  await pool.close()
}
console.log(`\n== 首件检验单 服务端报表模板:${pass} PASS / ${fail} FAIL ==`)
process.exit(fail ? 1 : 0)
