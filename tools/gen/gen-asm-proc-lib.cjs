/**
 * gen-asm-proc-lib.cjs — 组装工艺 4 变体标准库种子生成器(lib_code = 'asm.proc')
 *
 * 数据源:产品开发设计《2.产品文件\2.组装\关键控制清单--标准库.xlsx》
 *   4 个变体 sheet:裸棒 / 机器包布 / 复合半成品 / 成品
 *   列:A 工序 | B 工序控制内容 | C 管控要求 | D 检查比例(第 2 行表头,数据从第 3 行起)
 *
 * 【为什么必须用生成器而不是手抄】
 *   设计 sheet 大量使用**合并单元格**:工序(D 列)/检查比例 纵向合并、工序控制内容 横向多行。
 *   Excel 一个"视觉行"展开后是**多行**。2026-09-18 实测:成品变体展开是 **50 行**,
 *   而现有 RD_ASM_PROC_DT0.seedRows 只有 **21 条** —— 首次复刻时把合并单元格塌缩了,
 *   丢了约 2.4 倍的行,且 管控要求 有多条为空串。以设计为准重建。
 *
 * 【幂等去重键】lib_code + item_code(= 变体名)。一变体一条目,不像 insp.plan 那样同组多条,
 *   无需 quality 辅助键。缺值一律落 N'',绝不落 N'undefined'(否则会全量重插)。
 *
 * 【容量】StdLibController.add/update 拒绝 content.length() > 4000。
 *   实测 compact JSON:裸棒 813 / 机器包布 1347 / 复合半成品 1654 / 成品 3557(余量 443)。
 *   本生成器每次都会复测,超限直接报错。
 *
 * 产物:tools/migrate-asm-proc-lib.sql
 * 用法:node tools/gen-asm-proc-lib.cjs
 *      (设计文件路径可用环境变量 RD_ASM_DESIGN_XLSX 覆盖)
 */
'use strict'
const fs = require('node:fs')
const path = require('node:path')
const XLSX = require(path.join(__dirname, '..', '..', 'frontend', 'node_modules', 'xlsx'))

const SRC = process.env.RD_ASM_DESIGN_XLSX
  || 'C:\\Users\\x1787\\OneDrive\\Desktop\\产品开发\\产品开发\\2.产品文件\\2.组装\\关键控制清单--标准库.xlsx'
const OUT = path.join(__dirname, '..', 'migrate-asm-proc-lib.sql')

/** 4 变体(设计 sheet 名 = item_code);seq 决定下拉/列表顺序,沿用设计 sheet 顺序 */
const VARIANTS = [
  { item: '裸棒', seq: 10 },
  { item: '机器包布', seq: 20 },
  { item: '复合半成品', seq: 30 },
  { item: '成品', seq: 40 },
]

/** content 结构版本(与 RD_ASM_PROC_DT0.seedRows 的 row 形状一致:键 = yj_field.label) */
const V = 1
const MAX_CONTENT = 4000

const wb = XLSX.readFile(SRC)
const missing = VARIANTS.filter((v) => !wb.Sheets[v.item])
if (missing.length) throw new Error('设计文件缺少 sheet: ' + missing.map((v) => v.item).join(', '))

/** 取单元格文本(去首尾空白;空 → '') */
function cell(ws, r, c) {
  const v = ws[XLSX.utils.encode_cell({ r, c })]
  if (v == null || v.v == null) return ''
  return String(v.v).trim()
}

/** 轻量归一:折叠行内多余空白与空行,保留设计里的换行语义 */
function norm(s) {
  return String(s || '')
    .replace(/\r\n?/g, '\n')
    .split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trim()).filter(Boolean).join('\n')
}

