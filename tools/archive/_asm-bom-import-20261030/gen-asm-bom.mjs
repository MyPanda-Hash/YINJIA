#!/usr/bin/env node
/**
 * 生成「组装物料清单」导入 SQL(bs_asm_bom,单表 doc 模式)。
 *
 * 输入:
 *   1) 金蝶导出 BOM 表(列表数据 sheet)
 *      C:\Users\vigna\Documents\WeChat Files\wxid_9he2bhyytczm22\FileStorage\File\2026-10\引出列表_BOM单_20261019174847.xlsx
 *   2) 在产产品清单(plang 未作废行的 distinct dm,由 DB 查出后存成本文件同目录 in-production-products.txt)
 *
 * 输出:
 *   - tools/migrate-asm-bom-data-20261030.sql  (UTF-8 无 BOM,幂等:先按 来源 DELETE 再插)
 *   - 本目录 gen-report.json / gen-report.md   (生成期对账报告,供静态核对与汇报引用)
 *
 * 用法(仓库根目录):
 *   node tools/archive/_asm-bom-import-20261030/gen-asm-bom.mjs
 * 可选参数:
 *   --xlsx <path>  覆盖 Excel 路径
 *   --prod <path>  覆盖在产产品清单路径
 *   --out <path>   覆盖 SQL 输出路径
 *
 * 块结构:产品编码(第 2 列)非空的行开一个新 BOM 块,该行同时是块的第一行子件;
 *        同块后续行(产品编码为空)都是子件。
 * 选块规则(每个产品只取一张 BOM):优先 默认BOM='是';否则取 编码 _V 后缀数字最大的块;
 *        其余块跳过并在报告中列出。
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');

const DEFAULT_XLSX = 'C:/Users/vigna/Documents/WeChat Files/wxid_9he2bhyytczm22/FileStorage/File/2026-10/引出列表_BOM单_20261019174847.xlsx';
const DEFAULT_PROD = path.join(HERE, 'in-production-products.txt');
const DEFAULT_OUT = path.join(REPO_ROOT, 'tools', 'migrate-asm-bom-data-20261030.sql');
const SOURCE_TAG = '金蝶BOM引出列表_20261019174847';

const argv = process.argv.slice(2);
function argVal(name) {
  const i = argv.indexOf(name);
  return i >= 0 && i + 1 < argv.length ? argv[i + 1] : null;
}
const XLSX_PATH = argVal('--xlsx') || DEFAULT_XLSX;
const PROD_PATH = argVal('--prod') || DEFAULT_PROD;
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
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: false });
  return rows;
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
  return m ? { full: 'V' + m[1].padStart(4, '0'), num: Number(m[1]) } : { full: null, num: -1 };
}

// 列号(1 基,按 Excel 表头实测):产品名称 1 产品编码 2 规格型号 3 物料编码 4 物料名称 5
// 规格型号(子件) 6 单位 8 编码(BOM编码) 10 用量:分子 11 用量:分母 13 使用状态 15
// 默认BOM 16 工艺路线编码 25 工艺路线名称 26 行备注 32
const COL = { 产品名称: 1, 产品编码: 2, 规格型号: 3, 物料编码: 4, 物料名称: 5, 子件规格: 6, 单位: 8, 编码: 10, 分子: 11, 分母: 13, 使用状态: 15, 默认BOM: 16, 工艺路线编码: 25, 工艺路线名称: 26, 行备注: 32 };

function parseBlocks(rows) {
  const blocks = [];
  let cur = null;
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
    cur.子件.push({
      物料编码: g(COL.物料编码),
      物料名称: g(COL.物料名称),
      子件规格: g(COL.子件规格),
      分子: g(COL.分子),
      分母: g(COL.分母),
      行备注: g(COL.行备注),
    });
  }
  return blocks;
}

function selectBlocks(blocks, prodSet) {
  const byProduct = new Map();
  for (const b of blocks) {
    if (!byProduct.has(b.产品编码)) byProduct.set(b.产品编码, []);
    byProduct.get(b.产品编码).push(b);
  }
  const selected = [];
  const multiVersion = [];
  const skipped = [];
  for (const [product, list] of byProduct) {
    if (!prodSet.has(product)) continue;
    const scored = list.map((b) => {
      const v = versionOf(b.编码);
      return { block: b, version: v, isDefault: b.默认BOM === '是' };
    });
    scored.sort((a, b2) => {
      if (a.isDefault !== b2.isDefault) return a.isDefault ? -1 : 1;
      return b2.version.num - a.version.num;
    });
    const pick = scored[0];
    selected.push(pick);
    for (const s of scored.slice(1)) skipped.push(s.block.编码);
    if (list.length > 1) {
      multiVersion.push({
        产品编码: product,
        blocks: list.map((b) => ({ 编码: b.编码, 默认BOM: b.默认BOM, 子件数: b.子件.length })),
        选中: pick.block.编码,
        跳过: scored.slice(1).map((s) => s.block.编码),
      });
    }
  }
  // 保持 Excel 原始顺序
  const order = new Map(blocks.map((b, i) => [b, i]));
  selected.sort((a, b) => order.get(a.block) - order.get(b.block));
  return { selected, multiVersion, skipped, byProduct };
}

// ---------- 校验 ----------
const blocks = parseBlocks(readRows(XLSX_PATH));
const excelProducts = [...new Set(blocks.map((b) => b.产品编码))];
const prodSet = new Set(
  fs.readFileSync(PROD_PATH, 'utf8').split(/\r?\n/).map((s) => s.trim()).filter(Boolean),
);

const { selected, multiVersion, skipped, byProduct } = selectBlocks(blocks, prodSet);

// 产品覆盖:相交 / 在产无 BOM / Excel 有但不在产
const inter = excelProducts.filter((p) => prodSet.has(p)).sort((a, b) => a.localeCompare(b, 'en'));
const prodNoBom = [...prodSet].filter((p) => !excelProducts.includes(p)).sort((a, b) => a.localeCompare(b, 'en'));
const excelNotProd = excelProducts.filter((p) => !prodSet.has(p)).length;

// 汇总行
const docCodes = selected.map((s) => s.block.编码);
const dupDocs = docCodes.filter((c, i) => docCodes.indexOf(c) !== i);
if (dupDocs.length) throw new Error(`单据编号重复:${dupDocs.join(',')}`);
const totalRows = selected.reduce((acc, s) => acc + s.block.子件.length, 0);

// 选中块内的数据质量检查
const problems = [];
for (const s of selected) {
  const b = s.block;
  if (!b.编码) problems.push(`${b.产品编码} 块缺少 BOM 编码`);
  if (!s.version.full) problems.push(`${b.产品编码} 的编码 ${b.编码} 不以 _V<数字> 结尾`);
  if (b.子件.length === 0) problems.push(`${b.编码} 无子件行`);
  b.子件.forEach((c, idx) => {
    if (!c.物料编码) problems.push(`${b.编码} 第 ${idx + 1} 行子件编码为空`);
    if (!Number.isFinite(num(c.分子, NaN))) problems.push(`${b.编码} 第 ${idx + 1} 行 用量:分子 非数字`);
    if (!Number.isFinite(num(c.分母, NaN))) problems.push(`${b.编码} 第 ${idx + 1} 行 用量:分母 非数字`);
  });
}
// 单据编号重复、块编码前缀与产品不一致
for (const s of selected) {
  const prefix = s.block.编码.replace(/_V\d+$/, '');
  if (prefix !== s.block.产品编码) problems.push(`块编码 ${s.block.编码} 前缀与产品编码 ${s.block.产品编码} 不一致`);
}
if (problems.length) {
  throw new Error('选中数据存在质量问题,拒绝生成:\n  - ' + problems.slice(0, 20).join('\n  - '));
}

// ---------- 生成 SQL ----------
function sqln(v) {
  if (v === null || v === undefined) return 'NULL';
  const s = String(v).replace(/\u0000/g, '').replace(/'/g, "''");
  return `N'${s}'`;
}

const files = [];
let rowsDone = 0;
for (const s of selected) {
  const b = s.block;
  b.子件.forEach((c, i) => {
    const mol = num(c.分子, 1);
    const den = num(c.分母, 1) || 1;
    const std = round4(mol / den);
    const values = [
      sqln(b.编码),            // 单据编号
      sqln(b.产品编码),        // 产品编码
      sqln(b.产品名称),        // 产品名称
      sqln(b.规格型号),        // 规格型号
      sqln('组装'),            // 工序
      sqln(s.version.full),    // 版本号
      sqln(b.默认BOM),         // 默认BOM
      sqln(b.工艺路线名称),    // 工艺路线名称
      sqln(SOURCE_TAG),        // 来源
      sqln(b.使用状态),        // 状态
      String(i + 1),           // 行序
      sqln(c.物料编码),        // 子件编码
      sqln(c.物料名称),        // 子件名称
      sqln(c.子件规格),        // 子件规格
      'NULL',                  // 计量单位(先留空,插入后由 bs_inv 回填)
      std,                     // 标准用量
      round4(mol),             // 用量分子
      round4(den),             // 用量分母
      '0.0000',                // 损耗量
      sqln(c.行备注),          // 行备注
      sqln('金蝶BOM导入'),     // asp_user1
      'SYSDATETIME()',         // asp_time1
      'NULL',                  // asp_user2
      'NULL',                  // asp_time2
      sqln('N'),               // asp_cancel
    ];
    files.push('(' + values.join(', ') + ')');
    rowsDone++;
  });
}

const INSERT_COLS = '单据编号, 产品编码, 产品名称, 规格型号, 工序, 版本号, 默认BOM, 工艺路线名称, 来源, 状态, 行序, 子件编码, 子件名称, 子件规格, 计量单位, 标准用量, 用量分子, 用量分母, 损耗量, 行备注, asp_user1, asp_time1, asp_user2, asp_time2, asp_cancel';

const BATCH_ROWS = 200;
const insertBatches = [];
for (let i = 0; i < files.length; i += BATCH_ROWS) {
  const chunk = files.slice(i, i + BATCH_ROWS);
  insertBatches.push(
    `INSERT INTO dbo.bs_asm_bom (${INSERT_COLS}) VALUES\n` + chunk.join(',\n') + ';',
  );
}

const sql = `-- 组装物料清单导入(bs_asm_bom,单表 doc 模式)
-- 来源:金蝶 BOM 引出列表 引出列表_BOM单_20261019174847.xlsx(sheet「列表数据」)
-- 生成器:tools/archive/_asm-bom-import-20261030/gen-asm-bom.mjs(勿手改本文件,改生成器后重跑)
-- 范围:plang 未作废行的 distinct dm(${prodSet.size} 个在产产品)∩ Excel 父产品(${excelProducts.length} 个) = ${selected.length} 个产品
--       在产但 Excel 无 BOM 的 ${prodNoBom.length} 个产品不导(属正常):${prodNoBom.join(', ')}
-- 选块:每产品一张 BOM;优先 默认BOM='是';否则取 编码 _V 后缀数字最大者;被跳过的多版本块 ${skipped.length} 个
-- 字段:工序='组装';版本号=编码 _V 后缀;来源='${SOURCE_TAG}';行序=块内 1..n;
--       标准用量=ROUND(用量:分子/用量:分母,4)(分母空/0 按 1);损耗量=0;计量单位先空、由 bs_inv 回填
-- 幂等:开头仅按 来源 删除本脚本导入的行,再全量插入;可重复执行
-- 预期:${totalRows} 行 / ${selected.length} 张单据 / ${selected.length} 个产品
SET NOCOUNT ON;
IF OBJECT_ID('dbo.bs_asm_bom') IS NULL
BEGIN
    RAISERROR(N'[FAIL] dbo.bs_asm_bom 不存在:先执行 tools/migrate-asm-bom-20261030.sql 建表', 16, 1);
    RETURN;
END;

-- 1) 幂等清理:只动本来源的行
DELETE FROM dbo.bs_asm_bom WHERE 来源 = N'${SOURCE_TAG}';

-- 2) 插入(每条 ${BATCH_ROWS} 行以内,共 ${insertBatches.length} 批)
${insertBatches.map((b) => b + '\nGO').join('\n\n')}
-- 3) 计量单位:按 子件编码 = bs_inv.存货编码 回填(查不到的保持 NULL)
UPDATE b
   SET b.计量单位 = x.计量单位
  FROM dbo.bs_asm_bom b
 CROSS APPLY (
        SELECT TOP 1 i.计量单位
          FROM dbo.bs_inv i
         WHERE i.存货编码 = b.子件编码
           AND i.计量单位 IS NOT NULL
           AND i.计量单位 <> N''
         ORDER BY i.计量单位
 ) x
 WHERE b.来源 = N'${SOURCE_TAG}';

-- 4) 自检(RAISERROR severity 10 会被 DbSync 打印;FAIL 用 severity 16 真失败)
DECLARE @rows int, @docs int, @prods int, @nounit int;
SELECT @rows = COUNT(*),
       @docs = COUNT(DISTINCT 单据编号),
       @prods = COUNT(DISTINCT 产品编码),
       @nounit = SUM(CASE WHEN 计量单位 IS NULL OR 计量单位 = N'' THEN 1 ELSE 0 END)
  FROM dbo.bs_asm_bom
 WHERE 来源 = N'${SOURCE_TAG}';
RAISERROR(N'[INFO] asm-bom import: rows=%d docs=%d prods=%d missing_unit=%d (expect rows=${totalRows} docs=${selected.length} prods=${selected.length})', 10, 1, @rows, @docs, @prods, @nounit) WITH NOWAIT;
IF @rows = ${totalRows} AND @docs = ${selected.length} AND @prods = ${selected.length}
    RAISERROR(N'[PASS] asm-bom import self-check OK', 10, 1) WITH NOWAIT;
ELSE
    RAISERROR(N'[FAIL] asm-bom import self-check mismatch: rows=%d docs=%d prods=%d', 16, 1, @rows, @docs, @prods);
`;

// ---------- 写文件 ----------
fs.writeFileSync(OUT_PATH, sql, 'utf8'); // Node 'utf8' 不写 BOM
const bytes = fs.readFileSync(OUT_PATH);
if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) throw new Error('SQL 输出带 BOM,不符合要求');

const report = {
  生成时间: new Date().toISOString(),
  excel文件: XLSX_PATH,
  在产产品清单: PROD_PATH,
  sql输出: OUT_PATH,
  sql字节数: bytes.length,
  Excel: {
    总数据行: blocks.reduce((a, b) => a + b.子件.length, 0),
    BOM块数: blocks.length,
    父产品数: excelProducts.length,
    多块产品数: byProduct.size - [...byProduct.values()].filter((v) => v.length === 1).length,
  },
  范围: {
    在产产品数: prodSet.size,
    Excel父产品数: excelProducts.length,
    交集产品数: inter.length,
    在产无BOM产品数: prodNoBom.length,
    在产无BOM产品: prodNoBom,
    Excel有但不在产产品数: excelNotProd,
  },
  输出: {
    选中产品数: selected.length,
    单据数: new Set(docCodes).size,
    总行数: totalRows,
    跳过块数: skipped.length,
    跳过多版本块: skipped,
    默认BOM为是的块数: selected.filter((s) => s.block.默认BOM === '是').length,
    行备注非空行数: selected.reduce((a, s) => a + s.block.子件.filter((c) => c.行备注).length, 0),
    工艺路线名称为空的产品数: selected.filter((s) => !s.block.工艺路线名称).length,
    产品规格为空的产品数: selected.filter((s) => !s.block.规格型号).length,
  },
  多版本产品: multiVersion,
  每产品: Object.fromEntries(
    selected.map((s) => [
      s.block.产品编码,
      {
        单据编号: s.block.编码,
        版本号: s.version.full,
        默认BOM: s.block.默认BOM,
        子件数: s.block.子件.length,
        用量样例: s.block.子件.slice(0, 3).map((c) => ({
          子件编码: c.物料编码,
          分子: num(c.分子, 1),
          分母: num(c.分母, 1),
          标准用量: round4(num(c.分子, 1) / (num(c.分母, 1) || 1)),
        })),
      },
    ]),
  ),
};
fs.writeFileSync(path.join(HERE, 'gen-report.json'), JSON.stringify(report, null, 2), 'utf8');

const md = [];
md.push('# 组装物料清单生成报告(gen-asm-bom.mjs)');
md.push('');
md.push(`- 生成时间:${report.生成时间}`);
md.push(`- Excel 数据行:${report.Excel.总数据行};BOM 块:${report.Excel.BOM块数};父产品:${report.Excel.父产品数}`);
md.push(`- 范围:在产产品 ${prodSet.size} ∩ Excel 父产品 ${excelProducts.length} = **${selected.length}** 个产品`);
md.push(`- 输出:**${totalRows} 行 / ${selected.length} 张单据 / ${selected.length} 个产品**;跳过 ${skipped.length} 个多版本块`);
md.push(`- 在产无 BOM(${prodNoBom.length} 个,正常):${prodNoBom.join(', ')}`);
md.push(`- Excel 有但不在产(不导):${excelNotProd} 个产品`);
md.push(`- 默认BOM='是' 的选中块:${report.输出.默认BOM为是的块数}`);
md.push('');
md.push('## 多版本产品(每产品只取一张,其余跳过)');
md.push('');
md.push('| 产品编码 | 选中 | 跳过 |');
md.push('|---|---|---|');
for (const m of multiVersion) md.push(`| ${m.产品编码} | ${m.选中} | ${m.跳过.join(', ')} |`);
md.push('');
md.push('## 每产品子件数');
md.push('');
md.push('| 产品编码 | 单据编号 | 子件数 |');
md.push('|---|---|---|');
for (const s of selected) md.push(`| ${s.block.产品编码} | ${s.block.编码} | ${s.block.子件.length} |`);
md.push('');
fs.writeFileSync(path.join(HERE, 'gen-report.md'), md.join('\n'), 'utf8');

console.log(`[OK] SQL -> ${OUT_PATH} (${bytes.length} bytes, BOM-less)`);
console.log(`[OK] rows=${totalRows} docs=${selected.length} prods=${selected.length} skippedBlocks=${skipped.length} prodNoBom=${prodNoBom.length}`);
