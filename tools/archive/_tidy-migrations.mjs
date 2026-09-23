// _tidy-migrations.mjs — 迁移清单整理(2026-09-21),两件事:
//   ① 删除「重复登记」:同一脚本被登记多次时,DbSync 第一次执行后即按内容哈希记录,
//      后续同名条目一律被跳过 —— 重复登记不会带来"再跑一次",只会让清单谎报执行顺序。
//   ② 剔除「已中性化的空操作脚本」(内容只剩 PRINT,2026-09-15 事故收口时留下):
//      文件移到 tools/archive/,清单原位留两行说明。
// 用法:node tools/archive/_tidy-migrations.mjs [--dry]
import fs from 'node:fs';
import path from 'node:path';

const repo = path.resolve(import.meta.dirname, '..', '..');
const DRY = process.argv.includes('--dry');
const file = path.join(repo, 'tools', 'db-migrations.txt');
const lines = fs.readFileSync(file, 'utf8').split('\n');

// 已中性化(内容仅 PRINT)的脚本 —— 前置核验会逐个确认文件里没有 DDL/DML
const NEUTRALIZED = [
  'cleanup-base-panels.sql',
  'fix-views-def.sql',
  'fix-views-definitive.sql',
  'fix-views-final.sql',
  'fix-views-v2.sql',
  'fix-views-v3.sql',
  'fix-views-v4.sql',
  'fix-views-v5-gen.sql',
];

const isEntry = (l) => l.trim() !== '' && !l.trim().startsWith('#');
// 中性化脚本里允许的语句:PRINT / GO / SET NOCOUNT / USE(含 2026-09-21 起的守卫形式 IF ... USE ...)
const OK_LINE = /^(PRINT\b|USE\b|GO\b|SET\s+NOCOUNT|IF\s+DB_NAME\(\)\s*=\s*N'master'\s+USE)/i;

// ── 前置核验:NEUTRALIZED 必须确实只剩 PRINT ──────────────────────────────
const problems = [];
for (const n of NEUTRALIZED) {
  const p = path.join(repo, 'tools', n);
  if (!fs.existsSync(p)) { problems.push(n + ' 不存在'); continue; }
  const body = fs.readFileSync(p, 'utf8').split('\n').filter((l) => {
    const t = l.trim();
    return t !== '' && !t.startsWith('--');
  });
  const nonPrint = body.filter((l) => !OK_LINE.test(l.trim()));
  if (nonPrint.length) {
    problems.push(n + ' 仍含非 PRINT 语句 ' + nonPrint.length + ' 行,拒绝剔除');
  }
}
if (problems.length) {
  console.log('前置核验未通过,未改任何东西:');
  for (const p of problems) console.log('  ! ' + p);
  process.exit(1);
}

// ── 逐行处理 ─────────────────────────────────────────────────────────────
const out = [];
const seen = new Map();
let dupCount = 0;
let neuCount = 0;

lines.forEach((l, i) => {
  const t = l.trim();
  if (!isEntry(l)) { out.push(l); return; }

  if (NEUTRALIZED.indexOf(t) >= 0) {
    neuCount++;
    out.push('# ↑ ' + t + ' 已于 2026-09-21 移出清单并归档 tools/archive/ ——');
    out.push('#   该脚本 2026-09-15 事故收口时已中性化(内容仅 PRINT),留在链里只会让“清单里有什么”与“真跑了什么”对不上;');
    out.push('#   中性化原因与原文见 git 历史及 tools/archive/' + t);
    console.log('② L' + (i + 1) + ' 剔除已中性化: ' + t);
    return;
  }

  if (seen.has(t)) {
    dupCount++;
    out.push('# ↑ ' + t + ' 重复登记已删(首次登记在 L' + seen.get(t) + ')——');
    out.push('#   DbSync 按内容哈希跳过未变化脚本,重复登记不会带来“再跑一次”,只会谎报执行顺序。');
    console.log('① L' + (i + 1) + ' 删除重复登记: ' + t + '(首次 L' + seen.get(t) + ')');
    return;
  }
  seen.set(t, i + 1);
  out.push(l);
});

// ── 复验 ────────────────────────────────────────────────────────────────
const before = lines.filter(isEntry).length;
const afterEntries = out.filter(isEntry).map((s) => s.trim());
const dupLeft = afterEntries.filter((n, idx) => afterEntries.indexOf(n) !== idx);
const expect = before - dupCount - neuCount;

console.log('');
console.log('条目 ' + before + ' → ' + afterEntries.length + '(删重复 ' + dupCount + '、剔中性化 ' + neuCount + ')');
if (dupLeft.length) { console.log('仍有重复: ' + [...new Set(dupLeft)].join(', ')); process.exit(1); }
if (afterEntries.length !== expect) { console.log('条目数不符(期望 ' + expect + '),中止'); process.exit(1); }

if (!DRY) fs.writeFileSync(file, out.join('\n'));
console.log(DRY ? 'dry-run,未写盘' : '已写盘');
