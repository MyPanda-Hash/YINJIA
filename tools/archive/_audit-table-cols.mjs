// _audit-table-cols.mjs — 按表核对:提取 Java 中 "FROM/JOIN <表>" 附近 SQL 的 [列] 引用 vs 该表实际列
// 目的:一次找全"代码引用列但库里没有"的缺口(单位/规格型号/不合格数量 三连坑的根治扫描)
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const q = (sql) => {
  fs.writeFileSync('tools/archive/_at.sql', 'SET NOCOUNT ON\n' + sql + '\n', 'utf8');
  execSync('docker cp tools/archive/_at.sql mssql2019:/tmp/at.sql', { shell: true, stdio: 'ignore' });
  return execSync('docker exec mssql2019 bash -c "/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P Yinjia@2026 -C -d HSDZ_MES -f 65001 -I -y 0 -i /tmp/at.sql"', { shell: true, encoding: 'utf8', maxBuffer: 5e8, stdio: ['ignore','pipe','ignore'] })
    .split('\n').map(l => l.replace(/\r$/, '').trim()).filter(l => l && !/^-{3,}$/.test(l) && !/^SQLcmd:/.test(l));
};

// 库:表 -> 列集合
const tblCols = new Map();
for (const line of q("SELECT t.name+'|'+c.name FROM sys.columns c JOIN sys.tables t ON t.object_id=c.object_id ORDER BY t.name")) {
  const i = line.indexOf('|');
  if (i < 0) continue;
  const t = line.slice(0, i), c = line.slice(i + 1);
  if (!tblCols.has(t)) tblCols.set(t, new Set());
  tblCols.get(t).add(c);
}
console.log('库表数:', tblCols.size);

// Java:提取每条 SQL 字符串(拼接后的可读形态难还原,改按"字符串字面量块"近似)——收集 [列] 与同块内 from/join 表名
const files = execSync('git ls-files "backend/src/main/java/**/*.java"', { shell: true, encoding: 'utf8' }).split('\n').filter(Boolean);
const problems = [];
let sqlBlocks = 0;
for (const f of files) {
  const txt = fs.readFileSync(f, 'utf8');
  // Java 里 SQL 多为 "..." + "..." 拼接:把连续含 SELECT/FROM/UPDATE/INSERT 的字符串字面量视作一块(按行近似)
  const lines = txt.split('\n');
  let buf = '';
  for (const ln of lines) {
    const inSql = /"(\s*(SELECT|FROM|JOIN|WHERE|UPDATE|INSERT|AND|OR|SET|ORDER|GROUP|\s*\+))/i.test(ln) || /SELECT|UPDATE|INSERT INTO|DELETE FROM/i.test(ln);
    if (inSql) { buf += ' ' + ln; }
    else {
      if (buf.length > 30) { sqlBlocks++; scanBlock(buf, f.split(/[\\/]/).pop()); }
      buf = '';
    }
  }
  if (buf.length > 30) { sqlBlocks++; scanBlock(buf, f.split(/[\\/]/).pop()); }
}
function scanBlock(block, fname) {
  // 块内涉及的表名
  const tables = new Set();
  for (const m of block.matchAll(/\b(?:FROM|JOIN|INTO|UPDATE)\s+(?:dbo\.)?\[?([a-z_][\w]*)\]?/gi)) tables.add(m[1].toLowerCase());
  if (!tables.size) return;
  // 块内 [中文列] 引用
  const cols = new Set();
  for (const m of block.matchAll(/\[([\u4e00-\u9fa5][^\]\s]{0,40})\]/g)) cols.add(m[1]);
  for (const c of cols) {
    // 只要有任何一张涉及的表拥有该列,视为可解析(列名不唯一时无法精确归属)
    let ok = false;
    for (const t of tables) if (tblCols.get(t)?.has(c)) { ok = true; break; }
    // 也可被别名表(join 的其它表)拥有 → 全局检查兜底,只报"全库都不存在"的
    if (!ok) {
      let anywhere = false;
      for (const s of tblCols.values()) if (s.has(c)) { anywhere = true; break; }
      if (!anywhere) problems.push({ f: fname, tables: [...tables].join(','), col: c });
    }
  }
}
console.log('扫描 SQL 块:', sqlBlocks);
console.log(`\n═══ 全库都不存在的引用列: ${problems.length} ═══`);
for (const p of problems) console.log(`  [${p.col}] ← ${p.f} (表: ${p.tables})`);
fs.writeFileSync('tools/archive/_audit-table-cols.json', JSON.stringify(problems, null, 1), 'utf8');
