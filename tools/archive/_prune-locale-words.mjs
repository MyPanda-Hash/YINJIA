// _prune-locale-words.mjs — 删除前端 locale 中已下线字段的死词条(一次性脚本)
import fs from 'node:fs';
const words = ['测试程序2', '生产订单客户', '启用派工', '自动转移', '产品自动添加到材料', '启用领料申请',
  '对方仓库', '生产类型', '适用BOM', 'BOM展开方式', '可用量说明', '产品字符公用自定义项1'];
const files = fs.readdirSync('frontend/src/i18n/locales').filter((f) => f.endsWith('.js'));
let total = 0;
for (const f of files) {
  const p = 'frontend/src/i18n/locales/' + f;
  const lines = fs.readFileSync(p, 'utf8').split('\n');
  const kept = lines.filter((l) => !words.some((w) => l.trimStart().startsWith(`'${w}'`)));
  total += lines.length - kept.length;
  fs.writeFileSync(p, kept.join('\n'), 'utf8');
}
console.log(`${files.length} 个 locale 文件共删 ${total} 行死词条`);
const en = fs.readFileSync('frontend/src/i18n/locales/en.js', 'utf8');
console.log(/'生产订单客户'/.test(en) ? '❌ 残留' : '✅ en.js 已清');
console.log(/'现存量说明'/.test(en) ? 'ℹ️ 现存量说明词条保留(其他面板共用)' : '⚠️ 现存量说明也没了');
