/**
 * _import-kingdee-csv.mjs —— 把 tools/archive/_dump-out/kingdee-data-1014/ 的 CSV 导回 MES 库
 * (2026-10-16:用于「清库 → 导入既有 CSV → 重新打包部署」的重建路线)
 *
 * 口径与坑(实测得出):
 *   1. CSV 是 `SELECT *` 全列导出 ⇒ **必须按「CSV 表头 ∩ 现库列」取交集**再插:
 *      实测 6 个文件对不上(bd_sale_out 多出 开票状态/发货人2/审核人2/…、yj_doc_status 的
 *      「派生状态」是辅助列、bd_so_order 的交货方式列名有细微差异) ⇒ 直接照表头插会报「列名无效」。
 *   2. **保留 id**:用 SET IDENTITY_INSERT ON 按 CSV 原 id 落库 —— form_flow_link 的行键按 id 关联,
 *      重编号会把链路打断。
 *   3. 空值:CSV 空串 = 原库 NULL。列可空 ⇒ 写 NULL;列 NOT NULL 且是字符型 ⇒ 写 '';其余照写让库自己判。
 *   4. 顺序:头表先于行表、父先于子(采购订单 → 暂收 → 检验 → 检验记录;销售订单 → 工单)。
 *
 * 用法(仓库根):
 *   node tools/archive/_import-kingdee-csv.mjs                      # 空跑(--dry-run),只统计不写库
 *   node tools/archive/_import-kingdee-csv.mjs --apply              # 真写
 *   node tools/archive/_import-kingdee-csv.mjs --apply --wipe       # 写前先清空这 26 张表(行表/子表先清)
 *   node tools/archive/_import-kingdee-csv.mjs --apply --wipe --wipe-extras
 *                                                                   # 再额外清 inh/outh(库存流水,CSV 不含)
 *   node tools/archive/_import-kingdee-csv.mjs --only bd_pu_order   # 只处理指定表(逗号分隔)
 *   node tools/archive/_import-kingdee-csv.mjs --db HSDZ_MES_TEST    # 换库(默认 HSDZ_MES)
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import mssql from '../../deploy/node_modules/mssql/index.js';

/**
 * 官方清库脚本(`tools/migrate-golive-cleanup.sql`)打算清的表。
 * ⚠ 该脚本 2026-09-17 至今已锈:它 DELETEs 的表里有几张后来被下架(实测 bl_pu_req),
 *   而 SQL Server 对整批做编译 ⇒ 一个名字无效**整批一条都不执行**(实测:跑完库内一行未动)。
 *   故此处只取「它的表清单 ∩ 现存的表」,并报出被跳过的 —— 既保住它的意图,又不被锈死。
 */
const OFFICIAL_TABLES = (() => {
  try {
    const txt = readFileSync(new URL('../../migrate-golive-cleanup.sql', import.meta.url), 'utf8');
    return [...new Set([...txt.matchAll(/DELETE\s+FROM\s+([A-Za-z_][A-Za-z0-9_]*)/gi)].map((m) => m[1]))];
  } catch { return []; }
})();

const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const has = (n) => argv.includes('--' + n);

const DIR = arg('dir', 'D:/workspace/yinjia/tools/archive/_dump-out/kingdee-data-1014');
const DB = arg('db', 'HSDZ_MES');
const APPLY = has('apply');
const WIPE = has('wipe');
const WIPE_EXTRAS = has('wipe-extras');
const WIPE_SWEEP = has('wipe-sweep');   // 显式才做「官方清库脚本其余表」那一片(整库重建时用)
const ONLY = arg('only', '') ? arg('only').split(',').map((x) => x.trim()) : null;

/** 导入顺序:父先于子;清理时反序执行 */
const ORDER = [
  'bd_pu_order', 'bl_pu_order', 'bd_so_order', 'bl_so_order',
  'bd_purchase_in', 'bl_purchase_in', 'bd_sale_out', 'bl_sale_out',
  'bd_material_out', 'bl_material_out', 'bd_finish_in', 'bl_finish_in',
  'bd_other_in', 'bl_other_in', 'bd_other_out', 'bl_other_out',
  'sl_recv', 'sl_recv_detail', 'qc_insp', 'qc_insp_detail',
  'qc_insp_rec', 'qc_insp_rec_detail', 'qc_insp_req', 'plang',
  'yj_doc_status', 'form_flow_link',
];
// CSV 不含库存数据 ⇒ 如要重导须一并清,否则单据流水成孤儿。
// ⚠ 必须**保留期初**:kucun/inh 的 31 行期初(批号/单据编号 INIT-*)是台账底座,
//   清掉会让「结存≠流水」;顺带清掉 JZ- 月结结转行(它是 123 键结存≠流水 的成因)。
const EXTRAS_WIPE = [
  { t: 'inh', where: "单据编号 IS NULL OR 单据编号 NOT LIKE N'INIT-%'" },
  { t: 'outh', where: "单据编号 IS NULL OR 单据编号 NOT LIKE N'INIT-%'" },
  { t: 'kucun', where: "lot_no IS NULL OR lot_no NOT LIKE N'INIT-%'" },
];

