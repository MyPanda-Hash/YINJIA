/**
 * 语言包按钮词条改名:生成生产加工单→生成生产工单、选生产加工单→选生产工单(2026-09-24)
 * 纪律:按 §5.5 C1 用 Node 处理 CJK 键;只改键名,译文本体保留(语义不变:Create/Schedule WO)。
 */
const fs = require('fs');
const dir = 'D:/workspace/yinjia/frontend/src/i18n/locales/';
const pairs = [
  ["'生成生产加工单':", "'生成生产工单':"],
  ["'选生产加工单':", "'选生产工单':"],
];
let files = 0, hits = 0;
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith('.js')) continue;
  const p = dir + f;
  let s = fs.readFileSync(p, 'utf8');
  const before = s;
  for (const [from, to] of pairs) {
    const n = s.split(from).length - 1;
    if (n) { s = s.split(from).join(to); hits += n; }
  }
  if (s !== before) { fs.writeFileSync(p, s, 'utf8'); files++; console.log(f + ' 已改'); }
}
console.log('文件 ' + files + ' 个,词条 ' + hits + ' 处');
