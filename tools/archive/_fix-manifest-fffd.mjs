// 一次性修复:db-migrations.txt 276-351 的 50 行 U+FFFD 注释,从 git 历史 128a5be blob
// (该版这批行仍是原始 GBK,U+FFFD 是其后 58e3e8f 才引入)按行号对齐恢复。
// 安全校验:逐行比对替换前后的纯 ASCII 骨架(剥掉所有非 ASCII 字符)必须完全一致,不符即中止。
// 用法:node tools/archive/_fix-manifest-fffd.mjs
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const repo = path.resolve(import.meta.dirname, '..', '..');
const file = path.join(repo, 'tools', 'db-migrations.txt');
const SRC_COMMIT = '128a5be';

const cur = fs.readFileSync(file);
const curLines = cur.toString('latin1').split('\n');
const hist = Buffer.from(execSync(`git show ${SRC_COMMIT}:tools/db-migrations.txt`, { cwd: repo, maxBuffer: 1e8 })).toString('latin1').split('\n');

const u8 = new TextDecoder('utf-8', { fatal: true });
const gbk = new TextDecoder('gb18030');
const skeleton = (s) => s.replace(/[^\x20-\x7E]/g, '');
// 58e3e8f 把 128a5be 时代的 "-- xxx" 注释规范成 "# —— xxx" 时才引入乱码,恢复时做同款前缀变换
const normalizePrefix = (s) => s.replace(/^--\s*/, '# —— ');

let fixed = 0;
const out = curLines.map((line, i) => {
  let curText;
  try { curText = u8.decode(Buffer.from(line, 'latin1')); }
  catch { return line; }
  if (!curText.includes('\uFFFD')) return line;
  // 候选:同行 GBK 原文解码后的原文,及其前缀归一形态(58e3e8f 把遗留 "-- xxx" 规范为 "# xxx",无破折号)
  const decoded = hist[i] !== undefined ? gbk.decode(Buffer.from(hist[i], 'latin1')) : undefined;
  const candidates = decoded === undefined ? [] : [
    decoded,
    decoded.replace(/^--\s*/, '# '),
    normalizePrefix(decoded),
  ];
  const hit = candidates.find((c) => skeleton(c) === skeleton(curText));
  if (!hit) throw new Error(`第 ${i + 1} 行无匹配源行,中止:\n  现:${curText.slice(0, 90)}\n  源:${candidates[0]?.slice(0, 90)}`);
  fixed++;
  return Buffer.from(hit, 'utf8').toString('latin1');
});

fs.writeFileSync(file, Buffer.from(out.join('\n'), 'latin1'));
console.log(`恢复 ${fixed} 行(源 ${SRC_COMMIT},均通过 ASCII 骨架校验)`);
