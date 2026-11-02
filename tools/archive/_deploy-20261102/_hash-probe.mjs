// 迁移脚本哈希口径探针（只读）—— 判断「服务器 yj_schema_log 里的 content_hash」
// 到底是按哪种字节口径算的：原始字节 / LF 归一 / CRLF 归一。
//
// 背景：2026-11-02 部署前比对发现本地 692 条清单里有 329 条「哈希不一致」，
// 数量覆盖整条历史 ⇒ 强烈怀疑是换行符口径差异，而不是真的内容变更。
// 若真是差异，DbSync 会把 329 条历史脚本整链重放（2026-10-05 事故同类）。
//
// 用法（仓库根）：
//   node tools/archive/_deploy-20261102/_hash-probe.mjs <server-schema-log.tsv>
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const toolsDir = join(here, '..', '..');
const tsvPath = process.argv[2];

if (!tsvPath || !existsSync(tsvPath)) {
  console.error('用法: node _hash-probe.mjs <server-schema-log.tsv>');
  process.exit(2);
}

const sha = (buf) => createHash('sha256').update(buf).digest('hex');

// 服务器台账：script_name|content_hash
const server = new Map();
for (const line of readFileSync(tsvPath, 'utf8').split(/\r?\n/)) {
  const p = line.split('|');
  if (p.length >= 2 && p[0].trim()) server.set(p[0].trim(), p[1].trim());
}

const manifest = readFileSync(join(toolsDir, 'db-migrations.txt'), 'utf8')
  .split(/\r?\n/)
  .filter((l) => l.trim() && !l.trim().startsWith('#'))
  .map((l) => l.trim().split(/\s+/)[0]);

const stat = { raw: 0, lf: 0, crlf: 0, none: 0, missing: 0, changedReal: [] };
let serverOnly = 0;

for (const name of manifest) {
  const abs = join(toolsDir, name);
  if (!existsSync(abs)) { stat.missing++; continue; }
  if (!server.has(name)) { stat.missing++; continue; }

  const bytes = readFileSync(abs);
  const want = server.get(name).toLowerCase();

  const rawHash = sha(bytes);
  const text = bytes.toString('utf8');
  const lfHash = sha(Buffer.from(text.replace(/\r\n/g, '\n'), 'utf8'));
  const crlfHash = sha(Buffer.from(text.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n'), 'utf8'));

  if (rawHash === want) stat.raw++;
  else if (lfHash === want) stat.lf++;
  else if (crlfHash === want) stat.crlf++;
  else { stat.none++; if (stat.changedReal.length < 12) stat.changedReal.push({ name, want, rawHash }); }
}

for (const name of server.keys()) if (!manifest.includes(name)) serverOnly++;

console.log(`server_logged   = ${server.size}`);
console.log(`manifest        = ${manifest.length}`);
console.log('--- 命中口径 ---');
console.log(`raw (磁盘原样)  = ${stat.raw}`);
console.log(`LF 归一后        = ${stat.lf}`);
console.log(`CRLF 归一后      = ${stat.crlf}`);
console.log(`都不命中(真差异) = ${stat.none}`);
console.log(`清单有脚本但服务器无记录 = ${stat.missing}`);
console.log(`服务器有记录但清单无此名 = ${serverOnly}`);
if (stat.changedReal.length) {
  console.log('--- 真差异样例 ---');
  for (const r of stat.changedReal) console.log(`  ${r.name}  server=${r.want.slice(0, 12)}… disk=${r.rawHash.slice(0, 12)}…`);
}
