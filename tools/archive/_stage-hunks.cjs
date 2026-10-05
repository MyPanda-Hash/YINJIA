#!/usr/bin/env node
/**
 * _stage-hunks.cjs — 只把**本任务**的 hunk 暂存进 index(工作区里还有别的任务在改同一批文件)。
 *
 * 用法:node tools/archive/_stage-hunks.cjs <文件> <保留该正则的 hunk 才暂存> [<文件> <正则> ...]
 * 做法:git diff 出该文件的补丁 → 按 hunk 过滤(保留 @@ 之后的正文命中正则的 hunk)→ git apply --cached。
 * 注意:正则匹配的是 hunk **正文**,不是 @@ 行。
 */
'use strict';
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const argv = process.argv.slice(2);
if (argv.length < 2 || argv.length % 2) {
  console.error('用法: node tools/archive/_stage-hunks.cjs <文件> <hunk 正文正则> [...]');
  process.exit(2);
}

for (let i = 0; i < argv.length; i += 2) {
  const file = argv[i];
  const re = new RegExp(argv[i + 1]);
  const full = execFileSync('git', ['diff', '--', file], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 }).toString('utf8');
  if (!full.trim()) { console.log(`[skip] ${file} 无改动`); continue; }
  const lines = full.split('\n');
  const head = [];
  let j = 0;
  for (; j < lines.length; j++) { head.push(lines[j]); if (lines[j].startsWith('@@')) break; }
  // head 已含第一个 @@ 行;把它当作第一个 hunk 的起始
  const hunks = [];
  let cur = null;
  for (; j < lines.length; j++) {
    if (lines[j].startsWith('@@')) { cur = [lines[j]]; hunks.push(cur); } else if (cur) cur.push(lines[j]);
  }
  // head 里最后一行是第一个 @@,把它并入第一个 hunk 的开头
  if (hunks.length) hunks[0].unshift(head.pop());
  const kept = hunks.filter((h) => re.test(h.join('\n')));
  if (!kept.length) { console.log(`[skip] ${file} 没有命中正则的 hunk`); continue; }
  if (kept.length === hunks.length) {
    execFileSync('git', ['add', '--', file], { cwd: ROOT });
    console.log(`[add ] ${file} 全部 ${hunks.length} 个 hunk(整文件属于本任务)`);
    continue;
  }
  const patch = [...head, ...kept.flat()].join('\n');
  const tmp = path.join(os.tmpdir(), 'stage-hunks-' + path.basename(file) + '.patch');
  fs.writeFileSync(tmp, patch, 'utf8');
  execFileSync('git', ['apply', '--cached', '--whitespace=nowarn', tmp], { cwd: ROOT, stdio: 'inherit' });
  console.log(`[add ] ${file} 暂存 ${kept.length}/${hunks.length} 个 hunk`);
}
