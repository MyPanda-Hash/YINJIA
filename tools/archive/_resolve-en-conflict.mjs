// 合并 frontend/src/i18n/locales/en.js 冲突:本地块全量保留 + 追加远端生产域新增词条(去重,key 已存在则不覆盖本地值)。
// 用法: node tools/archive/_resolve-en-conflict.mjs
import fs from 'node:fs';
import path from 'node:path';

const file = path.join(process.cwd(), 'frontend', 'src', 'i18n', 'locales', 'en.js');
const text = fs.readFileSync(file, 'utf8');
const lines = text.split('\n');
const findMark = (re, from = 0) => {
  for (let i = from; i < lines.length; i++) if (re.test(lines[i])) return i;
  throw new Error('未找到标记 ' + re);
};
const iOurs = findMark(/^<<<<<<< HEAD/);
const iSep = findMark(/^=======/, iOurs + 1);
const iTheirs = findMark(/^>>>>>>>/, iSep + 1);

const ours = lines.slice(iOurs + 1, iSep);
const theirs = lines.slice(iSep + 1, iTheirs);
const outside = [...lines.slice(0, iOurs), ...lines.slice(iTheirs + 1)];

const KEY = /^\s*'((?:[^'\\]|\\.)*)'\s*:/;
const keysOf = (arr) => new Set(arr.map((l) => (l.match(KEY) || [])[1]).filter(Boolean));
const known = new Set([...keysOf(ours), ...keysOf(outside)]);

const extra = [];
let pending = [];
let kept = 0;
const skipped = [];
for (const l of theirs) {
  const m = l.match(KEY);
  if (m) {
    if (known.has(m[1])) { skipped.push(m[1]); pending = []; continue; }
    if (pending.length) { extra.push(''); extra.push(...pending); pending = []; }
    extra.push(l);
    known.add(m[1]);
    kept++;
  } else if (/^\s*\/\//.test(l)) {
    pending.push(l);
  } else if (l.trim() === '') {
    // 空行不单独保留(块内由注释分组自然分隔)
  } else {
    extra.push(l); // 非 key 非注释(续行等)一律保留
  }
}

const out = [...lines.slice(0, iOurs), ...ours, ...extra, ...lines.slice(iTheirs + 1)];
fs.writeFileSync(file, out.join('\n'));
console.log(`en.js 合并完成: 本地保留 ${ours.length} 行,远端追加 ${extra.length} 行(新词条 ${kept} 条)`);
console.log(`因 key 已存在而跳过(不覆盖本地值) ${skipped.length} 条:`, JSON.stringify(skipped));
