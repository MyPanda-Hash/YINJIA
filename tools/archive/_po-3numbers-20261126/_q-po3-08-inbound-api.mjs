// 只读探针:确认金蝶「采购入库单」列表支持 modify_start_time,并能取到 src_bill_no;顺带试退货单端点
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchAppToken, kingdeeGet, kingdeeTryGet } from '../../../deploy/kingdee-client.mjs';

const HERE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'deploy');
const cfg = JSON.parse(readFileSync(join(HERE, 'config.json'), 'utf8').replace(/^\uFEFF/, '')).kingdee;
const tk = await fetchAppToken(cfg);
cfg.domain = tk.domain || cfg.domain;
const n = (v) => (v === undefined || v === null ? '' : String(v));

const since31 = Date.now() - 31 * 86400000;
const until = Date.now() + 180 * 60000;

for (const [label, path] of [['pur_inbound', '/jdy/v2/scm/pur_inbound'], ['pur_inbound_rt', '/jdy/v2/scm/pur_inbound_rt']]) {
  const r = await kingdeeTryGet(cfg, tk.token, path, { page: '1', page_size: '2' });
  if (!r.ok) { console.log(`[${label}] 不可用: ${r.error}`); continue; }
  console.log(`[${label}] 全量 count=${r.data.count} total_page=${r.data.total_page} 首行键数=${Object.keys((r.data.rows || [])[0] || {}).length}`);
  console.log(`  首行键: ${Object.keys((r.data.rows || [])[0] || {}).join(',')}`);

  const w = await kingdeeTryGet(cfg, tk.token, path, { page: '1', page_size: '50', modify_start_time: String(since31), modify_end_time: String(until) });
  if (!w.ok) { console.log(`  modify 过滤失败: ${w.error}`); continue; }
  const rows = w.data.rows || [];
  console.log(`  近31天修改 count=${w.data.count} total_page=${w.data.total_page} 本页=${rows.length}`);
  for (const row of rows.slice(0, 5)) {
    console.log(`   ${n(row.bill_no)} 日期=${n(row.bill_date)} 状态=${n(row.bill_status)} 供应商=${n(row.supplier_name)} 修改=${n(row.modify_time) || '(无)'} 创建=${n(row.create_time)}`);
    const d = await kingdeeTryGet(cfg, tk.token, path + '_detail', { id: String(row.id) });
    if (!d.ok) { console.log(`     明细失败: ${d.error}`); continue; }
    for (const e of (d.data.material_entity || []).slice(0, 3)) {
      console.log(`      seq=${n(e.seq)} ${n(e.material_number)} qty=${n(e.qty)} src=${n(e.src_bill_no) || '-'} src_seq=${n(e.src_seq) || '-'} src_type=${n(e.src_bill_type_number)} batch=${n(e.batch_no) || '-'}`);
    }
  }
}
