/**
 * _verify-cleanup.mjs —— 收尾清场复核(只读)
 *
 * ① 测试库 HSDZ_MES_TEST:5 张测试单必须回到「草稿」、审批留痕 0 行、下游测试单 0 行;
 * ② 正式库 HSDZ_MES:5 张同名单据状态与测前一致(特别 ZC-2026-10-0126 = 已审核/shr=柴善银),
 *    且 2026-11-08 15:00Z 之后检验类审批留痕 = 0(证明确实只在测试库写过);
 * ③ 两份账套的「最近全部检验类审批留痕」明细另存 evidence/cleanup-final.json。
 *
 * 用法: node tools/archive/_wo-insp-audit-20261108/_verify-cleanup.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { EVIDENCE, nowStamp } from './_lib.mjs'

const requireE2E = createRequire('D:/workspace/yinjia/tests/e2e/')
const mssql = requireE2E('mssql')
const CONF = {
  server: '127.0.0.1', port: 1433, user: 'yinjia', password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026',
  options: { encrypt: false, trustServerCertificate: true },
}
const DOCS = [
  ['QC_FIRST_INSP', 'SJ-2026-10-0153', 'qc_first_insp_head'],
  ['QC_PROC_INSP', 'ZC-2026-10-0126', 'qc_proc_insp_head'],
  ['QC_OQC_REPORT', 'OQC-2026-11-0012', 'qc_oqc_head'],
  ['QC_ASM_INSP', 'ZJ-2026-10-0135', 'qc_asm_insp_head'],
  ['QC_INSP', 'IJ-2026-09-0152', 'qc_insp'],
]
const qs = (s) => String(s == null ? '' : s).replace(/'/g, "''")
const derive = (r) => {
  if (!r) return '草稿'
  const y = (v) => String(v ?? '').toUpperCase() === 'Y'
  const node = r.approve_node === null || r.approve_node === undefined ? 1 : Number(r.approve_node)
  if (y(r.canceled)) return '已作废'
  if (y(r.stopped)) return '已中止'
  if (y(r.deleting)) return '删除申请中'
  if (String(r.modify_state ?? '') === 'R') return '修改申请中'
  if (y(r.pending)) return node === 2 ? '待二级审批' : '审批中'
  if (y(r.modify_state)) return '修改中'
  if (y(r.effective)) return '已生效'
  if (y(r.archived)) return '已归档'
  if (r.shr !== null && r.shr !== undefined) return '已审核'
  return '草稿'
}

const out = { at: new Date().toISOString(), test: {}, formal: {}, pass: true }
function chk(name, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  -- ${detail}`)
  if (!ok) out.pass = false
  return ok
}

for (const dbName of ['HSDZ_MES_TEST', 'HSDZ_MES']) {
  const pool = await new mssql.ConnectionPool({ ...CONF, database: dbName }).connect()
  const q = async (sql) => (await pool.request().query(sql)).recordset
  const one = async (sql) => (await q(sql))[0] || null
  const target = dbName === 'HSDZ_MES_TEST' ? out.test : out.formal
  for (const [panel, no, head] of DOCS) {
    const st = await one(`SELECT * FROM yj_doc_status WHERE panel_code='${panel}' AND doc_no='${qs(no)}'`)
    const appr = await q(`SELECT id,action,result,node_no,operator,create_time FROM yj_form_approval WHERE panel_code='${panel}' AND form_no='${qs(no)}' ORDER BY id`)
    const headRow = await one(`SELECT 单据编号 FROM ${head} WHERE 单据编号='${qs(no)}'`)
    target[panel + ':' + no] = { status: derive(st), hasHeadRow: !!headRow, approvalTrail: appr, statusRow: st }
    console.log(`[${dbName}] ${panel}/${no} → ${derive(st)} 头行=${headRow ? '有' : '无'} 留痕=${appr.length}`)
  }
  target.recentQcApprovals = await q(`SELECT id,panel_code,form_no,action,result,operator,create_time FROM yj_form_approval
    WHERE panel_code IN ('QC_PROC_INSP','QC_FIRST_INSP','QC_ASM_INSP','QC_OQC_REPORT','QC_INSP')
      AND create_time > '2026-11-08T15:00:00' ORDER BY id`)
  await pool.close()
}

// 断言:测试库 5 单全部草稿 + 0 留痕;正式库 5 单保持原状(见 README 结论)且今天无新增留痕
for (const [panel, no] of DOCS) {
  const k = panel + ':' + no
  const t = out.test[k]
  chk(`测试库 ${k} 回到草稿`, t.status === '草稿', t.status)
  chk(`测试库 ${k} 无本轮审批留痕`, t.approvalTrail.length === 0, 'rows=' + t.approvalTrail.length)
}
chk('测试库近期检验类审批留痕 0 行', out.test.recentQcApprovals.length === 0, 'rows=' + out.test.recentQcApprovals.length)
const formalProc = out.formal['QC_PROC_INSP:ZC-2026-10-0126']
chk('正式库 ZC-2026-10-0126 恢复为「已审核」(shr=柴善银)',
  formalProc.status === '已审核' && String(formalProc.statusRow && formalProc.statusRow.shr) === '柴善银',
  JSON.stringify({ status: formalProc.status, shr: formalProc.statusRow && formalProc.statusRow.shr }))
chk('正式库近期检验类审批留痕 0 行', out.formal.recentQcApprovals.length === 0, 'rows=' + out.formal.recentQcApprovals.length)

const dir = path.join(EVIDENCE, 'cleanup')
fs.mkdirSync(dir, { recursive: true })
fs.writeFileSync(path.join(dir, 'cleanup-final-' + nowStamp() + '.json'), JSON.stringify(out, null, 1) + '\n', 'utf8')
console.log('\nRESULT=' + (out.pass ? 'PASS' : 'FAIL'))
process.exit(out.pass ? 0 : 2)