/**
 * NOT NULL 列在 CSV 里为空时的兜底 —— 导出时(2026-10-14)这些列还是空的/可空的,
 * 之后被改成 NOT NULL(实测 bd_pu_order / bd_purchase_in 的 汇率 全空 ⇒ 整表 500 行转换失败)。
 * 口径与同步器/拉取脚本一致(deploy/README.md §7):汇率 1、币种 人民币。
 */
const NOTNULL_FILL = { 汇率: 1, 币种: '人民币' };

/** 极简 CSV 解析:双引号包裹 + 转义 "" + 内嵌逗号/换行 */
function parseCsv(text) {
  const rows = []; let row = []; let cur = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur.replace(/\r$/, '')); rows.push(row); row = []; cur = ''; }
    else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur.replace(/\r$/, '')); rows.push(row); }
  // 丢掉完全空行
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ''));
}

const pool = await mssql.connect({
  server: '127.0.0.1', port: 1433, database: DB, user: 'yinjia',
  password: process.env.YINJIA_SQL_PASS || 'Yinjia@2026',
  options: { encrypt: false, trustServerCertificate: true },
  // ⚠ 必须限 1 条连接:SET IDENTITY_INSERT 是**会话级**的,而 pool.request() 每次会另借连接 ⇒
  //   SET 落在 A 连接、INSERT 落在 B 连接,报「Cannot insert explicit value for identity column … OFF」(实测踩到)
  pool: { max: 1, min: 1, idleTimeoutMillis: 30000 },
});
const q = async (s) => (await pool.request().query(s)).recordset;
const esc = (s) => String(s).replace(/'/g, "''");
const isStrType = (t) => ['nvarchar', 'varchar', 'nchar', 'char', 'text', 'ntext'].includes(t);
let filled = 0;   // NOT NULL 非字符列被自动兜底(0/汇率/币种)的单元格数 —— 必须报出来,不许静默

const colsOf = async (t) => q(
  `SELECT c.name, ty.name AS typ, c.is_nullable, c.is_identity
     FROM sys.columns c JOIN sys.types ty ON ty.user_type_id = c.user_type_id
    WHERE c.object_id = OBJECT_ID(N'dbo.${t}') ORDER BY c.column_id`);

console.log(`库 ${DB} | 目录 ${DIR} | 模式 ${APPLY ? 'APPLY(写库)' : 'DRY-RUN(只统计)'}${WIPE ? ' + WIPE' : ''}${WIPE_EXTRAS ? ' + WIPE-EXTRAS' : ''}`);
console.log('');

// ── 1. 预检:逐个 CSV 求交集、列差异、行数 ──
const plan = [];
for (const table of ORDER) {
  if (ONLY && !ONLY.includes(table)) continue;
  const file = join(DIR, `${table}.csv`);
  let text;
  try { text = readFileSync(file, 'utf8'); } catch { console.log(`${table.padEnd(22)} ✗ 缺 CSV`); continue; }
  const rows = parseCsv(text);
  const header = rows[0] || [];
  const data = rows.slice(1);
  const cols = await colsOf(table);
  if (!cols.length) { console.log(`${table.padEnd(22)} ✗ 表不存在`); continue; }
  const byName = new Map(cols.map((c) => [c.name, c]));
  // ⚠ 必须带上 CSV 表头里的**原始下标** idx:取交集会丢列,按交集下标取值会让后面所有列整体错位
  const pairs = header.map((h, idx) => ({ h, idx, col: byName.get(h) })).filter((x) => x.col);
  const use = pairs.map((x) => x.h);                       // CSV ∩ 现库
  const dropCsv = header.filter((h) => !byName.has(h));    // CSV 有、库里无(必须丢)
  const nullCols = cols.filter((c) => !header.includes(c.name)).map((c) => c.name); // 库有、CSV 无
  // ⚠ IDENTITY_INSERT 只在 CSV **确实提供了 id** 时开(表有 id 但 CSV 没有 ⇒ 开了反而报错)
  const hasId = use.includes('id');
  plan.push({ table, rows: data.length, header, use, dropCsv, nullCols, byName, pairs, hasId, data });
  console.log(`${table.padEnd(22)} CSV ${String(data.length).padStart(5)} 行 | 取用列 ${String(use.length).padStart(3)}/${header.length}`
    + (dropCsv.length ? ` | 丢弃(库里无): ${dropCsv.join(',')}` : '')
    + (nullCols.length ? ` | 留空(CSV无): ${nullCols.join(',')}` : ''));
}
console.log('');
console.log(`拟导入合计 ${plan.reduce((a, b) => a + b.rows, 0)} 行 / ${plan.length} 张表`);
console.log('清理清单(反序):', [...plan.map((p) => p.table)].reverse().join(', '));
if (WIPE_EXTRAS) console.log('额外清理:', EXTRAS_WIPE.join(', '), '(库存流水,CSV 不含 ⇒ 不清会成孤儿)');

if (!APPLY) { console.log('\n[DRY-RUN] 未写库。加 --apply 执行。'); await pool.close(); process.exit(0); }

// ── 2. 清理:反序 DELETE ──
if (WIPE) {
  const targets = [...plan.map((p) => p.table)].reverse().map((t) => ({ t, where: '' }));
  if (WIPE_EXTRAS) targets.push(...EXTRAS_WIPE);
  for (const { t, where } of targets) {
    const r = await pool.request().query(`DELETE FROM dbo.[${t}]${where ? ' WHERE ' + where : ''}`);
    console.log(`  [清] ${t.padEnd(22)} 删除 ${r.rowsAffected[0]} 行${where ? ' (窄条件:保留期初)' : ''}`);
  }
  // 官方脚本意图里的其余表(号池/日志/研发 rd_*/生产 wo_* 等):**只有显式 --wipe-sweep 才扫**。
  // ⚠ 2026-10-16 改:原先只要 --wipe 就扫 ⇒ 只想重导某几张表(如 --only sl_recv,qc_insp)时
  //   会顺带清掉号池/日志/生产等一大片 —— 那是"整库重建"才该做的事,不该是默认副作用。
  if (WIPE_SWEEP) {
    const handled = new Set([...plan.map((p) => p.table), ...EXTRAS_WIPE.map((x) => x.t)]);
    const existing = new Set((await q('SELECT name FROM sys.tables')).map((x) => x.name));
    const rest = OFFICIAL_TABLES.filter((t) => !handled.has(t));
    const missing = rest.filter((t) => !existing.has(t));
    if (missing.length) console.log(`  [跳过] 官方脚本里已下架的表 ${missing.length} 张: ${missing.join(', ')}`);
    let auxRows = 0, auxTouched = 0;
    for (const t of rest.filter((t) => existing.has(t))) {
      const r = await pool.request().query(`DELETE FROM dbo.[${t}]`);
      if (r.rowsAffected[0] > 0) { auxRows += r.rowsAffected[0]; auxTouched++; }
    }
    console.log(`  [清] 官方脚本意图内的其余 ${rest.filter((t) => existing.has(t)).length} 张表: 命中 ${auxTouched} 张 / 共删 ${auxRows} 行`);
  } else {
    console.log('  [提示] 未做「官方清库脚本其余表」那一片的清扫(需要时加 --wipe-sweep)');
  }
}

// ── 3. 导入 ──
let totalIn = 0, totalSkip = 0;
for (const p of plan) {
  let ins = 0, skip = 0;
  for (const r of p.data) {
    const obj = {};
    for (const pr of p.pairs) {
      const v = r[pr.idx];                      // ⚠ 按 CSV 原始下标取值,不能用交集下标
      if (v === '' || v === undefined) {
        if (pr.col.is_nullable) continue;       // 空且可空 ⇒ 不写,库里留 NULL
        if (NOTNULL_FILL[pr.h] !== undefined) { obj[pr.h] = NOTNULL_FILL[pr.h]; filled++; }
        else if (isStrType(pr.col.typ)) obj[pr.h] = '';       // NOT NULL 字符列 ⇒ 空串
        else { obj[pr.h] = 0; filled++; }                     // 其余(数值/日期)⇒ 0,并计数报出
      } else obj[pr.h] = v;
    }
    const keys = Object.keys(obj);
    if (!keys.length) { skip++; continue; }
    try {
      const req = pool.request();
      keys.forEach((k, i) => req.input('p' + i, obj[k]));
      const row = `INSERT INTO dbo.[${p.table}] (${keys.map((k) => `[${k}]`).join(',')}) VALUES (${keys.map((_, i) => '@p' + i).join(',')})`;
      // SET 与 INSERT 必须**同一个批次**执行(单次 query = 单连接),否则 identity 设置不生效
      await req.query(p.hasId
        ? `SET IDENTITY_INSERT dbo.[${p.table}] ON; ${row}; SET IDENTITY_INSERT dbo.[${p.table}] OFF;`
        : row);
      ins++;
    } catch (e) {
      skip++;
      if (skip <= 3) console.log(`  [失败] ${p.table} 第 ${p.data.indexOf(r) + 2} 行: ${String(e.message).slice(0, 140)}`);
    }
  }
  totalIn += ins; totalSkip += skip;
  console.log(`${p.table.padEnd(22)} 导入 ${String(ins).padStart(5)} / 失败或跳过 ${skip}`);
}
console.log(`\n合计导入 ${totalIn} 行,失败/跳过 ${totalSkip} 行`);
console.log(`NOT NULL 列自动兜底 ${filled} 个单元格(汇率=1 / 币种=人民币 / 其余数值=0)—— 见头部 NOTNULL_FILL`);
await pool.close();
