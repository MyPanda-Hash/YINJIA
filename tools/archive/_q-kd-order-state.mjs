/**
 * _q-kd-order-state.mjs — 只读对照:金蝶侧采购订单的 状态字段 ↔ MES 显示(已终止/已审核)
 * 用法: node tools/archive/_q-kd-order-state.mjs
 * 取数用真实账套只读凭证(deploy/config.json,采购订单由该账套同步而来)。
 */
import { readFileSync } from 'node:fs';
import { fetchAppToken, kingdeeGet } from '../../deploy/kingdee-client.mjs';

const k = JSON.parse(readFileSync(new URL('../../deploy/config.json', import.meta.url), 'utf8'));
const cfg = k.kingdee || k;
const { token } = await fetchAppToken(cfg);

// MES 侧已中止(stopped='Y' 且 stop_by 为空)样例
const MES_STOPPED = ['YJ-20260912-06', 'YJ-20260912-04', 'YJ-20260911-03', 'YJ-20260908-18', 'YJ-20260908-02'];
// MES 侧已审核样例
const MES_AUDITED = ['YJ-20260916-01', 'YJ-20260916-02', 'YJ-20260915-06'];

const STATE = { C: '已审核', Z: '未审核', '': '(空)' };
const CLOSE = { '': '未关闭', C: '未关闭(C)', S: '已关闭(S)', H: '手动关闭(H)' };
const show = async (no) => {
  const r = await kingdeeGet(cfg, token, '/jdy/v2/scm/pur_order', { page: '1', page_size: '5', bill_no: no });
  const hit = (r.rows || []).find((x) => x.bill_no === no);
  if (!hit) return console.log(`  ${no} → 金蝶账套内不存在`);
  const d = await kingdeeGet(cfg, token, '/jdy/v2/scm/pur_order_detail', { id: hit.id });
  console.log(`  ${no} | bill_status=${d.bill_status}(${STATE[d.bill_status] || d.bill_status})`
    + ` | bill_close_state='${d.bill_close_state ?? ''}'(${CLOSE[d.bill_close_state ?? ''] || '?'})`
    + ` | io_status=${d.io_status ?? '(空)'} | 行入库状态=${(d.material_entity || []).map((e) => e.entry_realio_status ?? '-').join(',')}`);
};

console.log('【MES 显示"已中止"的订单(MES 侧 stopped=Y 且 stop_by 空)】');
for (const no of MES_STOPPED) await show(no);
console.log('\n【MES 显示"已审核"的订单】');
for (const no of MES_AUDITED) await show(no);
