// _gen-fourdoc-restore.mjs — 生成《采购链四单》yj_field 回正迁移脚本
//   输入:tools/archive/_dump-out/fields-HSDZ_MES.md(2026-10-03 基线 dump,git HEAD 版本 = 生成基线文档的那份输入)
//   输出:tools/migrate-fourdoc-baseline-restore-20261008.sql
//   用法:node tools/archive/_gen-fourdoc-restore.mjs
import fs from 'node:fs'
import crypto from 'node:crypto'
import { execSync } from 'node:child_process'

const SRC = 'tools/archive/_dump-out/_head-fields-HSDZ_MES.md'  // 2026-10-03 基线 dump(git HEAD 版本,冻结副本)
const CUR = 'tools/archive/_dump-out/fields-HSDZ_MES.md'        // 当前库 dump(只取 COL 段判物理列)
const OUT = 'tools/migrate-fourdoc-baseline-restore-20261008.sql'
const PANELS = ['QC_RECV', 'QC_INSP', 'QC_RETURN', 'PURCHASE_IN']

const src = fs.readFileSync(SRC, 'utf8')
const srcSha = crypto.createHash('sha256').update(src, 'utf8').digest('hex')
let headSha = '(unknown)'
try { headSha = execSync(`git rev-parse HEAD`).toString().trim() } catch {}

// ---- 基线 dump 在下面解析(需先建好"现库物理列"表,才能做血统判定)----

const q = s => (s === '' || s == null ? 'NULL' : `N'${String(s).replace(/'/g, "''")}'`)
const num = s => (s === '' || s == null ? 'NULL' : String(Number(s)))
const bit = b => (b ? '1' : '0')

// ---- 现库物理列(取自当前库 dump 的 COL 段;用于判断基线字段的物理列是否还在) ----
const curSrc = fs.readFileSync(CUR, 'utf8')
const tableCols = new Map()   // 表名 -> Set(列名)
for (const ln of curSrc.split(/\r?\n/)) {
  if (!ln.startsWith('COL\t')) continue
  const t = ln.split('\t')
  if (!tableCols.has(t[1])) tableCols.set(t[1], new Set())
  tableCols.get(t[1]).add(t[2])
}
const panelTables = new Map()  // 面板 -> Set(表名)
{
  let p = null
  for (const ln of curSrc.split(/\r?\n/)) {
    if (ln.startsWith('===== ')) { p = ln.slice(6, -6).trim(); panelTables.set(p, new Set()); continue }
    if (ln.startsWith('COL\t') && p) panelTables.get(p).add(ln.split('\t')[1])
  }
}
const colExists = (panel, col) => {
  for (const t of panelTables.get(panel) || []) if (tableCols.get(t)?.has(col)) return true
  return false
}

/**
 * 血统差异处置(2026-10-03 之后本机表已切到 rebuild/远端血统):
 *   基线字段的物理列若已不存在 → 改名映射(同名语义的新列)或跳过(并在注释里列明原因)。
 * 未列在这里、又找不到列的字段 = 生成器直接报错,不静默丢。
 */
const COL_FIX = {
  // 退货数量:本机两账套 2026-10-03 前后由「退货数量」改名/换血统为「数量」(存量数据在 数量 列,实测 15/15 非空)。
  // 标签(数据键)保持基线的「退货数量」——后端按「面板注册标签」择一写入(inspAutoReturn),标签不动即契约不动。
  'QC_RETURN|退货数量|detail': { col: '数量', why: '列已随 rebuild 血统改名 退货数量→数量(存量数据在 数量)' }
}
const SKIP = {
  'QC_RETURN|单位|detail': 'qc_return_detail.单位 列已不存在(计量单位行仍在,语义重复)',
  'QC_RETURN|退货原因|header': 'qc_return.退货原因 列已不存在',
  'QC_RETURN|经手人|header': 'qc_return.经手人 列已不存在',
  'PURCHASE_IN|仓位名称|detail': 'bl_purchase_in.仓位名称 列已不存在(隐藏行)',
  'PURCHASE_IN|换算率2|detail': 'bl_purchase_in.换算率2 列已不存在(隐藏行)'
}

