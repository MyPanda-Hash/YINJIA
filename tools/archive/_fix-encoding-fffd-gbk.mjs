// _fix-encoding-fffd-gbk.mjs — 一次性编码修复(2026-09-21),三类缺陷统一处理:
//   ① GBK 字节行      (文件是 UTF-8,个别行是 GBK 字节写入)→ 按 GB18030 逐行还原
//   ② U+FFFD 已被销毁 → 原文已不可还原,必须从 git 历史 blob 取 GBK 原文(ASCII 骨架校验后替换)
//   ③ U+FFFD 本身是机翻垃圾(历史 blob 里也坏)→ 只剥掉坏字符,其余一个字节不动
// 安全纪律(沿用 tools/archive/_fix-manifest-fffd.mjs 的做法):
//   - 按 latin1 逐字节处理,绝不整文件 utf8 读取后再写(那正是当初把这些行写坏的动作)
//   - 骨架校验:替换前后剥掉所有非 ASCII 后的字符串必须完全一致,不符即中止
//   - 先在内存算出全部结果并校验,全部通过才落盘;--dry 只报不改
// 用法:node tools/archive/_fix-encoding-fffd-gbk.mjs [--dry]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const repo = path.resolve(import.meta.dirname, '..', '..');
const DRY = process.argv.includes('--dry');
const strict = new TextDecoder('utf-8', { fatal: true });
const gbk = new TextDecoder('gb18030');
const skeleton = (s) => s.replace(/[^\x20-\x7E]/g, '');

// ── ① 归档探针输出:文件里「非 UTF-8 的行」按 GB18030 还原 ────────────────────
const GBK_FILES = [
  'tools/archive/_probe-place.out.txt',
  'tools/archive/_probe-insp-final.out.txt',
  'tools/archive/_probe-refs.out.txt',
  'tools/archive/_q-seedA.out.txt',
  'tools/archive/_q-seedtest.out.txt',
  'tools/archive/_seed-demo.out.txt',
  'tools/archive/_q-e2e-recon.out.txt',
  'tools/archive/_seed2.out.txt',
];

// ── ② 从 git 历史 blob 恢复(当前行已被 U+FFFD 销毁)─────────────────────────
// 该行由 bccac4d 引入,当时是 GBK 字节;此后被某次「整文件按 UTF-8 误读回写」销毁。
const FROM_HISTORY = [
  {
    file: 'tools/db-migrations.txt',
    lineNo: 793,
    blob: 'bccac4d:tools/db-migrations.txt',
    why: '行由 bccac4d 引入时即 GBK 字节,后被按 UTF-8 误读回写成 U+FFFD',
  },
];

// ── ③ 机翻返回值自身带 U+FFFD(连历史 blob 里也是坏的,无从还原)→ 只剥坏字符 ──
// 只删 U+FFFD、其余一个字节不动:坏字符丢掉的原字无从得知,任何"顺手改文案"都是伪造修复。
// 骨架校验会挡住"顺手改":删空格/加括号都会让骨架变化而中止。
const STRIP_FFFD = [
  {
    file: 'frontend/src/i18n/locales/zh-TW.js',
    lineNo: 1341,
    why: '该行由 158ea03 机翻补缺口写入时(即 git blob 原文)就含 2 个 U+FFFD;'
      + '同批 de/ru/th/vi/ko/es 均为「文字 + 空格 + kgf」,空格是 ASCII 未被损坏,故保留、只删坏字符',
  },
];

const readLines = (abs) => fs.readFileSync(abs).toString('latin1').split('\n');
const asText = (line) => {
  try { return strict.decode(Buffer.from(line, 'latin1')); } catch { return null; }
};

const results = new Map();   // rel -> Buffer(待落盘/待校验的新内容)
const problems = [];
let changed = 0;

const stage = (rel, lines) => results.set(rel, Buffer.from(lines.join('\n'), 'latin1'));

// ① GBK 行还原
for (const rel of GBK_FILES) {
  const lines = readLines(path.join(repo, rel));
  let n = 0;
  const out = lines.map((line) => {
    if (!line.length || asText(line) !== null) return line;   // 空行 / 已是合法 UTF-8
    const decoded = gbk.decode(Buffer.from(line, 'latin1'));
    if (decoded.includes('\uFFFD')) { problems.push(`${rel} 有 GBK 也解不出的字节`); return line; }
    n++;
    return Buffer.from(decoded, 'utf8').toString('latin1');
  });
  if (!n) { problems.push(`${rel}: 未发现非 UTF-8 行(期望有,请复核)`); continue; }
  changed += n;
  console.log(`① ${rel}: 还原 ${n} 行 GBK → UTF-8`);
  stage(rel, out);
}

