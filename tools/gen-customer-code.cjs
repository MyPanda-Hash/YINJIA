/**
 * gen-customer-code.cjs — 生成客户项目代号标准库种子 SQL
 *
 * 数据源:设计《二三级四级项目控制表2026.xlsx》→ sheet《产品开发样品编号》
 *   38 行样例(样品编号 / 项目名称 / 项目编号) ⇒ 反推「项目名称 → 客户项目代号 XX」
 *
 * 口径(2026-09-18 已定,走 a):样品编号 = 客户项目代号 + 项目编号(直接拼接)
 *   故 XX = 样品编号去掉末尾的项目编号。逐样例校验 38/38 成立;无一对多代号。
 *
 * 映射键 = **项目名称**(不是客户名)——实测:同一客户名可对应多个项目名(飞利浦 7 个),
 * 用客户名做键会漏。
 *
 * 幂等去重键 = lib_code + item_code(项目名称);缺值落 N'' 绝不落 N'undefined'。
 * 用法:node tools/gen-customer-code.cjs
 */
const fs = require('fs')
const path = require('path')
const XLSX = require(path.join(__dirname, '..', 'frontend', 'node_modules', 'xlsx'))

const SRC = process.env.RD_DESIGN_XLSX
  || 'C:\\Users\\x1787\\OneDrive\\Desktop\\产品开发\\产品开发\\1.产品开发\\二三级四级项目控制表2026.xlsx'
const OUT = path.join(__dirname, 'migrate-customer-code-seed.sql')

const wb = XLSX.readFile(SRC)
const ws = wb.Sheets['产品开发样品编号']
if (!ws) throw new Error('sheet 产品开发样品编号 不存在')

/** 取单元格文本(B..G 列;行 5..49) */
function cell(r, c) {
  const ref = XLSX.utils.encode_cell({ r: r - 1, c: c - 1 })
  const v = ws[ref] && ws[ref].v
  return v == null ? '' : String(v).trim()
}

const pairs = []          // [项目名称, 代号]
const seen = new Map()    // 项目名称 -> 代号
const conflicts = []
let checked = 0

for (let r = 5; r <= 49; r++) {
  const no = cell(r, 2)      // B 样品编号
  const name = cell(r, 3)    // C 项目名称
  const pno = cell(r, 6)     // F 项目编号
  if (!no || !pno) continue
  checked++

  // XX = 样品编号 - 末尾的项目编号(逐样例校验口径 a)
  if (!no.endsWith(pno)) throw new Error(`口径校验失败: 样品编号 ${no} 不以项目编号 ${pno} 结尾`)
  const xx = no.slice(0, no.length - pno.length)
  if (!/^[A-Za-z]+$/.test(xx)) throw new Error(`客户代号非纯字母: ${xx} (样例 ${no})`)
  if (!name) continue        // FL201-2/FL206-2 等子项目行无项目名称,跳过

  if (seen.has(name) && seen.get(name) !== xx) conflicts.push(`${name}: ${seen.get(name)} vs ${xx}`)
  if (!seen.has(name)) { seen.set(name, xx); pairs.push([name, xx]) }
}

if (conflicts.length) throw new Error('一对多代号冲突:' + conflicts.join('; '))

const q = (s) => `N'${String(s).replace(/'/g, "''")}'`
const rows = pairs.map(([name, xx], i) => `  (${q(name)}, ${q(xx)}, ${i + 1})`).join(',\n')

const sql = `-- migrate-customer-code-seed.sql — 客户项目代号标准库种子(rd.customer_code)
--
-- 【自动生成,请勿手改】由 tools/gen-customer-code.cjs 从设计《二三级四级项目控制表2026.xlsx》
-- sheet《产品开发样品编号》38 个样例反推,共 ${pairs.length} 条(校验 ${checked} 行,代号一对多冲突 0)。
--
-- 口径:样品编号 = 客户项目代号 + 项目编号(确定性拼接,38/38 复现)
--       ⇒ 代号 = 样品编号去掉末尾项目编号。
-- 用法:标准库下拉 item_code=项目名称,content=代号;字段 RD_SAMPLE_NO.客户项目代号(data_type=标准库)。
--
-- 幂等去重键:lib_code + item_code(项目名称);可重复执行。
USE HSDZ_MES;
SET NOCOUNT ON;
GO

INSERT INTO yj_std_lib (lib_code, item_code, content, seq, enabled, asp_user1, asp_time1)
SELECT N'rd.customer_code', s.item, s.code, s.seq, 1, N'system', SYSDATETIME()
FROM (VALUES
${rows}
) AS s(item, code, seq)
WHERE NOT EXISTS (SELECT 1 FROM yj_std_lib l
                  WHERE l.lib_code = N'rd.customer_code' AND l.item_code = s.item);
GO

PRINT N'migrate-customer-code-seed.sql 完成:${pairs.length} 条客户项目代号';
GO
`

fs.writeFileSync(OUT, sql, 'utf8')
console.log(`OK  ${checked} 行样例校验通过, 生成 ${pairs.length} 条 → ${OUT}`)
console.log(`    代号分布: ${[...new Set(pairs.map((p) => p[1]))].sort().join(' ')}`)
