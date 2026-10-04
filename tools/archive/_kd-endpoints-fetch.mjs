// 探针:抓取第三方汇总的「金蝶云星辰 V2」接口清单,搜索 工艺路线/工序/路线 相关端点
import { writeFileSync } from 'node:fs';

const base = 'https://mcp.qeasy.cloud/api-categories/Kingdee-YXC-V2';
const all = [];
for (let p = 1; p <= 12; p++) {
  const url = p === 1 ? base : `${base}?page=${p}`;
  let html = '';
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    html = await r.text();
  } catch (e) { console.log(`page ${p} ERR ${e.message}`); break; }
  const hits = [...html.matchAll(/\/jdy\/v2\/[a-z0-9_\/]+/g)].map((m) => m[0]);
  const uniq = [...new Set(hits)];
  console.log(`page ${p}: ${uniq.length} 个端点`);
  all.push(...uniq);
  if (!uniq.length) break;
}
const uniqAll = [...new Set(all)].sort();
writeFileSync(new URL('./_kd-endpoints-qeasy.txt', import.meta.url), uniqAll.join('\n'), 'utf8');
console.log(`\n共 ${uniqAll.length} 个端点,已写入 _kd-endpoints-qeasy.txt`);
console.log('\n=== 含 process/route/craft/工序/工艺 的端点 ===');
console.log(uniqAll.filter((x) => /process|route|craft|procedure|operat/i.test(x)).join('\n') || '(无)');
