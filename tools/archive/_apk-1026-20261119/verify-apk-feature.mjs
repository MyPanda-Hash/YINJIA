// 一次性取证:1.0.26 包里是否真带上了本版前端改动(研发样品链 + 产品信息表新版式)
// 用法:node tools/archive/_apk-1026-20261119/verify-apk-feature.mjs [apk路径]
import fs from 'node:fs';
import zlib from 'node:zlib';

const APK = process.argv[2] || 'android/dist/yinjia-mes-1.0.26.apk';
const apk = fs.readFileSync(APK);

let eocd = -1;
for (let i = apk.length - 22; i >= Math.max(0, apk.length - 70000); i--) {
  if (apk.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
}
if (eocd < 0) throw new Error('找不到 EOCD');

const count = apk.readUInt16LE(eocd + 10);
let p = apk.readUInt32LE(eocd + 16);
const entries = [];
for (let k = 0; k < count; k++) {
  const method = apk.readUInt16LE(p + 10);
  const csize = apk.readUInt32LE(p + 20);
  const nlen = apk.readUInt16LE(p + 28);
  const extra = apk.readUInt16LE(p + 30);
  const cmt = apk.readUInt16LE(p + 32);
  const lho = apk.readUInt32LE(p + 42);
  entries.push({ name: apk.toString('utf8', p + 46, p + 46 + nlen), method, csize, lho });
  p += 46 + nlen + extra + cmt;
}

function dataOf(en) {
  const nlen = apk.readUInt16LE(en.lho + 26);
  const elen = apk.readUInt16LE(en.lho + 28);
  const start = en.lho + 30 + nlen + elen;
  const raw = apk.slice(start, start + en.csize);
  return en.method === 8 ? zlib.inflateRawSync(raw) : raw;
}

const www = entries.filter((x) => x.name.startsWith('assets/www/'));
const byName = new Map(www.map((x) => [x.name.slice('assets/www/'.length), x]));

let fails = 0;
const check = (ok, label, extra = '') => {
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`);
};

// ① 入口 chunk 与 dist 一致(本版重建后入口是 index-iYdM11Gt.js)
const indexHtml = dataOf(byName.get('index.html')).toString('utf8');
const entry = (indexHtml.match(/assets\/index-[A-Za-z0-9_-]+\.js/) || [''])[0];
check(entry === 'assets/index-iYdM11Gt.js', 'APK 入口 chunk = 本版重建产物', entry);
check(byName.has(entry), '入口 chunk 在 assets/www 内');

// ② 新功能 chunk 存在
for (const f of ['assets/SampleFlow-DH6er9S_.js', 'assets/PanelxList-zgzGfnrI.js', 'assets/RecordSheetPanels-CHznrMqs.js']) {
  check(byName.has(f), `新前端 chunk 在包内 ${f}`);
}

// ③ 关键词落在对应 chunk 里
const needles = [
  ['样品进度跟踪', 'assets/SampleFlow-DH6er9S_.js'],
  ['产品整体尺寸', 'assets/PanelxList-zgzGfnrI.js'],
  ['立项编号', 'assets/PanelxList-zgzGfnrI.js'],
];
for (const [kw, chunk] of needles) {
  const en = byName.get(chunk);
  const txt = en ? dataOf(en).toString('utf8') : '';
  check(txt.includes(kw), `「${kw}」在 ${chunk} 内`);
}

console.log(`\n结果:${fails === 0 ? 'ALL PASS' : fails + ' 项 FAIL'}`);
process.exit(fails === 0 ? 0 : 1);
