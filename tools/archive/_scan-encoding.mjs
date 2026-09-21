// _scan-encoding.mjs — 全仓编码体检:找出「非 UTF-8 字节行」与「已被 U+FFFD 销毁的行」
// 前者可用 GB18030 直接还原;后者必须回 git 历史找 GBK 原文。
// 用法:node tools/archive/_scan-encoding.mjs [--all]
import fs from 'node:fs';
import path from 'node:path';

const repo = path.resolve(import.meta.dirname, '..', '..');
const EXT = new Set(['.sql', '.md', '.js', '.mjs', '.cjs', '.vue', '.java', '.txt', '.json',
  '.yml', '.yaml', '.bat', '.cmd', '.ps1', '.jrxml', '.properties', '.html', '.css', '.ts', '.vbs']);
const SKIP = /[\\/](node_modules|target|dist|\.git|\.m2-repo|\.vite|apache-maven)[\\/]/;
const strict = new TextDecoder('utf-8', { fatal: true });
const lenient = new TextDecoder('utf-8');

const badBytes = [];   // 非 UTF-8 字节(可 GBK 还原)
const destroyed = [];  // 含 U+FFFD(原文已丢,需 git 历史)
let scanned = 0;

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (SKIP.test(p + path.sep)) continue;
    if (e.isDirectory()) { walk(p); continue; }
    if (!EXT.has(path.extname(e.name).toLowerCase())) continue;
    const buf = fs.readFileSync(p);
    if (buf.includes(0)) continue;
    if (buf.length > 8 * 1024 * 1024) continue;
    scanned++;
    const rel = path.relative(repo, p).replace(/\\/g, '/');
    const lines = buf.toString('latin1').split('\n');
    lines.forEach((l, i) => {
      const raw = Buffer.from(l, 'latin1');
      if (!raw.length) return;
      let badByte = false;
      try { strict.decode(raw); } catch { badByte = true; }
      const n = (lenient.decode(raw).match(/\uFFFD/g) || []).length;
      if (badByte) badBytes.push({ rel, line: i + 1, n, head: lenient.decode(raw).slice(0, 70) });
      else if (n) destroyed.push({ rel, line: i + 1, n, head: lenient.decode(raw).slice(0, 70) });
    });
  }
}

walk(repo);

const group = (arr) => {
  const m = new Map();
  for (const x of arr) {
    if (!m.has(x.rel)) m.set(x.rel, { lines: 0, chars: 0, first: x.line });
    const g = m.get(x.rel); g.lines++; g.chars += x.n;
  }
  return [...m.entries()].sort((a, b) => b[1].chars - a[1].chars);
};

console.log(`扫描 ${scanned} 个文本文件\n`);
console.log(`=== A) 非 UTF-8 字节行(可 GB18030 直接还原):${badBytes.length} 行 / ${new Set(badBytes.map(x => x.rel)).size} 文件 ===`);
for (const [rel, g] of group(badBytes)) console.log(`  ${String(g.chars).padStart(5)} 坏字节  ${String(g.lines).padStart(3)} 行  ${rel}`);
for (const x of badBytes.slice(0, 10)) console.log(`    ${x.rel}:${x.line}  ${x.head}`);

console.log(`\n=== B) 含 U+FFFD 的行(原文已销毁,需 git 历史恢复):${destroyed.length} 行 / ${new Set(destroyed.map(x => x.rel)).size} 文件 ===`);
for (const [rel, g] of group(destroyed)) console.log(`  ${String(g.chars).padStart(5)} 个 FFFD  ${String(g.lines).padStart(3)} 行  ${rel}`);
for (const x of destroyed.slice(0, 10)) console.log(`    ${x.rel}:${x.line}  ${x.head}`);
