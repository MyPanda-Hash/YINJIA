// _list-migrations.mjs — 字节级解析 tools/db-migrations.txt(PS 5.1 的 Get-Content 会按 ANSI 解码吞换行,不可用于本文件)
// 用法:node tools/archive/_list-migrations.mjs [关键字...]
import fs from 'node:fs';
import path from 'node:path';

const repo = path.resolve(import.meta.dirname, '..', '..');
const file = path.join(repo, 'tools', 'db-migrations.txt');
const lines = fs.readFileSync(file, 'utf8').split('\n');

const entries = [];   // 真正的脚本行(非空、非注释)
lines.forEach((l, i) => {
  const t = l.trim();
  if (!t || t.startsWith('#')) return;
  entries.push({ line: i + 1, name: t });
});

const exists = (n) => fs.existsSync(path.join(repo, 'tools', n));
const dup = new Map();
for (const e of entries) dup.set(e.name, (dup.get(e.name) || 0) + 1);

console.log(`总行=${lines.length}  条目=${entries.length}  去重后=${dup.size}`);
const missing = entries.filter((e) => !exists(e.name));
const dups = [...dup.entries()].filter(([, n]) => n > 1);
if (missing.length) { console.log(`\n⚠ 清单里但文件不存在(${missing.length}):`); for (const m of missing) console.log(`  L${m.line}  ${m.name}`); }
if (dups.length) { console.log(`\n⚠ 重复登记(${dups.length}):`); for (const [n, c] of dups) console.log(`  ×${c}  ${n}`); }

const keys = process.argv.slice(2);
if (keys.length) {
  console.log(`\n== 命中 ${keys.join(' / ')} ==`);
  for (const e of entries) if (keys.some((k) => e.name.includes(k))) console.log(`  L${String(e.line).padStart(4)}  ${e.name}`);
}

// 另:列出 tools 根层「在磁盘上但没进清单」的 .sql(游离脚本)
const onDisk = fs.readdirSync(path.join(repo, 'tools')).filter((f) => f.endsWith('.sql'));
const inList = new Set(entries.map((e) => e.name));
const orphan = onDisk.filter((f) => !inList.has(f));
console.log(`\ntools 根层 .sql=${onDisk.length}  未入清单=${orphan.length}`);
for (const o of orphan) console.log(`  游离: ${o}`);
