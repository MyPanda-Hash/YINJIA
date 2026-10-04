// _probe-kingdee-stock-archive.mjs — 金蝶(测试沙箱/真实账套)仓库档案接口路径探测 + 清单
// 用法: node tools/archive/_probe-kingdee-stock-archive.mjs [sandbox|real] [关键字]
import { readFileSync } from 'node:fs';
import { fetchAppToken, kingdeeTryGet } from '../../deploy/kingdee-client.mjs';

const which = process.argv[2] || 'sandbox';
const kw = process.argv[3] || '';
const raw = JSON.parse(readFileSync(new URL(which === 'real' ? '../../deploy/config.json' : '../../deploy/push/config.json', import.meta.url), 'utf8'));
const cfg = which === 'real' ? raw.kingdee : { ...raw.kingdee, outerInstanceId: '579046204055359488' };
const { token } = await fetchAppToken(cfg);

const CANDS = ['/jdy/v2/bd/warehouse', '/jdy/v2/bd/stock', '/jdy/v2/bd/inv_stock', '/jdy/v2/scm/stock', '/jdy/v2/bd/store', '/jdy/v2/bd/warehouse_list'];
for (const p of CANDS) {
  const r = await kingdeeTryGet(cfg, token, p, { page: '1', page_size: '50' });
  if (!r.ok) { console.log(`❌ ${p} → ${r.error}`); continue; }
  const rows = r.data.rows || [];
  console.log(`✅ ${p} → count=${r.data.count} 取回 ${rows.length}`);
  for (const x of rows) console.log(`   ${x.number} | ${x.name} | is_allow_freight=${x.is_allow_freight}`);
  break;
}
console.log(kw ? `(关键字 ${kw} 仅作人工比对)` : '');