// ---- 解析基线 dump(FIELD 行)----
const parsed = []
let panel = null
for (const ln of src.split(/\r?\n/)) {
  if (ln.startsWith('===== ')) { panel = ln.slice(6, -6).trim(); continue }
  if (!panel || !ln.startsWith('FIELD\t')) continue
  const t = ln.split('\t')
  parsed.push({
    panel, place: t[1] || null, seq: t[2], label: t[3], col: t[4], type: t[5], width: t[6],
    editable: t[7][0] === 'E', required: t[7][1] === 'R', hidden: t[7][2] === 'H', visible: t[7][3] === 'V',
    alias: t[8], refPanel: t[9], refField: t[10], displayField: t[11], refFilter: t[12],
    dictSql: t[13], labelEn: t[14], colGroup: t[15], idInBaseline: +t[16]
  })
}
if (parsed.length === 0) throw new Error('基线 dump 未解析到 FIELD 行')

// ---- 血统处置:映射 / 跳过 / 报错;并按基线的 (seq,id) 排序定 rn ----
const rows = []
const fixedNotes = []
for (const p of PANELS) {
  const mine = parsed.filter(r => r.panel === p).sort((a, b) => (+a.seq - +b.seq) || (a.idInBaseline - b.idInBaseline))
  let rn = 0
  for (const r of mine) {
    const k = `${p}|${r.label}|${r.place}`
    // 跳过项只在「物理列确实不存在」时生效 —— 列补回来之后(见 migrate-fourdoc-bloodline-cols-20261008.sql)
    // 这 5 行就该照常登记,不再跳过。
    if (SKIP[k] && !colExists(p, r.col)) { fixedNotes.push(`  · 跳过 ${k} —— ${SKIP[k]}`); continue }
    if (!colExists(p, r.col)) {
      const fix = COL_FIX[k]
      if (!fix) throw new Error(`基线字段 ${k} 的物理列「${r.col}」在当前库不存在,且未登记处置(请补 COL_FIX 或 SKIP)`)
      fixedNotes.push(`  · 改名 ${k}: 列 ${r.col} → ${fix.col} —— ${fix.why}`)
      r.col = fix.col
    }
    r.ord = ++rn
    rows.push(r)
  }
}
const unmatched = parsed.filter(r => !PANELS.includes(r.panel))
if (unmatched.length) throw new Error('基线 dump 含非四单面板行: ' + unmatched.map(r => r.panel).join(','))

const counts = Object.fromEntries(PANELS.map(p => [p, rows.filter(r => r.panel === p).length]))

const COLS = ['ord', 'panel_code', 'col_name', 'label', 'data_type', 'dict_sql', 'ref_panel', 'ref_field',
  'display_field', 'place', 'seq', 'width', 'editable', 'required', 'hidden', 'alias', 'visible',
  'label_en', 'col_group', 'ref_filter']

const values = rows.map(r => '  (' + [
  r.ord, q(r.panel), q(r.col), q(r.label), q(r.type), q(r.dictSql), q(r.refPanel), q(r.refField),
  q(r.displayField), q(r.place), num(r.seq), num(r.width), bit(r.editable), bit(r.required), bit(r.hidden),
  q(r.alias), bit(r.visible), q(r.labelEn), q(r.colGroup), q(r.refFilter)
].join(',') + ')')


