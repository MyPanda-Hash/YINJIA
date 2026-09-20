/**
 * _q-sandbox-audit-order.mjs — 尝试把沙箱测试订单审核(试几个常见审核接口路径,只动刚建的测试单)
 * 用法: node tools/archive/_q-sandbox-audit-order.mjs
 */
import { readFileSync } from 'node:fs';
import { fetchAppToken, kingdeeGet, kingdeePost } from '../../deploy/kingdee-client.mjs';

const k = JSON.parse(readFileSync(new URL('../../deploy/push/config.json', import.meta.url), 'utf8'));
const cfg = k.kingdee || k;
const { token } = await fetchAppToken(cfg);
const billNo = 'CGDD-20260920-00001';

const r = await kingdeeGet(cfg, token, '/jdy/v2/scm/pur_order', { page: '1', page_size: '5', bill_no: billNo });
const hit = (r.rows || []).find((x) => x.bill_no === billNo);
if (!hit) throw new Error('测试订单不存在');
console.log(`[订单] ${hit.bill_no} id=${hit.id} 状态=${hit.bill_status}(Z=未审核 C=已审核)`);
if (hit.bill_status === 'C') { console.log('已审核,无需处理'); process.exit(0); }

const tries = [
  // 正式路径(轻易云收录的金蝶星辰通用批量操作接口):operate_type + entity_number(pur_bill_order,与 src_bill_type_id 同值)
  ['/jdy/v2/sys/common_operate', { operate_type: 'audit', entity_number: 'pur_bill_order', ids: [hit.id] }],
  ['/jdy/v2/sys/common_operate', { operate_type: 'audit', entity_number: 'pur_bill_order', numbers: [billNo] }],
];
for (const [path, body] of tries) {
  try {
    const res = await kingdeePost(cfg, token, path, {}, body);
    console.log(`  ${path} → ${JSON.stringify(res).slice(0, 220)}`);
    const chk = await kingdeeGet(cfg, token, '/jdy/v2/scm/pur_order', { page: '1', page_size: '5', bill_no: billNo });
    const st = (chk.rows || []).find((x) => x.bill_no === billNo)?.bill_status;
    console.log(`     复核状态 = ${st}`);
    if (st === 'C') { console.log('✔ 已审核'); break; }
  } catch (e) {
    console.log(`  ${path} → 失败: ${e.message.slice(0, 160)}`);
  }
}
