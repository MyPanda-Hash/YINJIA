// 一次性探针:在 git 历史中定位 db-migrations.txt 276-351 乱码注释的可恢复原文
// 逐提交取 blob,按行判定:合法UTF-8中文 / 原始GBK(可恢复)/ U+FFFD(已损)。
// 用法:node tools/archive/_probe-manifest-history.mjs
import { execSync } from 'node:child_process';

const commits = execSync('git log --format=%H --reverse 29d2063..10968f5 -- tools/db-migrations.txt', { encoding: 'utf8', cwd: '../..' }).trim().split('\n');
console.log('触碰清单的提交数:', commits.length);
const u8 = new TextDecoder('utf-8', { fatal: true });

for (const c of commits) {
  let buf;
  try { buf = Buffer.from(execSync(`git show ${c}:tools/db-migrations.txt`, { maxBuffer: 1e8, cwd: '../..' })); }
  catch (e) { console.log(`${c.slice(0, 7)} [skip] ${String(e.message).split('\n')[0]}`); continue; }
  const raw = buf.toString('latin1').split('\n');
  let ok = 0, gbkLines = [], fffdLines = [];
  for (let i = 0; i < raw.length; i++) {
    const b = Buffer.from(raw[i], 'latin1');
    let s;
    try { s = u8.decode(b); } catch { gbkLines.push(i + 1); continue; }
    if (s.includes('\uFFFD')) fffdLines.push(i + 1); else ok++;
  }
  console.log(`${c.slice(0, 7)} 总行${raw.length} 纯UTF8行${ok} GBK行${gbkLines.length} U+FFFD行${fffdLines.length}`,
    gbkLines.length ? `GBK@${gbkLines.slice(0, 8).join(',')}${gbkLines.length > 8 ? '…' : ''}` : '',
    fffdLines.length ? `FFFD@${fffdLines.slice(0, 8).join(',')}${fffdLines.length > 8 ? '…' : ''}` : '');
}
