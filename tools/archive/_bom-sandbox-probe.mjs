// 探针:测试沙箱账套里有没有 BOM 数据(与正式账套对照)
import { readFileSync } from 'node:fs';
import { fetchAppToken, kingdeeTryGet } from '../../deploy/kingdee-client.mjs';

const k = JSON.parse(readFileSync(new URL('../../deploy/push/config.json', import.meta.url), 'utf8'));
const cfg = k.kingdee || k;
console.log('沙箱 clientId=', cfg.clientId, ' domain=', cfg.domain, ' outerInstanceId=', cfg.outerInstanceId ? '有' : '无');
const { token } = await fetchAppToken(cfg);
const G = (p, q) => kingdeeTryGet(cfg, token, p, q);

for (const [label, path, params] of [
  ['BOM单列表', '/jdy/v2/bd/bom', { page: '1', page_size: '20' }],
  ['产品查询BOM', '/jdy/v2/bd/bom_query', { page: '1', page_size: '20' }],
  ['根据产品查询BOM(生产管理)', '/jdy/v2/pm/bom', { page: '1', page_size: '20' }],
  ['生产任务单', '/jdy/v2/pm/mo_taskbill', { page: '1', page_size: '5' }],
  ['商品', '/jdy/v2/bd/material', { page: '1', page_size: '5' }],
]) {
  const r = await G(path, params);
  if (!r.ok) { console.log(`❌ ${label} ${path} → ${r.error}`); continue; }
  const d = r.data || {};
  const rows = d.rows || [];
  console.log(`✅ ${label} ${path} → count=${d.count ?? rows.length}`);
  if (rows[0]) console.log('   首行:', JSON.stringify(rows[0]).slice(0, 500));
}
