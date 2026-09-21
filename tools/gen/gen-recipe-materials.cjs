/**
 * gen-recipe-materials.cjs — 由设计源《20267月22日-最新烧结配方模板-1.xlsx》sheet「物料清单」
 * 生成 `tools/migrate-recipe-materials.sql`(84 种配方物料 + 含水率)。
 *
 * 为什么要有这个脚本而不是手写 84 行 INSERT:
 *   设计源是**权威清单**(物料种类/物料编号/物料名称/水分含量),手抄一遍必然出错且无人能复核;
 *   脚本把"从源到库"这一步变成可重跑、可 diff 的确定性过程。
 *
 * 源文件 = tools/archive/_walk/src-moldFormula-物料清单.txt(表格 walk 的产物,R2~R85 共 84 行)。
 *
 * 用法:node tools/gen/gen-recipe-materials.cjs
 * 产出:tools/migrate-recipe-materials.sql(幂等:有则只补空的水分含量,绝不覆盖已维护的值)
 */
'use strict'

const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.join(__dirname, '..', '..')
const SRC = path.join(ROOT, 'tools', 'archive', '_walk', 'src-moldFormula-物料清单.txt')
const OUT = path.join(ROOT, 'tools', 'migrate-recipe-materials.sql')

const text = fs.readFileSync(SRC, 'utf8')
const rows = []
for (const line of text.split(/\r?\n/)) {
  const m = line.match(/^R(\d+): \[A\]=(.+?)(?: \[B\]=(.+?))?(?: \[C\]=(.+?))?(?: \[D\]=(.+?))?$/)
  if (!m) continue
  const [, no, kind, code, name, moisture] = m
  if (String(kind).trim() === '物料种类') continue            // 表头行
  if (!code) continue
  rows.push({
    no: Number(no),
    kind: String(kind).trim(),
    code: String(code).trim(),
    name: String(name || '').trim(),
    moisture: moisture === undefined ? null : Number(String(moisture).trim()),
  })
}

if (rows.length !== 84) throw new Error(`期望 84 行(设计源 A1:D85),实际解析到 ${rows.length} 行`)
const dup = rows.map((r) => r.code).filter((c, i, a) => a.indexOf(c) !== i)
if (dup.length) throw new Error('物料编号有重复:' + dup.join(','))
const badMoisture = rows.filter((r) => r.moisture !== null && !(r.moisture > 0 && r.moisture < 1))
if (badMoisture.length) throw new Error('水分含量不在 (0,1) 区间:' + JSON.stringify(badMoisture))

