/**
 * gen-asm-proc-lib.cjs — 组装工艺 4 变体标准库种子生成器(lib_code = 'asm.proc')
 *
 * 数据源:产品开发设计《2.产品文件\2.组装\关键控制清单--标准库.xlsx》
 *   4 个变体 sheet:裸棒 / 机器包布 / 复合半成品 / 成品
 *   列:A 工序 | B 工序控制内容 | C 管控要求 | 检查比例(第 2 行表头,数据从第 3 行起)
 *
 * 【为什么必须用生成器而不是手抄】
 *   设计 sheet 大量使用**合并单元格**:工序/检查比例 纵向合并、工序控制内容 横向多行。
 *   Excel 一个"视觉行"展开后是**多行**。2026-09-18 实测:成品变体展开是 **50 行**,
 *   而现有 RD_ASM_PROC_DT0.seedRows 只有 **21 条** —— 首次复刻时把合并单元格塌缩了,
 *   丢了约 2.4 倍的行,且 管控要求 有多条为空串。以设计为准重建。
 *
 * 【列位置必须按表头找,不能硬编码 §2026-09-20 修复】
 *   四个 sheet 的列布局**并不一致**:裸棒 sheet 的「管控要求」横向合并了 C:D,
 *   于是「检查比例」落在 **E 列(索引 4)**;其余三个 sheet 在 D 列(索引 3)。
 *   旧版硬编码 `cell(ws, r, 3)` 读 D 列 ⇒ 裸棒 4 道工序的 检查比例 **全为空串**
 *   (读到的 D 列是被合并吞掉的空格)。现在先在第 2 行表头里定位列,查不到即报错,
 *   绝不静默回落到某个猜测的列号。
 *
 * 【同工序重复块只保留首次 §2026-09-20 用户确认】
 *   设计《成品》sheet 把「套折叠棉/扎橡皮筋」「套PP棉」两个工序块写了**两遍**
 *   (第 21-25 行 与 第 36-40 行,工序名与四列内容逐字相同),判定为复制粘贴笔误。
 *   解析完成后按 (工序,工序控制内容,管控要求,检查比例) 四元组精确去重,只留首次出现的块;
 *   去重只在四列**完全一致**时命中,工序重名但内容不同的正常行不受影响。
 *
 * 【幂等去重键】lib_code + item_code(= 变体名)。一变体一条目,不像 insp.plan 那样同组多条,
 *   无需 quality 辅助键。缺值一律落 N'',绝不落 N'undefined'(否则会全量重插)。
 *
 * 【更新而非只插】条目 203-206 已在库里,纯 INSERT 的 IF NOT EXISTS 会让本次修复
 *   (裸棒 检查比例 / 成品去重)落不了地 ⇒ 改为「存在则 UPDATE content+seq+enabled,否则 INSERT」。
 *
 * 【容量】StdLibController.add/update 拒绝 content.length() > 4000。
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

/**
 * 取单元格文本(去首尾空白;空 → '')。
 *
 * ⚠ 数值单元格必须取**显示值 w**,不能取原始值 v:
 *   设计文件里 检查比例 有 7 格是「百分数格式的数字」(Excel 存 0.03、显示 3%)——
 *   照 v 取会把「3%」写成「0.03」、「10%」写成「0.1」,与设计不一致(实测)
 *   (裸棒·机器除尘 / 机器包布·机器除尘+机器包布 / 复合半成品·机器除尘 /
 *    成品·机器除尘+气枪吹灰+机器包布)。
 *   只对 t==='n' 取 w:文本格 w===v,不必换;数值格的 w 才是用户在 Excel 里看到的样子。
 */
function cell(ws, r, c) {
  const v = ws[XLSX.utils.encode_cell({ r, c })]
  if (v == null || v.v == null) return ''
  if (v.t === 'n' && v.w != null) return String(v.w).trim()
  return String(v.v).trim()
}

/** 轻量归一:折叠行内多余空白与空行,保留设计里的换行语义 */
function norm(s) {
  return String(s || '')
    .replace(/\r\n?/g, '\n')
    .split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trim()).filter(Boolean).join('\n')
}

/** 四列的数据键(= yj_field.label),顺序即 content.rows 的键顺序 */
const FIELDS = ['工序', '工序控制内容', '管控要求', '检查比例']

/**
 * 在第 2 行(0-based r=1)表头里定位每一列的索引。
 * 裸棒 sheet 的 管控要求 横向合并 C:D ⇒ 检查比例 在 E 列,硬编码列号会读空。
 */
function headerIndex(ws, item) {
  const range = XLSX.utils.decode_range(ws['!ref'])
  const idx = {}
  for (let c = range.s.c; c <= range.e.c; c++) {
    const h = cell(ws, 1, c)
    if (h && FIELDS.includes(h) && idx[h] === undefined) idx[h] = c
  }
  const missing = FIELDS.filter((f) => idx[f] === undefined)
  if (missing.length) {
    throw new Error(`${item} 第 2 行表头缺少列:${missing.join(', ')}`
      + `(实际表头:${Array.from({ length: range.e.c - range.s.c + 1 }, (_, i) => cell(ws, 1, range.s.c + i)).join('|')})`)
  }
  return idx
}