// ② 从 git 历史 blob 恢复
for (const spec of FROM_HISTORY) {
  const lines = readLines(path.join(repo, spec.file));
  const cur = asText(lines[spec.lineNo - 1]);
  if (cur === null) { problems.push(`${spec.file}:${spec.lineNo} 当前不是合法 UTF-8,与预期不符`); continue; }
  if (!cur.includes('\uFFFD')) { problems.push(`${spec.file}:${spec.lineNo} 已无 U+FFFD(可能已修过)`); continue; }

  const blob = execFileSync('git', ['show', spec.blob], { cwd: repo, maxBuffer: 1e8 }).toString('latin1');
  const want = skeleton(cur);
  const cands = blob.split('\n')
    .filter((l) => l && asText(l) === null)                        // 历史里同为非 UTF-8 的行
    .map((l) => gbk.decode(Buffer.from(l, 'latin1')))
    .filter((t) => skeleton(t) === want);
  if (cands.length !== 1) { problems.push(`${spec.file}:${spec.lineNo} 历史匹配 ${cands.length} 条(需恰好 1 条)`); continue; }

  lines[spec.lineNo - 1] = Buffer.from(cands[0], 'utf8').toString('latin1');
  changed++;
  console.log(`② ${spec.file}:${spec.lineNo} 从 ${spec.blob} 恢复(ASCII 骨架校验通过)`);
  console.log(`   → ${cands[0].slice(0, 110)}`);
  stage(spec.file, lines);
}

// ③ 剥掉 U+FFFD
for (const spec of STRIP_FFFD) {
  const lines = readLines(path.join(repo, spec.file));
  const cur = asText(lines[spec.lineNo - 1]);
  if (cur === null) { problems.push(`${spec.file}:${spec.lineNo} 当前不是合法 UTF-8`); continue; }
  const n = (cur.match(/\uFFFD/g) || []).length;
  if (!n) { problems.push(`${spec.file}:${spec.lineNo} 已无 U+FFFD(可能已修过)`); continue; }
  const fixed = cur.replace(/\uFFFD/g, '');
  if (skeleton(fixed) !== skeleton(cur)) { problems.push(`${spec.file}:${spec.lineNo} 剥除后骨架变化,拒改`); continue; }
  console.log(`③ ${spec.file}:${spec.lineNo} 剥除 ${n} 个 U+FFFD`);
  console.log(`   - ${cur.trim()}\n   + ${fixed.trim()}`);
  console.log(`   依据:${spec.why}`);
  lines[spec.lineNo - 1] = Buffer.from(fixed, 'utf8').toString('latin1');
  changed++;
  stage(spec.file, lines);
}

// ── 校验(内存)────────────────────────────────────────────────────────────
for (const [rel, buf] of results) {
  try { strict.decode(buf); } catch { problems.push(`${rel} 修复后仍有非法 UTF-8 字节`); }
  const left = (buf.toString('utf8').match(/\uFFFD/g) || []).length;
  if (left) problems.push(`${rel} 修复后仍剩 ${left} 个 U+FFFD`);
}
const got = new Set(results.keys());
for (const rel of [...GBK_FILES, ...FROM_HISTORY.map((x) => x.file), ...STRIP_FFFD.map((x) => x.file)]) {
  if (!got.has(rel)) problems.push(`${rel} 未产出修复结果`);
}

// ── 落盘 ─────────────────────────────────────────────────────────────────
if (problems.length) {
  console.log(`\n共处理 ${changed} 处,校验未通过,未写盘。需人工复核:`);
  for (const p of problems) console.log('  ! ' + p);
  process.exit(1);
}
if (!DRY) for (const [rel, buf] of results) fs.writeFileSync(path.join(repo, rel), buf);
console.log(`\n共修复 ${changed} 处 / ${results.size} 个文件${DRY ? '(dry-run,未写盘)' : ',已落盘'};全部通过严格 UTF-8 与无残留 U+FFFD 校验`);