const withMoisture = rows.filter((r) => r.moisture !== null)
const byKind = rows.reduce((acc, r) => { acc[r.kind] = (acc[r.kind] || 0) + 1; return acc }, {})
const q = (s) => "N'" + String(s).replace(/'/g, "''") + "'"

const lines = []
lines.push(`/* ============================================================================
   migrate-recipe-materials.sql —— 84 种配方物料 + 含水率(配料计算的数据底座)
   ============================================================================
   ⚠ 本文件由 tools/gen/gen-recipe-materials.cjs 从设计源自动生成,不要手改。
     设计源:《20267月22日-最新烧结配方模板-1.xlsx》sheet「物料清单」(A1:D85,84 行)
     重新生成:node tools/gen/gen-recipe-materials.cjs

   三件事:
     ① bs_inv(商品/存货档案)补「水分含量」列 + 中文注明(AGENTS 硬规范:建表/改表必须注明)
     ② 把 84 种配方物料**按需**播种进 bs_inv —— 已存在的按存货编码跳过(正式库 3850 行里
        多半已经有这些物料,绝不能造重复行);水分含量只在为空时补,不覆盖人工维护过的值
     ③ 登记 yj_field(商品面板可见可维护)+ en 译名

   口径:CONTEXT.md「配方计算器」/ docs/adr/0004 —— 含水率是物料的固有属性,一次维护长期复用;
   弹窗按物料编号自动带出,档案没有的才在弹窗里手填。
   幂等:可重复执行;两个账套都要跑(先正式 HSDZ_MES、后测试 HSDZ_MES_TEST)。
   ============================================================================ */

SET NOCOUNT ON;
GO

/* ── ① bs_inv 补「水分含量」列(decimal(9,4):0.055 这类三位小数的含水率要存得下)── */
IF COL_LENGTH('bs_inv', N'水分含量') IS NULL
BEGIN
    ALTER TABLE bs_inv ADD [水分含量] decimal(9,4) NULL;
    PRINT N'migrate-recipe-materials.sql:bs_inv 补列 水分含量';
END
ELSE PRINT N'migrate-recipe-materials.sql:bs_inv.水分含量 已存在';
GO

/* 中文列注明(照 migrate-table-comments.sql 的口径:已有则不覆盖,不先删后加) */
IF NOT EXISTS (SELECT 1 FROM sys.extended_properties
               WHERE major_id = OBJECT_ID('bs_inv')
                 AND minor_id = COLUMNPROPERTY(OBJECT_ID('bs_inv'), N'水分含量', 'ColumnId')
                 AND name = 'MS_Description')
    EXEC sp_addextendedproperty N'MS_Description', N'物料含水率(小数,0.05=5%);配方计算用它把干重换算成灌料湿重', N'SCHEMA', N'dbo', N'TABLE', N'bs_inv', N'COLUMN', N'水分含量';
GO

/* ── ② 84 种配方物料:按需播种(有则跳过;水分含量只补空)── */
PRINT N'--- 播种 84 种配方物料(已存在的跳过)---';
`)

for (const r of rows) {
  const moist = r.moisture === null ? 'NULL' : String(r.moisture)
  // ⚠ T-SQL 的 BEGIN…END 里必须至少有一条语句(只放注释会报"关键字 BEGIN/IF 附近有语法错误"),
  //   所以设计源没给含水率的物料**不生成 ELSE 分支**,只保留"不存在则播种"。
  lines.push(`IF NOT EXISTS (SELECT 1 FROM bs_inv WHERE RTRIM([存货编码]) = ${q(r.code)})
    INSERT INTO bs_inv ([所属类别], [存货编码], [存货名称], [水分含量], [状态], [数据来源], asp_user1, asp_time1)
    VALUES (${q(r.kind)}, ${q(r.code)}, ${q(r.name)}, ${moist}, N'启用', N'配方物料种子', 'system', SYSDATETIME());`)
  if (r.moisture !== null) {
    lines.push(`ELSE
    UPDATE bs_inv SET [水分含量] = ${moist} WHERE RTRIM([存货编码]) = ${q(r.code)} AND [水分含量] IS NULL;`)
  }
}
lines.push('GO')
lines.push('')
lines.push(`/* ── ③ 登记 yj_field:商品面板可见可维护(place=query,detail ⇒ 列表出列、详情可编)── */
IF NOT EXISTS (SELECT 1 FROM yj_field WHERE panel_code = 'INV' AND col_name = N'水分含量')
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field, display_field, place, seq, width, editable, required, hidden, visible)
    VALUES ('INV', N'水分含量', N'水分含量', N'小数', NULL, NULL, NULL, NULL, N'query,detail', 65, 100, 1, 0, 0, 1);
GO

/* en 译名(AGENTS 多语言规范:新增字段必须带译名;其余语言由机翻兜底) */
IF NOT EXISTS (SELECT 1 FROM yj_translation WHERE scope = 'field' AND ref_key = N'水分含量' AND locale = 'en')
    INSERT INTO yj_translation (scope, ref_key, locale, text, source) VALUES ('field', N'水分含量', 'en', N'Moisture', 'manual');
GO

/* ── 核验 ── */
SELECT COUNT(*) AS 配方物料在库数 FROM bs_inv WHERE [数据来源] = N'配方物料种子';
SELECT COUNT(*) AS 有含水率的物料数 FROM bs_inv WHERE [数据来源] = N'配方物料种子' AND [水分含量] IS NOT NULL;
SELECT TOP 5 [存货编码], [存货名称], [所属类别], [水分含量] FROM bs_inv WHERE [数据来源] = N'配方物料种子' ORDER BY id;
GO
`)

fs.writeFileSync(OUT, lines.join('\n'), 'utf8')
console.log(`已生成 ${path.relative(ROOT, OUT)}`)
console.log(`  物料 ${rows.length} 种:${Object.entries(byKind).map(([k, v]) => `${k} ${v}`).join(' / ')}`)
console.log(`  其中带含水率 ${withMoisture.length} 种(${withMoisture.map((r) => r.code).length} 个编号),其余 ${rows.length - withMoisture.length} 种设计源未给(不参与湿重换算)`)