const entries = []
for (const { item, seq } of VARIANTS) {
  const ws = wb.Sheets[item]
  const range = XLSX.utils.decode_range(ws['!ref'])
  const rows = []
  let cur = null
  for (let r = 2; r <= range.e.r; r++) {                       // 第 3 行起(0-based r=2)
    const gongxu = cell(ws, r, 0)
    const kongzhi = cell(ws, r, 1)
    const yaoqiu = cell(ws, r, 2)
    const bilv = cell(ws, r, 3)
    if (!gongxu && !kongzhi && !yaoqiu && !bilv) continue      // 空行跳过
    if (gongxu) {
      // 新工序行(工序列是纵向合并的起点)
      cur = { 工序: gongxu, 工序控制内容: norm(kongzhi), 管控要求: norm(yaoqiu), 检查比例: norm(bilv) }
      rows.push(cur)
    } else if (cur) {
      // 续行:把内容接到上一行(设计里合并单元格展开后就是这种续行)
      if (kongzhi) cur.工序控制内容 = [cur.工序控制内容, norm(kongzhi)].filter(Boolean).join('\n')
      if (yaoqiu) cur.管控要求 = [cur.管控要求, norm(yaoqiu)].filter(Boolean).join('\n')
      if (bilv) cur.检查比例 = [cur.检查比例, norm(bilv)].filter(Boolean).join('\n')
    } else {
      throw new Error(`${item} 第 ${r + 1} 行是续行但没有可归属的工序行`)
    }
  }
  if (!rows.length) throw new Error(`${item} 未解析出任何工序行`)

  const content = JSON.stringify({ v: V, rows }, null, 0)
  const bytes = Buffer.byteLength(content, 'utf8')
  if (content.length > MAX_CONTENT) {
    throw new Error(`${item} content 长度 ${content.length} 超 StdLibController 上限 ${MAX_CONTENT}`)
  }
  entries.push({ item, seq, rows: rows.length, content, len: content.length, bytes })
}

console.log('变体'.padEnd(12) + '工序行数'.padStart(8) + 'content 字符'.padStart(14) + ' UTF-8 字节'.padStart(12))
console.log('-'.repeat(48))
for (const e of entries) {
  console.log(String(e.item).padEnd(12) + String(e.rows).padStart(8) + String(e.len).padStart(14) + String(e.bytes).padStart(12))
}
console.log('-'.repeat(48))
console.log('上限(StdLibController)'.padEnd(26) + String(MAX_CONTENT).padStart(6))

const nq = (s) => "N'" + String(s).replace(/'/g, "''") + "'"
const sql = [
  '-- migrate-asm-proc-lib.sql — 组装工艺 4 变体标准库种子(lib_code=asm.proc)',
  '--',
  '-- 【生成物,勿手改】由 tools/gen-asm-proc-lib.cjs 从设计《关键控制清单--标准库.xlsx》4 个变体 sheet 生成。',
  '-- 生成器已展开设计的**合并单元格**(工序/检查比例纵向合并、工序控制内容横向多行)——',
  '-- 2026-09-18 实测:成品变体展开为 50 行,而旧 RD_ASM_PROC_DT0.seedRows 只有 21 条(首次复刻塌缩了合并单元格)。',
  '--',
  '-- content 结构:{v:1, rows:[{工序,工序控制内容,管控要求,检查比例}]}(键 = yj_field.label,直接可落 detail 行)。',
  '-- 幂等去重键:lib_code + item_code(= 变体名)。缺值落 N\'\',绝不落 N\'undefined\'(否则全量重插)。',
  '-- 运行(UTF-8 无 BOM):sqlcmd -f 65001 -i tools/migrate-asm-proc-lib.sql 或 SqlRunner',
  'USE HSDZ_MES;',
  'SET NOCOUNT ON;',
  'GO',
  '',
]
for (const e of entries) {
  sql.push(`-- ── 变体「${e.item}」:${e.rows} 道工序,content ${e.len} 字符 ──`)
  sql.push(`IF NOT EXISTS (SELECT 1 FROM yj_std_lib WHERE lib_code = N'asm.proc' AND item_code = ${nq(e.item)})`)
  sql.push(`INSERT INTO yj_std_lib (lib_code, item_code, seq, enabled, content, asp_user1, asp_time1)`)
  sql.push(`VALUES (N'asm.proc', ${nq(e.item)}, ${e.seq}, 1, ${nq(e.content)}, N'seed', SYSDATETIME());`)
  sql.push('GO')
  sql.push('')
}
sql.push('SELECT lib_code, item_code, seq, enabled, LEN(content) AS content_len')
sql.push('FROM yj_std_lib WHERE lib_code = N\'asm.proc\' ORDER BY seq;')
sql.push('GO')
sql.push('')
sql.push("PRINT N'migrate-asm-proc-lib.sql 完成:asm.proc 4 变体';")
sql.push('GO')
sql.push('')

fs.writeFileSync(OUT, sql.join('\n'), 'utf8')
const total = entries.reduce((s, e) => s + e.rows, 0)
console.log(`\nOK  ${path.relative(path.join(__dirname, '..'), OUT)}:${entries.length} 变体 / 合计 ${total} 工序行`)
