// _strip-deco-flag.mjs — 一次性:移除 docSheetConfigs.js 里已失效的 `deco` 开关(2026-09-22)
//
// 背景:`deco` 原本只给「立项申请表」画右侧装饰虚列(DocSheet 的 `.as-deco`,一条 250px 虚线)。
// 设计该列是**可填的「备注」区**(立项申请表.xlsx F5 标签 + F6:G15 合并填写区),故本次把
// approvalSheetCfg 的 deco 换成 remark 备注列、删掉 DocSheet 的 deco 渲染分支与 `.as-deco` 样式。
// 配置里剩下的 9 处 `deco: false` 遂成无人读的僵尸开关,按仓库「删除功能=代码一并清理」的规矩移除。
// 用法:node tools/archive/_strip-deco-flag.mjs [--dry]
import fs from 'node:fs';

const F = 'C:/INCER/YINJIA-MES/frontend/src/core/views/docSheetConfigs.js';
const src = fs.readFileSync(F, 'utf8');
const lines = src.split('\n');
let touched = 0;
const out = lines.map((l) => {
  if (!/deco\s*:/.test(l)) return l;
  const before = l;
  // 形态一:整行只有 deco: false,
  if (/^\s*deco\s*:\s*(true|false)\s*,\s*$/.test(l)) { touched++; return null; }
  // 形态二:行内附带(如 titlePart3: '', deco: false,)→ 去掉 ", deco: false"
  let s = l.replace(/,\s*deco\s*:\s*(true|false)\s*(?=,|$)/, '');
  s = s.replace(/^\s*deco\s*:\s*(true|false)\s*,\s*/, '');
  s = s.replace(/\bdeco\s*:\s*(true|false)\s*,\s*/, '');
  if (s !== before) { touched++; return s; }
  console.log('⚠ 未处理(请人工看): ' + JSON.stringify(l));
  return l;
}).filter((l) => l !== null);

if (process.argv.includes('--dry')) {
  console.log(`将改动 ${touched} 处;行数 ${lines.length} → ${out.length}`);
} else {
  fs.writeFileSync(F, out.join('\n'));
  console.log(`已改动 ${touched} 处;行数 ${lines.length} → ${out.length}`);
}