// 内容比对谓词(键 + 逐列等值;NULL 与 '' 视为同一"空")
const MATCH = [
  'b.panel_code = f.panel_code', 'b.col_name = f.col_name', 'b.label = f.label',
  'b.place = f.place', 'b.seq = f.seq',
  'ISNULL(b.width,-1) = ISNULL(f.width,-1)',
  'b.editable = f.editable', 'b.required = f.required', 'b.hidden = f.hidden', 'b.visible = f.visible',
  "ISNULL(b.data_type,N'') = ISNULL(f.data_type,N'')",
  "ISNULL(b.alias,N'') = ISNULL(f.alias,N'')",
  "ISNULL(b.ref_panel,N'') = ISNULL(f.ref_panel,N'')",
  "ISNULL(b.ref_field,N'') = ISNULL(f.ref_field,N'')",
  "ISNULL(b.display_field,N'') = ISNULL(f.display_field,N'')",
  "ISNULL(b.ref_filter,N'') = ISNULL(f.ref_filter,N'')",
  "ISNULL(b.dict_sql,N'') = ISNULL(f.dict_sql,N'')",
  "ISNULL(b.label_en,N'') = ISNULL(f.label_en,N'')",
  "ISNULL(b.col_group,N'') = ISNULL(f.col_group,N'')"
].join('\n      AND ')
const PANEL_FILTER = PANELS.map(p => `N'${p}'`).join(',')

// 「现役行不在基线」的行数(逐面板)
const EXTRA = `(SELECT COUNT(*) FROM yj_field f
      WHERE f.panel_code = p.panel_code AND NOT EXISTS (
        SELECT 1 FROM #base b
         WHERE ${MATCH.replace(/\bb\.panel_code = f\.panel_code/, 'b.panel_code = f.panel_code')}))`
// 「基线行不在现役」的行数(逐面板)
const MISSING = `(SELECT COUNT(*) FROM #base b
      WHERE b.panel_code = p.panel_code AND NOT EXISTS (
        SELECT 1 FROM yj_field f
         WHERE ${MATCH}))`
// 「顺序(id 次序)与基线不一致」的行数(逐面板):按 (seq,id) 排名的名次与基线不一致的现役行。
// 只比「键唯一」的行 —— 基线 PURCHASE_IN 有 6 对完全重复行(创建人编码/修改人编码/审核人编码/
// 未结算金额本位币/付款方式编码/付款账户编码 各 2 行),重复键在 JOIN 里会扇出成假差异。
const ORDER = `(SELECT COUNT(*) FROM (
         SELECT f.label AS label, f.col_name AS col_name, f.place AS place, f.seq AS seq,
                ROW_NUMBER() OVER (ORDER BY f.seq, f.id) AS rn,
                COUNT(*) OVER (PARTITION BY f.label, f.col_name, f.place, f.seq) AS dup
           FROM yj_field f WHERE f.panel_code = p.panel_code) x
       JOIN (SELECT b.label AS label, b.col_name AS col_name, b.place AS place, b.seq AS seq, b.ord AS rn
               FROM #base b WHERE b.panel_code = p.panel_code) y
         ON y.label = x.label AND y.col_name = x.col_name AND y.place = x.place AND y.seq = x.seq
      WHERE x.dup = 1 AND x.rn <> y.rn)`
const GAP_EXPR = `${EXTRA}\n     + ${MISSING}\n     + ${ORDER}`

