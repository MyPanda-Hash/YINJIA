// 探针:金蝶**测试沙箱**的档案与现存量(转ERP 目标账套),用来挑可推送的商品/客户/仓库
// 用法: node tools/archive/_ret-docs-20261113/_sandbox-probe.mjs
// 注:沙箱凭证在 deploy/push/config.json(只有 sandboxInstanceId,没有 outerInstanceId)
//     ⇒ fetchAppToken 必须显式把它当 outerInstanceId 传,否则会退化成空 appKey(报 errcode=undefined)。
import { readFileSync, writeFileSync } from 'node:fs';
import { fetchAppToken, kingdeeTryGet } from '../../../deploy/kingdee-client.mjs';

const cfg = JSON.parse(readFileSync(new URL('../../../deploy/push/config.json', import.meta.url), 'utf8'));
const sbx = { ...cfg.kingdee, outerInstanceId: cfg.kingdee.sandboxInstanceId };
const { token } = await fetchAppToken(sbx);
console.log('沙箱账套:', cfg.kingdee.sandboxInstanceId);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const out = {};
for (const [label, path] of [['商品', '/jdy/v2/bd/material'], ['客户', '/jdy/v2/bd/customer'],
  ['仓库', '/jdy/v2/bd/store'], ['供应商', '/jdy/v2/bd/supplier'], ['单位', '/jdy/v2/bd/measure_unit']]) {
  const r = await kingdeeTryGet(sbx, token, path, { page: '1', page_size: '20' });
  out[label] = r.ok ? (r.data?.rows || []).map((x) => ({ number: x.number, name: x.name })) : { error: r.error };
  console.log(label, r.ok ? 'count=' + r.data?.count : 'ERR ' + r.error,
    r.ok ? JSON.stringify((r.data?.rows || []).slice(0, 3).map((x) => [x.number, x.name])) : '');
  await sleep(150);
}
const inv = await kingdeeTryGet(sbx, token, '/jdy/v2/inv/inv_inventory_ims', { page: '1', page_size: '20' });
out.库存 = inv.ok ? (inv.data?.rows || []).map((r) => ({ material: r.material_number, name: r.material_name, stock: r.stock_number, stockName: r.stockid_name, qty: r.qty })) : { error: inv.error };
console.log('现存量 count=', inv.ok ? inv.data?.count : inv.error);
console.log('库存样例:', JSON.stringify(out.库存).slice(0, 500));
writeFileSync(new URL('./sandbox-probe.json', import.meta.url), JSON.stringify(out, null, 2), 'utf8');
