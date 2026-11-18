// 一次性取证:APK 内容核验(2026-11-18 出 1.0.25)
// 用法:node tools/archive/_apk-1025-20261118/verify-apk.mjs [apk路径] [dist目录]
// 返回:每项 PASS/FAIL;任一 FAIL ⇒ exit 1
import fs from 'node:fs';
import zlib from 'node:zlib';
import crypto from 'node:crypto';

const APK = process.argv[2] || 'android/dist/yinjia-mes-1.0.25.apk';
const DIST = process.argv[3] || 'frontend/dist';
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
  if (apk.readUInt32LE(p) !== 0x02014b50) throw new Error('中央目录损坏 @' + p);
  const method = apk.readUInt16LE(p + 10);
  const csize = apk.readUInt32LE(p + 20);
  const usize = apk.readUInt32LE(p + 24);
  const nlen = apk.readUInt16LE(p + 28);
  const extra = apk.readUInt16LE(p + 30);
  const cmt = apk.readUInt16LE(p + 32);
  const lho = apk.readUInt32LE(p + 42);
  entries.push({ name: apk.toString('utf8', p + 46, p + 46 + nlen), method, csize, usize, lho });
  p += 46 + nlen + extra + cmt;
}

function dataOf(en) {
  if (apk.readUInt32LE(en.lho) !== 0x04034b50) throw new Error('本地头损坏 ' + en.name);
  const nlen = apk.readUInt16LE(en.lho + 26);
  const elen = apk.readUInt16LE(en.lho + 28);
  const raw = apk.slice(en.lho + 30 + nlen + elen, en.lho + 30 + nlen + elen + en.csize);
  const out = en.method === 8 ? zlib.inflateRawSync(raw) : raw;
  if (out.length !== en.usize) throw new Error(`大小不符 ${en.name}`);
  return out;
}

let fails = 0;
const check = (ok, label, extra = '') => {
  if (!ok) fails++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${extra ? '  ' + extra : ''}`);
};

const www = entries.filter((x) => x.name.startsWith('assets/www/'));
const backslash = entries.filter((x) => x.name.includes('\\'));
check(backslash.length === 0, '0 个反斜杠 zip 条目', `(共 ${entries.length} 条目)`);
for (const n of ['classes.dex', 'AndroidManifest.xml', 'resources.arsc', 'assets/www/index.html']) {
  check(entries.some((x) => x.name === n), `必需条目存在 ${n}`);
}

const ib = dataOf(entries.find((x) => x.name === 'assets/www/index.html'));
const lb = fs.readFileSync(DIST + '/index.html');
check(ib.equals(lb), 'assets/www/index.html 与 dist 逐字节一致', `(${ib.length} 字节)`);

const dex = dataOf(entries.find((x) => x.name === 'classes.dex'));
const latin = dex.toString('latin1');
const natives = ['scanMulti', 'takePhoto', 'hasCamera', '__yjPhotoResult', '__yjScanResultMulti'];
check(natives.every((x) => latin.includes(x)), 'dex 含全部原生桥方法', natives.join('/'));
console.log(`      dex ${dex.length} 字节,class_defs_size=${dex.readUInt32LE(96)}`);

let same = 0;
const diff = [];
for (const en of www) {
  const rel = en.name.slice('assets/www/'.length);
  const localPath = DIST + '/' + rel;
  if (!fs.existsSync(localPath)) { diff.push('MISSING ' + rel); continue; }
  const h1 = crypto.createHash('sha256').update(dataOf(en)).digest('hex');
  const h2 = crypto.createHash('sha256').update(fs.readFileSync(localPath)).digest('hex');
  if (h1 === h2) same++; else diff.push(rel);
}
check(diff.length === 0 && same === www.length, 'assets/www 与 dist 逐文件同哈希', `${same}/${www.length}`);
if (diff.length) console.log('      差异:', diff.slice(0, 8));

const manifest = dataOf(entries.find((x) => x.name === 'AndroidManifest.xml')).toString('utf8');
// 二进制 manifest 只在资源池里留字符串,属性名查不到 ⇒ 由 aapt2 dump xmltree 另行核验
console.log(`      manifest 字节数 ${manifest.length}(cleartext/networkSecurityConfig 用 aapt2 dump xmltree 核验)`);

console.log(`\n结果:${fails === 0 ? 'ALL PASS' : fails + ' 项 FAIL'}`);
process.exit(fails === 0 ? 0 : 1);
