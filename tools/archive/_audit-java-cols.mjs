// _audit-java-cols.mjs — Java SQL 引用的 [中文列] vs 库内全列名(全库)对比,一次找全潜在缺列(2026-09-24)
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const q = (sql) => {
  fs.writeFileSync('tools/archive/_aj.sql', 'SET NOCOUNT ON\n' + sql + '\n', 'utf8');
  execSync('docker cp tools/archive/_aj.sql mssql2019:/tmp/aj.sql', { shell: true, stdio: 'ignore' });
  return execSync('docker exec mssql2019 bash -c "/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P Yinjia@2026 -C -d HSDZ_MES -f 65001 -I -y 0 -i /tmp/aj.sql"', { shell: true, encoding: 'utf8', maxBuffer: 5e8, stdio: ['ignore','pipe','ignore'] })
    .split('\n').map(l => l.replace(/\r$/, '').trim()).filter(l => l && !/^-{3,}$/.test(l) && !/^SQLcmd:/.test(l));
};

// 库内全部列名
const dbCols = new Set(q('SELECT DISTINCT name FROM sys.columns'));
console.log('库内列名(去重):', dbCols.size);

// 全 Java 源码里的 [列] 引用
const files = execSync('git ls-files "backend/src/main/java/**/*.java"', { shell: true, encoding: 'utf8' }).split('\n').filter(Boolean);
const refs = new Map();  // col -> Set(file)
for (const f of files) {
  const txt = fs.readFileSync(f, 'utf8');
  // 先剔掉 AS [别名] 形态
  const cleaned = txt.replace(/\bAS\s*\[[^\]]+\]/gi, '');
  for (const m of cleaned.matchAll(/\[([\u4e00-\u9fa5][^\]\s]{0,40})\]/g)) {
    const c = m[1];
    if (!refs.has(c)) refs.set(c, new Set());
    refs.get(c).add(f.split(/[\\/]/).pop());
  }
}
console.log('Java 引用列名(去重):', refs.size);

const missing = [...refs].filter(([c]) => !dbCols.has(c));
console.log(`\n═══ 缺失列候选: ${missing.length} ═══`);
for (const [c, fs2] of missing.sort((a,b)=>b[1].size-a[1].size)) {
  console.log(`  ${c}  ← ${[...fs2].slice(0,4).join(', ')}${fs2.size>4?' +'+fs2.size:''}`);
}
fs.writeFileSync('tools/archive/_audit-java-cols.json', JSON.stringify(missing.map(([c,f])=>[c,[...f]]), null, 1), 'utf8');
