// 一次性修复:db-migrations.txt 被 GBK 编码写入的注释行转回 UTF-8(2026-09-17 远程拉取带入)
// 逐行判定:UTF-8 严格解码成功→字节原样保留;失败→按 GB18030 解码再编码为 UTF-8。
// 用法:node tools/archive/_fix-utf8-manifest.mjs [文件路径,默认 tools/db-migrations.txt]
import fs from 'node:fs';
import path from 'node:path';

const file = process.argv[2] || path.resolve(import.meta.dirname, '..', 'db-migrations.txt');
const buf = fs.readFileSync(file);
const latin = buf.toString('latin1').split('\n');
const utf8 = new TextDecoder('utf-8', { fatal: true });
const gbk = new TextDecoder('gb18030');

let fixed = 0;
const out = latin.map((line) => {
  const b = Buffer.from(line, 'latin1');
  try {
    utf8.decode(b);
    return b;
  } catch {
    fixed++;
    return Buffer.from(gbk.decode(b), 'utf8');
  }
});
fs.writeFileSync(file, Buffer.concat(out.map((b, i) => Buffer.concat([b, i < out.length - 1 ? Buffer.from('\n') : Buffer.alloc(0)]))));
console.log(`修复 ${file}: ${fixed} 行 GBK → UTF-8,共 ${latin.length} 行`);
