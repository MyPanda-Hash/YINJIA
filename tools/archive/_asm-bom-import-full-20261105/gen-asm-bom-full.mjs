#!/usr/bin/env node
/**
 * 生成「组装物料清单」**全量**导入 SQL(bs_asm_bom,单表 doc 模式)。
 *
 * 背景 / 与上一版导入的关系:
 *   - `tools/migrate-asm-bom-data-20261030.sql` 只导了「plang 在产产品 ∩ Excel 父件」= 236 产品 / 1085 行;
 *   - 2026-11-05 用户口径:「这个是当前系统的组装物料清单的内容,需要实现一个一次性脚本能够成功的
 *     导入到当前本地全部导入,同时这个脚本要能导入到服务器中去」⇒ 本次导**全部** BOM 块。
 *
 * 输入:
 *   金蝶导出 BOM 表(列表数据 sheet)
 *   C:\Users\vigna\Documents\WeChat Files\wxid_9he2bhyytczm22\FileStorage\File\2026-10\引出列表_BOM单_20261019174847.xlsx
 *
 * 输出:
 *   - tools/migrate-asm-bom-data-full-20261105.sql (UTF-8 无 BOM,幂等:先按 来源 DELETE 再全量插入)
 *   - 本目录 gen-report.json / gen-report.md          (生成期对账报告,供静态核对与汇报引用)
 *
 * 用法(仓库根目录):
 *   node tools/archive/_asm-bom-import-full-20261105/gen-asm-bom-full.mjs
 * 可选参数:
 *   --xlsx <path>  覆盖 Excel 路径
 *   --out <path>   覆盖 SQL 输出路径
 *
 * 块结构:产品编码(第 2 列)非空的行开一个新 BOM 块,该行同时是块的第一行子件;
 *        同块后续行(产品编码为空)都是子件。末尾 1 行「合计」汇总行(产品名称='合计'、其余关键列全空)
 *        按「子件关键列全空」丢弃(不是子件;T410_V0001 块实际就是 6 行)。
 * 选块:全部块都导(不按在产/默认BOM 过滤);同一产品多版本的块各成一张单据(10 个产品各有 2 版)。
 * 字段映射:见下方 COL 与 SQL 头注;备注(BOM 级)= 第 7 列;计量单位先取「分子单位」,
 *        插入后按 bs_inv.计量单位 覆盖(存货档案优先,查不到保留 Excel 分子单位)。
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');

const DEFAULT_XLSX = 'C:/Users/vigna/Documents/WeChat Files/wxid_9he2bhyytczm22/FileStorage/File/2026-10/引出列表_BOM单_20261019174847.xlsx';
const DEFAULT_OUT = path.join(REPO_ROOT, 'tools', 'migrate-asm-bom-data-full-20261105.sql');
const SOURCE_TAG = '金蝶BOM引出列表_20261019174847';
const OLD_SCOPE_NOTE = '本脚本是 migrate-asm-bom-data-20261030.sql(236 在产产品/1085 行)的超集:按 来源 全删全插;两脚本顺序执行终态 = 本脚本';

const argv = process.argv.slice(2);
function argVal(name) {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null;
}
const XLSX_PATH = argVal('--xlsx') || DEFAULT_XLSX;
const OUT_PATH = argVal('--out') || DEFAULT_OUT;

// 从 frontend/node_modules 取 SheetJS(仓库根没有 node_modules,不新增依赖)
const requireFromFrontend = createRequire(path.join(REPO_ROOT, 'frontend', 'package.json'));
const XLSX = requireFromFrontend('xlsx');

// ---------- 读取 Excel ----------
function readRows(file) {
  const wb = XLSX.readFile(file, { cellDates: false });
  const sheetName = '列表数据';
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`Excel 缺少 sheet「${sheetName}」,实际:${wb.SheetNames.join(',')}`);
  return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: false });
}

function norm(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') {
    const t = v.trim();
    return t === '' ? null : t;
  }
  return v;
}

function num(v, dflt = 1) {
  const n = norm(v);
  if (n === null) return dflt;
  const x = typeof n === 'number' ? n : Number(String(n).replace(/,/g, ''));
  if (!Number.isFinite(x)) return dflt;
  return x;
}

function round4(x) {
  return (Math.round((x + Number.EPSILON) * 10000) / 10000).toFixed(4);
}

function versionOf(code) {
  const m = /_V(\d+)$/.exec(code || '');
  return m ? 'V' + m[1].padStart(4, '0') : null;
}

// 列号(1 基,按 Excel 表头实测):产品名称 1 产品编码 2 规格型号 3 物料编码 4 物料名称 5
// 规格型号(子件) 6 备注 7 单位 8 编码(BOM编码) 10 用量:分子 11 分子单位 12 用量:分母 13
// 使用状态 15 默认BOM 16 工艺路线编码 25 工艺路线名称 26 行备注 32
const COL = {
  产品名称: 1, 产品编码: 2, 规格型号: 3, 物料编码: 4, 物料名称: 5, 子件规格: 6,
  备注: 7, 单位: 8, 编码: 10, 分子: 11, 分子单位: 12, 分母: 13,
  使用状态: 15, 默认BOM: 16, 工艺路线编码: 25, 工艺路线名称: 26, 行备注: 32,
};

// 子件关键列(全空 = 末尾「合计」汇总行,不是子件,丢弃)
const SUB_KEY_COLS = [COL.物料编码, COL.物料名称, COL.子件规格, COL.分子, COL.分母, COL.行备注];

const COLUMN_MAX = {
  单据编号: 50, 产品编码: 100, 产品名称: 200, 规格型号: 200, 工序: 20, 版本号: 20,
  默认BOM: 10, 工艺路线名称: 100, 来源: 100, 状态: 20, 子件编码: 100, 子件名称: 200,
  子件规格: 200, 计量单位: 20, 行备注: 500, 备注: 500,
};

function parseBlocks(rows) {
  const blocks = [];
  let cur = null;
  let phantom = 0;
  for (let i = 1; i < rows.length; i++) { // 第 0 行是表头
    const r = rows[i];
    if (!r) continue;
    const g = (c) => norm(r[c - 1]);
    const productCode = g(COL.产品编码);
    if (productCode !== null) {
      cur = {
        excelRow: i + 1,
        产品编码: productCode,
        产品名称: g(COL.产品名称),
        规格型号: g(COL.规格型号),
        备注: g(COL.备注),
        编码: g(COL.编码),
        默认BOM: g(COL.默认BOM),
        使用状态: g(COL.使用状态),
        工艺路线编码: g(COL.工艺路线编码),
        工艺路线名称: g(COL.工艺路线名称),
        子件: [],
      };
      blocks.push(cur);
    }
    if (!cur) throw new Error(`第 ${i + 1} 行在第一个 BOM 块之前(产品编码为空且无当前块)`);
    if (SUB_KEY_COLS.every((c) => g(c) === null)) { phantom++; continue; }
    cur.子件.push({
      物料编码: g(COL.物料编码),
      物料名称: g(COL.物料名称),
      子件规格: g(COL.子件规格),
      分子: g(COL.分子),
      分子单位: g(COL.分子单位),
      分母: g(COL.分母),
      行备注: g(COL.行备注),
    });
  }
  return { blocks, phantom };
}

// ---------- 生成 ----------
const rows = readRows(XLSX_PATH);
const { blocks, phantom } = parseBlocks(rows);
const excelProducts = [...new Set(blocks.map((b) => b.产品编码))];
const totalRows = blocks.reduce((acc, b) => acc + b.子件.length, 0);

// 数据质量闸门:不过就拒绝生成(避免静默丢行/错行)
const problems = [];
const docCodes = [];
for (const b of blocks) {
  if (!b.编码) problems.push(`${b.产品编码} 块缺少 BOM 编码`);
  else docCodes.push(b.编码);
  const prefix = (b.编码 || '').replace(/_V\d+$/, '');
  if (prefix !== b.产品编码) problems.push(`块编码 ${b.编码} 前缀与产品编码 ${b.产品编码} 不一致`);
  if (!versionOf(b.编码)) problems.push(`${b.产品编码} 的编码 ${b.编码} 不以 _V<数字> 结尾`);
  if (b.子件.length === 0) problems.push(`${b.编码} 无子件行`);
  for (const [k, max] of Object.entries(COLUMN_MAX)) {
    const v = k === '单据编号' ? b.编码
      : k === '产品编码' ? b.产品编码
      : k === '产品名称' ? b.产品名称
      : k === '规格型号' ? b.规格型号
      : k === '工序' ? '组装'
      : k === '版本号' ? versionOf(b.编码)
      : k === '默认BOM' ? b.默认BOM
      : k === '工艺路线名称' ? b.工艺路线名称
      : k === '来源' ? SOURCE_TAG
      : k === '状态' ? b.使用状态
      : k === '备注' ? b.备注
      : null;
    if (v !== null && String(v).length > max) problems.push(`${k} 超长(${String(v).length}>${max}):${v}`);
  }
  b.子件.forEach((c, idx) => {
    if (!c.物料编码) problems.push(`${b.编码} 第 ${idx + 1} 行子件编码为空`);
    if (!Number.isFinite(num(c.分子, NaN))) problems.push(`${b.编码} 第 ${idx + 1} 行 用量:分子 非数字`);
    if (num(c.分母, 0) <= 0) problems.push(`${b.编码} 第 ${idx + 1} 行 用量:分母 非正数`);
    for (const k of ['子件名称', '子件规格', '计量单位', '行备注']) {
      const v = k === '子件名称' ? c.物料名称 : k === '子件规格' ? c.子件规格 : k === '计量单位' ? c.分子单位 : c.行备注;
      if (v !== null && String(v).length > COLUMN_MAX[k]) problems.push(`${b.编码} 第 ${idx + 1} 行 ${k} 超长:${v}`);
    }
  });
}
const dupDocs = docCodes.filter((c, i) => docCodes.indexOf(c) !== i);
if (dupDocs.length) problems.push(`单据编号重复:${dupDocs.join(',')}`);
const dupLines = new Set();
for (const b of blocks) b.子件.forEach((_, i) => {
  const key = `${b.编码}#${i + 1}`;
  if (dupLines.has(key)) problems.push(`(单据编号,行序) 重复:${key}`);
  dupLines.add(key);
});
if (problems.length) {
  throw new Error('数据存在质量问题,拒绝生成:\n  - ' + problems.slice(0, 30).join('\n  - '));
}

// 同一产品多版本(保留全部,报告里点名)
const byProduct = new Map();
for (const b of blocks) {
  if (!byProduct.has(b.产品编码)) byProduct.set(b.产品编码, []);
  byProduct.get(b.产品编码).push(b);
}
const multiVersion = [...byProduct.entries()]
  .filter(([, list]) => list.length > 1)
  .map(([product, list]) => ({
    产品编码: product,
    块: list.map((b) => ({ 编码: b.编码, 默认BOM: b.默认BOM, 子件数: b.子件.length })),
  }));

function sqln(v) {
  if (v === null || v === undefined) return 'NULL';
  const s = String(v).replace(/\u0000/g, '').replace(/'/g, "''");
  return `N'${s}'`;
}

const rowsOut = [];
for (const b of blocks) {
  b.子件.forEach((c, i) => {
    const mol = num(c.分子, 1);
    const den = num(c.分母, 1) || 1;
    const std = round4(mol / den);
    rowsOut.push('(' + [
      sqln(b.编码),            // 单据编号
      sqln(b.产品编码),        // 产品编码
      sqln(b.产品名称),        // 产品名称
      sqln(b.规格型号),        // 规格型号
      sqln('组装'),            // 工序
      sqln(versionOf(b.编码)), // 版本号
      sqln(b.默认BOM),         // 默认BOM
      sqln(b.工艺路线名称),    // 工艺路线名称
      sqln(SOURCE_TAG),        // 来源
      sqln(b.使用状态),        // 状态
      String(i + 1),           // 行序
      sqln(c.物料编码),        // 子件编码
      sqln(c.物料名称),        // 子件名称
      sqln(c.子件规格),        // 子件规格
      sqln(c.分子单位),        // 计量单位(先取 Excel 分子单位,插入后按 bs_inv 覆盖)
      std,                     // 标准用量
      round4(mol),             // 用量分子
      round4(den),             // 用量分母
      '0.0000',                // 损耗量
      sqln(c.行备注),          // 行备注
      sqln(b.备注),            // 备注(BOM 级)
      sqln('金蝶BOM导入'),     // asp_user1
      'SYSDATETIME()',         // asp_time1
      'NULL',                  // asp_user2
      'NULL',                  // asp_time2
      sqln('N'),               // asp_cancel
    ].join(', ') + ')');
  });
}

const INSERT_COLS = '单据编号, 产品编码, 产品名称, 规格型号, 工序, 版本号, 默认BOM, 工艺路线名称, 来源, 状态, 行序, 子件编码, 子件名称, 子件规格, 计量单位, 标准用量, 用量分子, 用量分母, 损耗量, 行备注, 备注, asp_user1, asp_time1, asp_user2, asp_time2, asp_cancel';

const BATCH_ROWS = 200;
const insertBatches = [];
for (let i = 0; i < rowsOut.length; i += BATCH_ROWS) {
  insertBatches.push(
    `INSERT INTO dbo.bs_asm_bom (${INSERT_COLS}) VALUES\n` + rowsOut.slice(i, i + BATCH_ROWS).join(',\n') + ';',
  );
}

const sql = `-- 组装物料清单 **全量**导入(bs_asm_bom,单表 doc 模式) 2026-11-05
-- 来源:金蝶 BOM 引出列表 引出列表_BOM单_20261019174847.xlsx(sheet「列表数据」),共 827 个 BOM 块
-- 生成器:tools/archive/_asm-bom-import-full-20261105/gen-asm-bom-full.mjs(勿手改本文件,改生成器后重跑)
-- 用户口径(2026-11-05):「这个是当前系统的组装物料清单的内容……导入到当前本地全部导入,同时这个脚本要能导入到服务器中去」
-- 范围:${blocks.length} 个 BOM 块 / ${excelProducts.length} 个产品 / ${totalRows} 行子件(工序=组装;不按在产过滤)
--       ${OLD_SCOPE_NOTE}
--       同一产品多版本(共 ${multiVersion.length} 个产品)各成一张单据,代码端按「默认BOM=是 > 版本号最大 > 单据编号」取一张
-- 字段:单据编号=BOM 编码(如 A-32-01_V0009);版本号=编码 _V 后缀;状态=使用状态;行序=块内 1..n;
--       标准用量=ROUND(用量:分子/用量:分母,4)(分母空/0 按 1);用量分子/用量分母保留原值;损耗量=0;
--       备注=金蝶 BOM 级备注(第 7 列);行备注=金蝶行备注;计量单位先取金蝶「分子单位」,
--       插入后按 bs_inv.计量单位 覆盖(存货档案优先;档案查不到的保留金蝶分子单位)
-- 幂等:开头仅按 来源 删除本脚本导入的行,再全量插入;可重复执行
-- 安全:只 DELETE 来源=金蝶BOM导出标记 的行,不碰面板手工新建的 BOM;不删表、不改结构
-- 执行:本地两账套 DbSync run;服务器见 deploy/incr-asm-bom-full-20261105/README-AI.md
-- 预期:${totalRows} 行 / ${blocks.length} 张单据 / ${excelProducts.length} 个产品
SET NOCOUNT ON;
IF OBJECT_ID('dbo.bs_asm_bom') IS NULL
BEGIN
    RAISERROR(N'[FAIL] dbo.bs_asm_bom 不存在:先执行 tools/migrate-asm-bom-20261030.sql 建表', 16, 1);
    RETURN;
END;
GO

-- 1) 幂等清理:只动本来源的行(上一版 20261030 导入的 1085 行也在此范围,被整批替换为本脚本的超集)
DELETE FROM dbo.bs_asm_bom WHERE 来源 = N'${SOURCE_TAG}';
GO

-- 2) 插入(每批 ${BATCH_ROWS} 行以内,共 ${insertBatches.length} 批)
${insertBatches.map((b) => b + '\nGO').join('\n\n')}
-- 3) 计量单位:按 子件编码 = bs_inv.存货编码 覆盖为存货档案单位(档案查不到的保留 Excel 分子单位)
UPDATE b
   SET b.计量单位 = x.计量单位
  FROM dbo.bs_asm_bom b
 CROSS APPLY (
        SELECT TOP 1 i.计量单位
          FROM dbo.bs_inv i
         WHERE i.存货编码 = b.子件编码
           AND ISNULL(i.计量单位, N'') <> N''
         ORDER BY i.计量单位
  ) x
 WHERE b.来源 = N'${SOURCE_TAG}';
GO

-- 4) 自检(RAISERROR severity 10 = INFO/PASS; 16 = 真失败,DbSync 会中止并判 FAIL)
DECLARE @rows int, @docs int, @prods int, @nounit int, @blanksub int, @badseq int, @badstd int, @procbad int, @lossbad int, @cancelbad int;
SELECT @rows = COUNT(*),
       @docs = COUNT(DISTINCT 单据编号),
       @prods = COUNT(DISTINCT 产品编码),
       @nounit = SUM(CASE WHEN ISNULL(计量单位, N'') = N'' THEN 1 ELSE 0 END),
       @blanksub = SUM(CASE WHEN ISNULL(子件编码, N'') = N'' THEN 1 ELSE 0 END),
       @badstd = SUM(CASE WHEN ABS(标准用量 - ROUND(用量分子 / NULLIF(用量分母,0), 4)) > 0.00005 THEN 1 ELSE 0 END),
       @procbad = SUM(CASE WHEN 工序 <> N'组装' THEN 1 ELSE 0 END),
       @lossbad = SUM(CASE WHEN 损耗量 <> 0 THEN 1 ELSE 0 END),
       @cancelbad = SUM(CASE WHEN ISNULL(asp_cancel,'N') <> N'N' THEN 1 ELSE 0 END)
  FROM dbo.bs_asm_bom
 WHERE 来源 = N'${SOURCE_TAG}';

-- 行序必须连续 1..n(逐单据)
SELECT @badseq = COUNT(*) FROM (
    SELECT 单据编号, COUNT(*) AS c, MIN(行序) AS mn, MAX(行序) AS mx
      FROM dbo.bs_asm_bom
     WHERE 来源 = N'${SOURCE_TAG}'
     GROUP BY 单据编号
    HAVING MIN(行序) <> 1 OR MAX(行序) <> COUNT(*) OR COUNT(DISTINCT 行序) <> COUNT(*)
) x;

RAISERROR(N'[INFO] asm-bom full import: rows=%d docs=%d prods=%d missing_unit=%d blank_sub=%d bad_seq_doc=%d bad_std=%d bad_proc=%d bad_loss=%d bad_cancel=%d',
    10, 1, @rows, @docs, @prods, @nounit, @blanksub, @badseq, @badstd, @procbad, @lossbad, @cancelbad) WITH NOWAIT;

IF @rows = ${totalRows} AND @docs = ${blocks.length} AND @prods = ${excelProducts.length}
   AND @nounit = 0 AND @blanksub = 0 AND @badseq = 0 AND @badstd = 0 AND @procbad = 0 AND @lossbad = 0 AND @cancelbad = 0
    RAISERROR(N'[PASS] asm-bom full import self-check OK (expect rows=${totalRows} docs=${blocks.length} prods=${excelProducts.length})', 10, 1) WITH NOWAIT;
ELSE
    RAISERROR(N'[FAIL] asm-bom full import self-check mismatch: expect rows=${totalRows} docs=${blocks.length} prods=${excelProducts.length}', 16, 1);
GO
`;

fs.writeFileSync(OUT_PATH, sql, 'utf8'); // Node 'utf8' 不写 BOM
const bytes = fs.readFileSync(OUT_PATH);
if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) throw new Error('SQL 输出带 BOM,不符合要求');

const report = {
  生成时间: new Date().toISOString(),
  excel文件: XLSX_PATH,
  sql输出: OUT_PATH,
  sql字节数: bytes.length,
  Excel: {
    总数据行: rows.length,
    合计汇总行丢弃: phantom,
    BOM块数: blocks.length,
    父产品数: excelProducts.length,
    子件总行数: totalRows,
    多版本产品数: multiVersion.length,
  },
  输出: {
    单据数: blocks.length,
    产品数: excelProducts.length,
    行数: totalRows,
    批次数: insertBatches.length,
    每批行数: BATCH_ROWS,
    默认BOM为是的块数: blocks.filter((b) => b.默认BOM === '是').length,
    行备注非空行数: blocks.reduce((a, b) => a + b.子件.filter((c) => c.行备注).length, 0),
    BOM级备注非空块数: blocks.filter((b) => b.备注).length,
    子件单位非空行数: blocks.reduce((a, b) => a + b.子件.filter((c) => c.分子单位).length, 0),
    工艺路线名称为空块数: blocks.filter((b) => !b.工艺路线名称).length,
    产品规格为空块数: blocks.filter((b) => !b.规格型号).length,
  },
  多版本产品: multiVersion,
  每产品子件数: Object.fromEntries(blocks.map((b) => [b.编码, b.子件.length])),
};
fs.writeFileSync(path.join(HERE, 'gen-report.json'), JSON.stringify(report, null, 2), 'utf8');

const md = [];
md.push('# 组装物料清单全量导入生成报告(gen-asm-bom-full.mjs)');
md.push('');
md.push(`- 生成时间:${report.生成时间}`);
md.push(`- Excel:总行 ${rows.length}(表头 1 + 子件数据 ${totalRows} + 合计汇总行 ${phantom});BOM 块 **${blocks.length}**;父产品 **${excelProducts.length}**;子件行 **${totalRows}**`);
md.push(`- 输出:**${totalRows} 行 / ${blocks.length} 张单据 / ${excelProducts.length} 个产品**,分 ${insertBatches.length} 批插入`);
md.push(`- 多版本产品 ${multiVersion.length} 个(全部保留,各成一张单据)`);
md.push(`- 默认BOM='是' 的块:${report.输出.默认BOM为是的块数};BOM 级备注非空块:${report.输出.BOM级备注非空块数};行备注非空行:${report.输出.行备注非空行数}`);
md.push(`- 工艺路线名称为空块:${report.输出.工艺路线名称为空块数};产品规格为空块:${report.输出.产品规格为空块数}`);
md.push('');
md.push('## 多版本产品(全部导入)');
md.push('');
md.push('| 产品编码 | 版本块 |');
md.push('|---|---|');
for (const m of multiVersion) md.push(`| ${m.产品编码} | ${m.块.map((x) => `${x.编码}(${x.子件数}行${x.默认BOM ? ',默认' : ''})`).join(' + ')} |`);
md.push('');
fs.writeFileSync(path.join(HERE, 'gen-report.md'), md.join('\n'), 'utf8');

console.log(`[OK] SQL -> ${OUT_PATH} (${bytes.length} bytes, BOM-less)`);
console.log(`[OK] blocks=${blocks.length} prods=${excelProducts.length} rows=${totalRows} batches=${insertBatches.length} summaryRows=${phantom} multiVersion=${multiVersion.length}`);
