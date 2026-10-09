/**
 * _merge-migrations.cjs — 把 tools/db-migrations.txt 的冲突块合成为并集
 *
 * 顺序依据(逐条有出处,不是拍脑袋):
 *   · 远端 13 条(10-07 lab-sheets / server-converge → 10-08 四单三条 + whloc 八条)保持其原有相对顺序;
 *   · 四单三条硬约束:bloodline-cols → missing-cols → baseline-restore(脚本头「必须排在回正脚本之前」);
 *   · 本地 6 条(10-08 align×2 / wh-kingdee-only / drop-extra-docs / 10-09 fix-views / drop-qc)
 *     按本地原相对顺序插入,但 **wh-kingdee-only 必须排在 whloc 建仓之前** ——
 *     它自检① 是「启用中非金蝶来源仓(应为 0)」的**全局**判定,而 whloc 会新建
 *     CK-A/CK-C/CK-D 等无 外部数据ID 的仓;排反则自检必然 RAISERROR、DbSync 失败。
 *     (历史顺序亦如此:本机 10-08 14:02 已执行 wh-kingdee-only,远端的 whloc 以「现存 6 行」为前提。)
 */
const fs = require('node:fs');
const path = require('node:path');

const file = path.join(__dirname, '..', '..', 'db-migrations.txt');
const raw = fs.readFileSync(file, 'utf8');
const lines = raw.split(/\r?\n/);

const iStart = lines.findIndex((l) => l.startsWith('<<<<<<<'));
const iMid = lines.findIndex((l, i) => i > iStart && l.startsWith('======='));
const iEnd = lines.findIndex((l, i) => i > iMid && l.startsWith('>>>>>>>'));
if (iStart < 0 || iMid < 0 || iEnd < 0) throw new Error('未找到冲突标记');

const headPart = lines.slice(0, iStart);
const localSide = lines.slice(iStart + 1, iMid);
const originSide = lines.slice(iMid + 1, iEnd);

/** 从一组行里切出「以某行开头的块」:从含 marker 的行起到下一个同级块头(或末尾) */
function cutBlock(arr, startsWith) {
  const i = arr.findIndex((l) => l.startsWith(startsWith));
  if (i < 0) throw new Error('找不到块: ' + startsWith);
  let j = i + 1;
  // 块延续到下一个以 '#' 开头且是「条目头」(形如 '# ── ' / '# —— ' / '# migrate-')的行
  while (j < arr.length) {
    const l = arr[j];
    if (/^#\s*(──|——)/.test(l) || /^#\s*migrate-/.test(l)) break;
    j++;
  }
  return { block: arr.slice(i, j), rest: arr.slice(0, i).concat(arr.slice(j)) };
}

// —— origin 侧切两段:四单/实验室段 | whloc 整段(rename-bin → zonepick) ——
const oWhStart = originSide.findIndex((l) => l.startsWith('# migrate-whloc-rename-bin-20261008.sql'));
if (oWhStart < 0) throw new Error('找不到 whloc 段起点');
const oPre = originSide.slice(0, oWhStart);
const oWhloc = originSide.slice(oWhStart);

// —— local 侧切三段:align×2 | wh-kingdee | 其余 ——
let lRest = localSide.slice();
const lWh = cutBlock(lRest, '# —— 2026-10-08 仓库档案对齐金蝶真实账套');
lRest = lWh.rest;
const lFix = cutBlock(lRest, '# —— 2026-10-09 修 3 个');
const lDrop = cutBlock(lFix.rest, '# —— 2026-10-09 下架品质管理');
const lPuReq = cutBlock(lDrop.rest, '# —— 2026-10-08 下架「请购单');
const lAlign = lPuReq.rest;

const out = [
  ...headPart,
  ...oPre,            // 10-07 lab-sheets / server-converge + 10-08 四单三条(bloodline→missing→restore)
  ...lAlign,          // 10-08 测试库字段对齐(local×2)
  ...lWh.block,       // 10-08 仓库对齐金蝶 —— 必须早于 whloc 建仓
  ...oWhloc,           // 10-08 whloc 八条(原顺序,整段不拆)
  ...lPuReq.block,    // 10-08 下架请购单等 13 面板
  ...lFix.block,      // 10-09 修报表视图
  ...lDrop.block,     // 10-09 下架品质 5 面板
];

const text = out.join('\n');
if (/^(<<<<<<<|=======|>>>>>>>)/m.test(text)) throw new Error('仍有冲突标记');
fs.writeFileSync(file, text, 'utf8');

const sqls = text.split(/\r?\n/).filter((l) => /\.sql$/.test(l.trim()));
console.log('合并完成:db-migrations.txt 共 ' + out.length + ' 行,' + sqls.length + ' 条脚本');
console.log('末段顺序:');
sqls.slice(-19).forEach((s, i) => console.log('  ' + (i + 1) + '. ' + s.trim()));
