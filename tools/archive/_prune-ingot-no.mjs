// _prune-ingot-no.mjs — 锭号下线配套:前端 5 文件兜底引用清理 + locale 10 文件词条删除(一次性脚本)
import fs from 'node:fs';

const edits = [
  ['frontend/src/core/selection/masterDetailSelection.js',
    [[`row?.来源单号 || row?.单据编号 || row?.编号 || row?.锭号`, `row?.来源单号 || row?.单据编号 || row?.编号`]]],
  ['frontend/src/core/views/PanelxForm.vue', [
    [`form['单据编号'] || form['锭号'] || form['编号'] || ''`, `form['单据编号'] || form['编号'] || ''`],
    [`form['单据编号'] || form['锭号'] || form['编号']}`, `form['单据编号'] || form['编号']}`],
    [`r['编号'] || r['单据编号'] || r['锭号'] || ''`, `r['编号'] || r['单据编号'] || ''`],
    [`r._sourceFormNo || r['编号'] || r['单据编号'] || r['锭号'] || sourceNos[0] || ''`, `r._sourceFormNo || r['编号'] || r['单据编号'] || sourceNos[0] || ''`],
    [`// 锭号：自动编码；仅勾选「是否手工修改单据编码」时草稿可改`, `// 单据编号：自动编码；仅勾选「是否手工修改单据编码」时草稿可改`],
  ]],
  ['frontend/src/core/views/PanelxList.vue', [
    [`row['单据编号'] || row['锭号'] || row['编号']`, `row['单据编号'] || row['编号']`],
    [`(item['编号'] || item['单据编号'] || item['锭号'])`, `(item['编号'] || item['单据编号'])`],
    [`(r['编号'] || r['单据编号'] || r['锭号'])`, `(r['编号'] || r['单据编号'])`],
  ]],
  ['frontend/src/core/views/SelectVoucherDialog.vue', [
    [`return row['锭号'] || row['编号'] || ''`, `return row['编号'] || ''`],
  ]],
  ['frontend/src/layout/HelpPanel.vue', [
    [`填写合同号、锭号、批号等必填项后提交`, `填写合同号、批号等必填项后提交`],
  ]],
];

for (const [file, pairs] of edits) {
  let s = fs.readFileSync(file, 'utf8');
  let n = 0;
  for (const [from, to] of pairs) {
    while (s.includes(from)) { s = s.split(from).join(to); n++; }
  }
  fs.writeFileSync(file, s, 'utf8');
  console.log(`${file}: ${n} 处替换`);
}

// locale 词条
let removed = 0;
for (const f of fs.readdirSync('frontend/src/i18n/locales').filter((x) => x.endsWith('.js'))) {
  const p = 'frontend/src/i18n/locales/' + f;
  const lines = fs.readFileSync(p, 'utf8').split('\n');
  const kept = lines.filter((l) => !l.trimStart().startsWith(`'锭号'`));
  removed += lines.length - kept.length;
  fs.writeFileSync(p, kept.join('\n'), 'utf8');
}
console.log(`locale 删除 ${removed} 行`);

// 终验:全前端无锭号残留(排除本脚本自身与 node_modules)
import { execSync } from 'node:child_process';
const out = execSync('git grep -n 锭号 -- frontend/src || echo CLEAN', { shell: true, encoding: 'utf8' });
console.log('前端残留:', out.trim() === 'CLEAN' ? '✅ 无' : out);
