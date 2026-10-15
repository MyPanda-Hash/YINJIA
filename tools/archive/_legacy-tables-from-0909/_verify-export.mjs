#!/usr/bin/env node
/**
 * _verify-export.mjs —— 本目录留档内容的独立校验脚本（只读，不连库也能跑 CSV 部分）
 *
 * 用法：
 *   node _verify-export.mjs [schema-dump.txt]
 *
 * 校验项：
 *   1) 6 个 CSV 是否带 UTF-8 BOM
 *   2) CSV 表头列名/顺序是否与 SQL Server sys.columns 实况一致（需要 dump，见下）
 *   3) 每行字段数是否与表头一致（RFC4180 解析，含引号/逗号/换行处理）
 *   4) 数据行数是否等于登记的行数（gscs=1 dm_langue=15 permission=1529 s_commdata=712 s_sys=5660 s_xtcs=14）
 *   5) schema.sql 是否 6 张表都带 IF OBJECT_ID 幂等守卫
 *   6) schema.sql 每列 类型/长度/可空性/IDENTITY 是否与 sys.columns 实况逐列一致（需要 dump）
 *
 * dump 生成方式（只读查询，任何库上跑都安全；下面 <DB> 填 HSDZ_MES_0909）：
 *   sqlcmd -S localhost -d <DB> -U yinjia -P *** -C -f 65001 -W -s"|" -Q ^
 *     "SET NOCOUNT ON; SELECT t.name AS tbl, c.column_id AS ord, c.name AS col, ty.name AS typ, ^
 *      CASE WHEN ty.name IN ('nchar','nvarchar') AND c.max_length>0 THEN c.max_length/2 ELSE c.max_length END AS len, ^
 *      c.precision AS prec, c.scale AS scl, c.is_nullable AS nullable, c.is_identity AS ident ^
 *      FROM sys.tables t JOIN sys.columns c ON c.object_id=t.object_id JOIN sys.types ty ON ty.user_type_id=c.user_type_id ^
 *      WHERE t.name IN ('gscs','dm_langue','permission','s_commdata','s_sys','s_xtcs') ORDER BY t.name, c.column_id;" ^
 *     -o schema-dump.txt
 * 不传 dump 时，第 2、6 项标记为 SKIP（其余仍然执行）。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const TABLES = ['gscs', 'dm_langue', 'permission', 's_commdata', 's_sys', 's_xtcs'];
const EXPECTED_ROWS = { gscs: 1, dm_langue: 15, permission: 1529, s_commdata: 712, s_sys: 5660, s_xtcs: 14 };
const dumpPath = process.argv[2] ?? path.join(process.env.TEMP ?? '.', 'dsh-legacy-0909', 'out_schema.txt');

let fail = 0;
const out = [];
const results = (ok, label) => { if (!ok) fail++; out.push(`${ok ? 'PASS' : 'FAIL'} ${label}`); };
const skips = [];

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\r') { /* CRLF */ }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// ---- sys.columns dump（可选）
const colsOf = {};
const expectByTable = {};
const hasDump = fs.existsSync(dumpPath);
if (hasDump) {
  const dump = fs.readFileSync(dumpPath, 'utf8').split(/\r?\n/);
  for (const line of dump.slice(2)) {
    const p = line.split('|');
    if (p.length < 9) continue;
    const [tbl, , col, typ, len, prec, scl, nullable, ident] = p;
    (colsOf[tbl] ??= []).push(col);
    const t = typ.toLowerCase();
    let tt = typ;
    if (['varchar', 'char', 'varbinary', 'binary', 'nvarchar', 'nchar'].includes(t)) tt = +len === -1 ? `${typ}(MAX)` : `${typ}(${len})`;
    else if (['decimal', 'numeric'].includes(t)) tt = `${typ}(${prec},${scl})`;
    else if (['datetime2', 'datetimeoffset', 'time'].includes(t)) tt = `${typ}(${scl})`;
    (expectByTable[tbl] ??= []).push(`[${col}] ${tt}${ident === '1' ? ' IDENTITY(1,1)' : ''} ${nullable === '1' ? 'NULL' : 'NOT NULL'}`);
  }
} else {
  skips.push(`第 2、6 项 SKIP：找不到 sys.columns dump（${dumpPath}），按文件头注释里的命令重新生成后重跑即可`);
}

// ---- 1~4) CSV
for (const t of TABLES) {
  const buf = fs.readFileSync(path.join(dir, `${t}.csv`));
  const bom = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf;
  const rows = parseCsv(buf.toString('utf8').replace(/^\uFEFF/, ''));
  const header = rows[0];
  const data = rows.slice(1);
  const expectCols = colsOf[t];
  const headerOk = !expectCols ? null : header.length === expectCols.length && header.every((c, i) => c === expectCols[i]);
  const widthOk = data.every((r) => r.length === header.length);
  const rowsOk = data.length === EXPECTED_ROWS[t];
  const bad = data.findIndex((r) => r.length !== header.length);
  results(bom && rowsOk && widthOk && (headerOk !== false),
    `${t.padEnd(11)} BOM=${bom ? 'yes' : 'NO'} 列数=${header.length}${headerOk === null ? '(列名 SKIP)' : headerOk ? '(列名/顺序与库一致)' : '(列名或顺序不符)'} 数据行=${data.length}(期望${EXPECTED_ROWS[t]}) ` +
    `行宽一致=${widthOk ? 'yes' : 'NO 首个坏行 #' + (bad + 2)}`);
}

// ---- 5~6) schema.sql
const sql = fs.readFileSync(path.join(dir, 'schema.sql'), 'utf8').replace(/^\uFEFF/, '');
const createTables = [...sql.matchAll(/CREATE TABLE dbo\.\[(\w+)\]/g)].map((m) => m[1]);
const guardPairs = [...sql.matchAll(/IF OBJECT_ID\(N'dbo\.(\w+)', N'U'\) IS NULL\r?\nBEGIN\r?\nCREATE TABLE dbo\.\[(\w+)\]/g)];
results(createTables.length === 6 && guardPairs.length === 6 && guardPairs.every((m) => m[1] === m[2]) && TABLES.every((t) => createTables.includes(t)),
  `schema.sql   6 张 CREATE TABLE 均带 IF OBJECT_ID 幂等守卫；已建表清单=${createTables.join(',')}`);

if (hasDump) {
  const expectedLines = [];
  for (const t of TABLES) expectedLines.push(...(expectByTable[t] ?? []));
  const actualLines = [...sql.matchAll(/^ {4}\[([^\]]+)\] ([^ ]+(?:\([^)]*\))?)( IDENTITY\([^)]*\))?( NULL| NOT NULL)/gm)]
    .map((m) => `[${m[1]}] ${m[2]}${m[3] ?? ''}${m[4]}`);
  const mismatch = actualLines.map((l, i) => [l, expectedLines[i]]).filter(([a, b]) => a !== b);
  results(mismatch.length === 0,
    `schema.sql   逐列 类型/长度/可空性/IDENTITY 与 sys.columns 实况一致（比对 ${actualLines.length} 列，不符 ${mismatch.length} 列）` +
    (mismatch.length ? `；首个：${mismatch[0][0]} != ${mismatch[0][1]}` : ''));
}

console.log(out.join('\n'));
if (skips.length) console.log('\n' + skips.map((s) => 'SKIP ' + s).join('\n'));
console.log(fail === 0 ? '\nVERIFY: ALL PASS' + (skips.length ? '（含 SKIP 项，见上）' : '') : `\nVERIFY: ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