const sql = `/* migrate-fourdoc-baseline-restore-20261008.sql — 采购链四单 yj_field 回正到 2026-10-03 基线
 *
 * 【为什么有这条】
 *   docs/development/采购链四单字段与显示字段.md 是四单字段/显示名/顺序的唯一基线(2026-10-03 冻结)。
 *   2026-10-05 07:42 起本地库发生**迁移链整链重放**(79 条脚本因字节变更被 DbSync 判为"未执行"而重跑,
 *   首条即 migrate-sl-supplier-ref.sql),四单的 yj_field 行被整批换成另一代登记:
 *     · 参照源回落:非供应商字段又挂 ref_panel='GFDA'(§5.3 同款越界形态,QC_INSP.部门 = 1 行越界);
 *     · QC_RECV 明细少 10 行(数量2/计量单位2/税率%/含税单价/含税金额/折扣%/预计到货日期/现存量/仓库/批次键),
 *       表头「单据日期」被改名成「日期」、业务员由「参照」掉回「文本」;
 *     · QC_INSP 明细「单位」整行消失;QC_RETURN/PURCHASE_IN 明细多出成批本应隐藏的行;
 *     · hidden 位被整片翻开 ⇒ 列表页宽表明细可见列:QC_RECV 22→37、QC_INSP 14→30、QC_RETURN 12→33。
 *   按文档 §8 复跑取证:§四内部一致性 12/12 ✅(库与后端下发同源,不是显示 bug),
 *   但 §五 参照抽查 4/6 —— QC_RECV「业务员」、QC_INSP「单位」两项 [FAIL]。
 *
 * 【本脚本做什么】
 *   把四单(QC_RECV/QC_INSP/QC_RETURN/PURCHASE_IN)的 yj_field 行**逐字段回正**到基线 dump:
 *     tools/archive/_dump-out/fields-HSDZ_MES.md @ git ${headSha.slice(0, 12)}(sha256 ${srcSha.slice(0, 16)}…)
 *   回正行数:${PANELS.map(p => `${p}=${counts[p]}`).join(' · ')}(共 ${rows.length} 行)。
 *   插入顺序 = 基线 (seq, id) 名次 ⇒ seq 并列组的先后与基线逐行一致(§1.2 并列按 id 升序)。
 *   不动物理表、不动 yj_translation、不动 yj_panel(面板名「暂收退料单」与 en 名属 yj_panel 历史差异,不是本次漂移)。
 *   生成器:tools/archive/_gen-fourdoc-restore.mjs(手改本文件无效,请改生成器重跑)。
 *
 * 【血统差异处置(2026-10-03 之后本机表切到了 rebuild/远端血统,基线字段的列有增有减)】
${fixedNotes.length ? fixedNotes.join('\n') : '   (无:基线字段的物理列在当前库全部存在)'}
 *   ⚠ 这几处是「基线文档 vs 现库表结构」的真实差异,本脚本无法凭元数据抹平:
 *     物理列已被删/改名 ⇒ 只回正到"列还在"的范围;要 100% 复刻基线文档的 §3.x「落库表列对照」,
 *     需要另开 DDL 迁移把列加回来(会与 rebuild 血统的存量数据分叉),不在本脚本范围内。
 *
 * 【幂等 / 安全】
 *   ① 逐面板先算「与基线的差异行数」= 现役多出的行 + 基线缺失的行 + 同键但内容不同的行
 *      + **顺序名次不符的行**(只有内容对、id 次序不对也要重建);
 *      为 0 ⇒ 跳过(脚本重跑是空操作);
 *   ② > 0 ⇒ 该面板**整面板重建**:按基线 (seq,id) 名次逐行插入(cursor 保序);
 *   ③ 重建与复核在**同一个事务**里:复核差异非 0 即整体 ROLLBACK + RAISERROR;
 *   ④ 末尾自检:行数对照 + 「越界污染(非供应商语义却指 GFDA)」必须为 0(§5.3 口径)。
 *
 * 【执行】两账套各跑一遍(先 HSDZ_MES、后 HSDZ_MES_TEST),跑到「执行 0、失败 0」;
 *        随后按文档 §8 重跑取证并重生成文档。
 */
SET NOCOUNT ON;
SET XACT_ABORT ON;

/* ---------- ⓪ 基线行集(2026-10-03 dump,${rows.length} 行) ---------- */
IF OBJECT_ID('tempdb..#base') IS NOT NULL DROP TABLE #base;
CREATE TABLE #base (
  ord           int           NOT NULL,
  panel_code    varchar(40)   NOT NULL,
  col_name      sysname       NOT NULL,
  label         nvarchar(120) NOT NULL,
  data_type     nvarchar(40)  NOT NULL,
  dict_sql      nvarchar(1000) NULL,
  ref_panel     varchar(40)   NULL,
  ref_field     sysname       NULL,
  display_field sysname       NULL,
  place         varchar(60)   NOT NULL,
  seq           int           NOT NULL,
  width         int           NULL,
  editable      bit           NOT NULL,
  required      bit           NOT NULL,
  hidden        bit           NOT NULL,
  alias         nvarchar(120) NULL,
  visible       bit           NOT NULL,
  label_en      nvarchar(400) NULL,
  col_group     nvarchar(100) NULL,
  ref_filter    nvarchar(400) NULL
);

INSERT INTO #base (${COLS.join(',')}) VALUES
${values.join(',\n')};
GO

/* ---------- ① 差异行数 → ② 逐面板回正 → ③ 复核 → ④ 自检(单批次 + 单事务) ---------- */
DECLARE @gap TABLE (panel_code sysname PRIMARY KEY, gap_rows int NOT NULL);

INSERT INTO @gap (panel_code, gap_rows)
SELECT p.panel_code,
       ${GAP_EXPR}
  FROM (VALUES (N'QC_RECV'),(N'QC_INSP'),(N'QC_RETURN'),(N'PURCHASE_IN')) p(panel_code);

SELECT g.panel_code AS 面板, g.gap_rows AS 差异行数,
       CASE WHEN g.gap_rows = 0 THEN N'已与基线一致(跳过)' ELSE N'需回正' END AS 处置
  FROM @gap g ORDER BY g.panel_code;

DECLARE @p sysname, @gap1 int;
DECLARE @cn sysname, @lb nvarchar(120), @dt nvarchar(40), @ds nvarchar(1000),
        @rp varchar(40), @rf sysname, @df sysname, @pl varchar(60), @sq int, @wd int,
        @ed bit, @rq bit, @hd bit, @al nvarchar(120), @vs bit, @le nvarchar(400),
        @cg nvarchar(100), @rflt nvarchar(400);

BEGIN TRAN;

DECLARE panels CURSOR LOCAL FAST_FORWARD FOR
  SELECT g.panel_code, g.gap_rows FROM @gap g WHERE g.gap_rows > 0 ORDER BY g.panel_code;
OPEN panels;
FETCH NEXT FROM panels INTO @p, @gap1;
WHILE @@FETCH_STATUS = 0
BEGIN
  PRINT N'回正 ' + @p + N':与基线差异 ' + CAST(@gap1 AS nvarchar(10)) + N' 行 → 整面板重建';

  DELETE FROM yj_field WHERE panel_code = @p;

  DECLARE ins CURSOR LOCAL FAST_FORWARD FOR
    SELECT b.col_name, b.label, b.data_type, b.dict_sql, b.ref_panel, b.ref_field, b.display_field,
           b.place, b.seq, b.width, b.editable, b.required, b.hidden, b.alias, b.visible,
           b.label_en, b.col_group, b.ref_filter
      FROM #base b WHERE b.panel_code = @p ORDER BY b.ord;
  OPEN ins;
  FETCH NEXT FROM ins INTO @cn, @lb, @dt, @ds, @rp, @rf, @df, @pl, @sq, @wd, @ed, @rq, @hd, @al, @vs, @le, @cg, @rflt;
  WHILE @@FETCH_STATUS = 0
  BEGIN
    INSERT INTO yj_field (panel_code, col_name, label, data_type, dict_sql, ref_panel, ref_field,
                          display_field, place, seq, width, editable, required, hidden, alias, visible,
                          label_en, col_group, ref_filter)
    VALUES (@p, @cn, @lb, @dt, @ds, @rp, @rf, @df, @pl, @sq, @wd, @ed, @rq, @hd, @al, @vs, @le, @cg, @rflt);
    FETCH NEXT FROM ins INTO @cn, @lb, @dt, @ds, @rp, @rf, @df, @pl, @sq, @wd, @ed, @rq, @hd, @al, @vs, @le, @cg, @rflt;
  END
  CLOSE ins; DEALLOCATE ins;

  FETCH NEXT FROM panels INTO @p, @gap1;
END
CLOSE panels; DEALLOCATE panels;

/* ---------- ③ 复核:重建后差异必须为 0,否则整体回滚 ---------- */
DELETE FROM @gap;
INSERT INTO @gap (panel_code, gap_rows)
SELECT p.panel_code,
       ${GAP_EXPR}
  FROM (VALUES (N'QC_RECV'),(N'QC_INSP'),(N'QC_RETURN'),(N'PURCHASE_IN')) p(panel_code);

IF EXISTS (SELECT 1 FROM @gap g WHERE g.gap_rows > 0)
BEGIN
  SELECT g.panel_code AS 仍有差异的面板, g.gap_rows AS 差异行数 FROM @gap g WHERE g.gap_rows > 0 ORDER BY g.panel_code;
  ROLLBACK;
  RAISERROR(N'四单回正失败:重建后仍与基线有差异(见上表),已整体回滚', 16, 1);
END
ELSE
BEGIN
  COMMIT;
  PRINT N'✅ 四单 yj_field 已回正到 2026-10-03 基线';
END

/* ---------- ④ 自检:行数对照 + 越界污染(§5.3 口径) ---------- */
SELECT p.panel_code AS 面板,
       (SELECT COUNT(*) FROM yj_field f WHERE f.panel_code = p.panel_code) AS 现役行数,
       (SELECT COUNT(*) FROM #base b WHERE b.panel_code = p.panel_code) AS 基线行数,
       CASE WHEN (SELECT COUNT(*) FROM yj_field f WHERE f.panel_code = p.panel_code)
               = (SELECT COUNT(*) FROM #base b WHERE b.panel_code = p.panel_code)
            THEN N'✅' ELSE N'❌' END AS 结论
  FROM (VALUES (N'QC_RECV'),(N'QC_INSP'),(N'QC_RETURN'),(N'PURCHASE_IN')) p(panel_code)
 ORDER BY p.panel_code;

SELECT COUNT(*) AS 越界污染行数_应为0
  FROM yj_field
 WHERE panel_code IN (${PANEL_FILTER}) AND data_type = N'参照' AND ref_panel = 'GFDA' AND label NOT LIKE N'%供应商%';
GO
PRINT N'migrate-fourdoc-baseline-restore-20261008 完成';
GO
`


