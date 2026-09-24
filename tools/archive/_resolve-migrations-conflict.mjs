// 合并 tools/db-migrations.txt 冲突(字节级):保本地全量 + 仅追加远端生产域新增条目。
// 用法: node tools/archive/_resolve-migrations-conflict.mjs
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const file = path.join(root, 'tools', 'db-migrations.txt');
const b = fs.readFileSync(file);

const idx = (needle, from = 0) => {
  const n = Buffer.from(needle, 'ascii');
  const i = b.indexOf(n, from);
  if (i < 0) throw new Error(`未找到标记: ${needle}`);
  return i;
};

const iOurs = idx('<<<<<<< HEAD');
const iSep = idx('=======', iOurs + 10);
const iTheirs = idx('>>>>>>>', iSep + 7);

const skipEolFwd = (i) => { while (i < b.length && (b[i] === 13 || b[i] === 10)) i++; return i; };
const skipEolBack = (i, lo) => { while (i > lo && (b[i - 1] === 13 || b[i - 1] === 10)) i--; return i; };
const eolEnd = (i) => { while (i < b.length && b[i] !== 10) i++; return i + 1; };

const oursStart = skipEolFwd(iOurs + 10);
const oursEnd = skipEolBack(iSep, oursStart);
const ours = b.subarray(oursStart, oursEnd);

const theirsStart = skipEolFwd(iSep + 7);
const theirsEnd = skipEolBack(iTheirs, theirsStart);
const theirs = b.subarray(theirsStart, theirsEnd);

const anchor = Buffer.from('migrate-material-inspection-field.sql', 'ascii');
const iAnchor = theirs.lastIndexOf(anchor);
if (iAnchor < 0) throw new Error('远端段未找到 migrate-material-inspection-field.sql 锚点');
let addStart = iAnchor + anchor.length;
while (addStart < theirs.length && theirs[addStart] !== 10) addStart++; // 跳到该行行尾
addStart++;
const additions = theirs.subarray(addStart);

const tailStart = skipEolFwd(eolEnd(iTheirs + 9));
const tail = tailStart < b.length ? b.subarray(tailStart) : Buffer.alloc(0);

const out = Buffer.concat([
  b.subarray(0, iOurs),
  ours,
  Buffer.from('\r\n', 'ascii'),
  additions,
  tail,
]);
fs.writeFileSync(file, out);
console.log(`解析完成: ours=${ours.length}B additions=${additions.length}B tail=${tail.length}B total=${out.length}B`);
console.log('追加的首尾:', JSON.stringify(additions.subarray(0, 60).toString('utf8')), '...', JSON.stringify(additions.subarray(-80).toString('utf8')));
