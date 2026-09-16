// 验证推送结果的数据内容
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const { fetchAppToken, kingdeeGet } = await import(pathToFileURL(join(HERE, '..', 'kingdee-client.mjs')).href);
const cfg = JSON.parse(readFileSync(join(HERE, 'config.json'), 'utf8'));
const { token } = await fetchAppToken(cfg.kingdee);

// 采购入库 CGRK-20260916-00002
const purList = await kingdeeGet(cfg.kingdee, token, '/jdy/v2/scm/pur_inbound', { page: '1', page_size: '5' });
for (const r of (purList.rows || [])) {
  if (!r.bill_no.includes('00002')) continue;
  const d = await kingdeeGet(cfg.kingdee, token, '/jdy/v2/scm/pur_inbound_detail', { id: r.id });
  console.log('══ MES 推送的采购入库 ══');
  console.log(`  单号: ${d.bill_no} | 日期: ${d.bill_date} | 供应商: ${d.supplier_name}(${d.supplier_number})`);
  console.log(`  备注: ${d.remark} | 总额: ${d.total_amount}`);
  for (const m of (d.material_entity || [])) {
    console.log(`  行: ${m.material_name}(${m.material_number}) | 数量:${m.qty} | 单价:${m.price} | 仓库:${m.stock_name} | 批号:${m.batch_no}`);
  }
}

// 销售出库 XSCK-20260916-00002
const soList = await kingdeeGet(cfg.kingdee, token, '/jdy/v2/scm/sal_out_bound', { page: '1', page_size: '5' });
for (const r of (soList.rows || [])) {
  if (!r.bill_no.includes('00002')) continue;
  const d = await kingdeeGet(cfg.kingdee, token, '/jdy/v2/scm/sal_out_bound_detail', { id: r.id });
  console.log('\n══ MES 推送的销售出库 ══');
  console.log(`  单号: ${d.bill_no} | 日期: ${d.bill_date} | 客户: ${d.customer_name}(${d.customer_number})`);
  console.log(`  备注: ${d.remark} | 总额: ${d.total_amount}`);
  for (const m of (d.material_entity || [])) {
    console.log(`  行: ${m.material_name}(${m.material_number}) | 数量:${m.qty} | 单价:${m.price} | 仓库:${m.stock_name}`);
  }
}