fs.writeFileSync(OUT, sql, 'utf8')
console.log(`[ok] ${OUT}`)

// ---- 同步产出「四单基线快照」供 tools/verify/FourDocAudit.java 逐行核对 ----
const TSV = 'tools/fourdoc-baseline.tsv'
const head = ['ord', 'panel_code', 'col_name', 'label', 'place', 'seq', 'data_type', 'width', 'flags',
  'alias', 'ref_panel', 'ref_field', 'display_field', 'ref_filter', 'dict_sql', 'label_en', 'col_group']
const tsv = [head.join('\t')]
for (const r of rows) {
  tsv.push([r.ord, r.panel, r.col, r.label, r.place, r.seq, r.type,
    r.width === '' || r.width == null ? '' : r.width,
    (r.editable ? 'E' : '-') + (r.required ? 'R' : '-') + (r.hidden ? 'H' : '-') + (r.visible ? 'V' : '-'),
    r.alias, r.refPanel, r.refField, r.displayField, r.refFilter, r.dictSql, r.labelEn, r.colGroup].join('\t'))
}
fs.writeFileSync(TSV, tsv.join('\n') + '\n', 'utf8')
console.log(`[ok] ${TSV}(${rows.length} 行;四单回正后应逐行一致,由 tools/verify/FourDocAudit.java 核对)`)
console.log(`     回正行数 ${rows.length}:` + PANELS.map(p => ` ${p}=${counts[p]}`).join(''))
console.log(`     源 ${SRC} sha256=${srcSha.slice(0, 16)}…  git HEAD=${String(headSha).slice(0, 12)}`)
if (fixedNotes.length) console.log('     血统处置:\n' + fixedNotes.join('\n'))
