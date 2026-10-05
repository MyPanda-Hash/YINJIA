#!/usr/bin/env node
/**
 * _i18n-eol-restore.cjs — 把语言包里"本来就该是 CRLF 的行"还原回去。
 *
 * 背景(2026-10-03 实测):仓库里的 `frontend/src/i18n/locales/*.js` **本身是混合行尾** ——
 * 绝大多数行 LF,但个别行(如 '特采' / '送检数量' 两行)在 HEAD 里就是 CRLF,而 `core.autocrlf=false`
 * 会把它们原样存下来。批量写语言包的脚本(Node,按 '\n' 切分再 join)会顺手把这些 CRLF 抹成 LF,
 * 于是 `git diff` 里多出两行"看着一模一样"的假改动,淹没真正的词条变更。
 *
 * 本脚本按 **HEAD 版本逐行对照**:HEAD 行尾带 \r 而工作区同内容行没有 \r 的,补回 \r。
 * 只动行尾字符,不动任何内容。幂等。
 *
 * ⚠ 为什么不在这里直接调 `git`:`child_process` 走管道 stdio 在本机沙箱下会 EPERM
 * (Node spawn/exec 默认 stdio:'pipe' 被拒)。故 HEAD 内容**由外部先导出成文件**:
 *
 *   cmd /c "git cat-file blob HEAD:frontend/src/i18n/locales/<name> > %TEMP%\dsh-eol-head\<name>"
 *   node tools/archive/_i18n-eol-restore.cjs
 *
 * 用法(仓库根):node tools/archive/_i18n-eol-restore.cjs [--head-dir <目录>] [文件名...]
 */
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const DIR = path.join(ROOT, 'frontend', 'src', 'i18n', 'locales');

const argv = process.argv.slice(2);
let headDir = path.join(os.tmpdir(), 'dsh-eol-head');
const rest = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--head-dir') { headDir = argv[++i]; continue; }
  rest.push(argv[i]);
}
const files = rest.length ? rest : fs.readdirSync(DIR).filter((f) => f.endsWith('.js'));

if (!fs.existsSync(headDir)) {
  console.error(`✗ HEAD 导出目录不存在:${headDir}\n  先按文件头注释里的 cmd 把 HEAD 版本导出来。`);
  process.exit(1);
}

let totalFixed = 0;
for (const name of files) {
  const full = path.join(DIR, name);
  const headFile = path.join(headDir, name);
  if (!fs.existsSync(full)) { console.log(`[skip] ${name} 不存在`); continue; }
  if (!fs.existsSync(headFile)) { console.log(`[skip] ${name} 没有 HEAD 导出(新文件?)`); continue; }

  const crLines = new Set();
  for (const line of fs.readFileSync(headFile, 'utf8').split('\n')) {
    if (line.endsWith('\r')) crLines.add(line.slice(0, -1));
  }
  if (!crLines.size) { console.log(`[ok]   ${name} HEAD 无 CRLF 行`); continue; }

  const lines = fs.readFileSync(full, 'utf8').split('\n');
  let fixed = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].endsWith('\r')) continue;                 // 已是 CRLF
    if (crLines.has(lines[i])) { lines[i] += '\r'; fixed++; }
  }
  if (fixed) fs.writeFileSync(full, lines.join('\n'), 'utf8');
  totalFixed += fixed;
  console.log(`${fixed ? '[fix] ' : '[ok]  '}${name} 还原 CRLF ${fixed} 行`);
}
console.log(`\n合计还原 ${totalFixed} 行行尾`);