/** 四元组重复块检测(同工序名 + 四列逐字相同视为设计的复制粘贴重复) */
function dedupe(rows, item) {
  const seen = new Set()
  const out = []
  let dropped = 0
  for (const r of rows) {
    const key = FIELDS.map((f) => r[f]).join('\u0000')
    if (seen.has(key)) { dropped++; continue }
    seen.add(key)
    out.push(r)
  }
  if (dropped) console.log(`  · ${item}:去重丢弃 ${dropped} 个重复工序块`)
  return out
}

const entries = []
for (const { item, seq } of VARIANTS) {
  const ws = wb.Sheets[item]
  const range = XLSX.utils.decode_range(ws['!ref'])
  const idx = headerIndex(ws, item)
  const rows = []
  let cur = null
  for (let r = 2; r <= range.e.r; r++) {                       // 第 3 行起(0-based r=2)
    const gongxu = cell(ws, r, idx['工序'])
    const kongzhi = cell(ws, r, idx['工序控制内容'])
    const yaoqiu = cell(ws, r, idx['管控要求'])
    const bilv = cell(ws, r, idx['检查比例'])
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

  const deduped = dedupe(rows, item)
  const emptyRatio = deduped.filter((r) => !r.检查比例).length
  if (emptyRatio) console.warn(`  ! ${item}:${emptyRatio} 道工序的 检查比例 为空 —— 检查表头列定位`)
  for (const e of Object.entries(idx)) console.log(`  · ${item}:${e[0]} → 第 ${e[1] + 1} 列`)

  const content = JSON.stringify({ v: V, rows: deduped }, null, 0)
  const bytes = Buffer.byteLength(content, 'utf8')
  if (content.length > MAX_CONTENT) {
    throw new Error(`${item} content 长度 ${content.length} 超 StdLibController 上限 ${MAX_CONTENT}`)
  }
  entries.push({ item, seq, rows: deduped.length, content, len: content.length, bytes })
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
  '-- 列定位按第 2 行表头:裸棒 sheet 的 管控要求 横向合并 C:D ⇒ 检查比例 在 E 列。',
  '-- 存在则 UPDATE(本次修复必须能覆盖已入库的 203-206),否则 INSERT。',
  '-- 运行(UTF-8 无 BOM):sqlcmd -f 65001 -i tools/migrate-asm-proc-lib.sql 或 SqlRunner',
  'USE HSDZ_MES;',
  'SET NOCOUNT ON;',
  'GO',
  '',
]
for (const e of entries) {
  sql.push(`-- ── 变体「${e.item}」:${e.rows} 道工序,content ${e.len} 字符 ──`)
  sql.push(`IF EXISTS (SELECT 1 FROM yj_std_lib WHERE lib_code = N'asm.proc' AND item_code = ${nq(e.item)})`)
  sql.push(`  UPDATE yj_std_lib SET content = ${nq(e.content)}, seq = ${e.seq}, enabled = 1,`)
  sql.push(`         asp_user2 = N'seed', asp_time2 = SYSDATETIME()`)
  sql.push(`   WHERE lib_code = N'asm.proc' AND item_code = ${nq(e.item)};`)
  sql.push('ELSE')
  sql.push(`  INSERT INTO yj_std_lib (lib_code, item_code, seq, enabled, content, asp_user1, asp_time1)`)
  sql.push(`  VALUES (N'asm.proc', ${nq(e.item)}, ${e.seq}, 1, ${nq(e.content)}, N'seed', SYSDATETIME());`)
  sql.push('GO')
  sql.push('')
}
sql.push('SELECT lib_code, item_code, seq, enabled, LEN(content) AS content_len')
sql.push('FROM yj_std_lib WHERE lib_code = N\'asm.proc\' ORDER BY seq;')
sql.push('GO')
sql.push('')
// ⚠ 自检:本文件必须**以 UTF-8 代码页**执行(sqlcmd -f 65001,或 DbSync/pull-sync.bat 的 JDBC 路径)。
//   2026-09-20 实测踩坑:漏掉 -f 65001 时 sqlcmd 按控制台 GBK 读这个 UTF-8 文件,
//   文件里的 N'裸棒' 变成乱码字面量 ⇒ 上面的 IF EXISTS 匹配不上已有行 ⇒ **INSERT 出乱码孪生条目**
//   (item_code 是乱码、content 被双重编码、json 解析失败)。标准库选择框会把这些乱码变体原样列出来。
//   所以这里断言条目数:不等于 4 就说明库里混进了乱码变体,必须人工清理。
sql.push('IF (SELECT COUNT(*) FROM yj_std_lib WHERE lib_code = N\'asm.proc\') <> 4')
sql.push('  PRINT N\'⚠⚠ asm.proc 条目数不为 4:库里混进了乱码变体,标准库选择框会把它们列出来,需人工删除\'')
sql.push('ELSE')
sql.push('  PRINT N\'OK  asm.proc 恰好 4 个变体,无乱码孪生条目\';')
sql.push('GO')
sql.push('')
sql.push("PRINT N'migrate-asm-proc-lib.sql 完成:asm.proc 4 变体';")
sql.push('GO')
sql.push('')

fs.writeFileSync(OUT, sql.join('\n'), 'utf8')
const total = entries.reduce((s, e) => s + e.rows, 0)
console.log(`\nOK  ${path.relative(path.join(__dirname, '..'), OUT)}:${entries.length} 变体 / 合计 ${total} 工序行`)
