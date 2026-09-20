/**
 * _q-account-id.mjs — 只读判定:两套金蝶凭证各指向哪个账套(是否沙箱),以及 MES 已推单据落在哪个账套
 * 用法: node tools/archive/_q-account-id.mjs
 * 输出:各账套的 采购入库/采购订单 规模、MES 已推 ERP 单号是否存在、采购订单号是否存在、供应商样例
 */
import { readFileSync, existsSync } from 'node:fs';
import { fetchAppToken, kingdeeGet } from '../../deploy/kingdee-client.mjs';

/** MES 侧已转ERP 的 7 张采购入库单的 ERP单号(转ERP回写) */
const PUSHED = ['CGRK-20260917-00033', 'CGRK-20260807-00032', 'CGRK-20260912-00025', 'CGRK-20260916-00016',
  'CGRK-20260915-00024', 'CGRK-20260916-00019', 'CGRK-20260916-00020'];
/** MES 侧采购订单号样例(推 src_bill_no 时要用它去解析 id) */
const ORDERS = ['YJ-20260916-01', 'YJ-20260915-06'];

for (const rel of ['../../deploy/config.json', '../../deploy/push/config.json']) {
  const p = new URL(rel, import.meta.url);
  if (!existsSync(p)) { console.log(`\n=== ${rel} 不存在 ===`); continue; }
  const cfg = JSON.parse(readFileSync(p, 'utf8'));
  const k = cfg.kingdee || cfg;
  console.log(`\n=== ${rel}(clientId ${String(k.clientId || '').slice(0, 6)}…) ===`);
  let token;
  try { ({ token } = await fetchAppToken(k)); } catch (e) { console.log('  鉴权失败:', e.message.slice(0, 160)); continue; }
  try {
    const list = await kingdeeGet(k, token, '/jdy/v2/scm/pur_inbound', { page: '1', page_size: '50' });
    console.log(`  采购入库 count = ${list.count}`);
    console.log(`  最近单号 = ${(list.rows || []).slice(0, 5).map((r) => r.bill_no).join(', ')}`);
    console.log(`  供应商样例 = ${[...new Set((list.rows || []).map((r) => r.supplier_name))].slice(0, 5).join(' / ')}`);
  } catch (e) { console.log('  采购入库查询失败:', e.message.slice(0, 140)); }
  for (const no of PUSHED.slice(0, 3)) {
    try {
      const r = await kingdeeGet(k, token, '/jdy/v2/scm/pur_inbound', { page: '1', page_size: '5', bill_no: no });
      console.log(`  MES已推单 ${no} → 本账套${(r.rows || []).some((x) => x.bill_no === no) ? ' 存在 ✔' : ' 不存在'}(count=${r.count})`);
    } catch (e) { console.log(`  MES已推单 ${no} 查询失败: ${e.message.slice(0, 100)}`); }
  }
  for (const no of ORDERS) {
    try {
      const r = await kingdeeGet(k, token, '/jdy/v2/scm/pur_order', { page: '1', page_size: '5', bill_no: no });
      const hit = (r.rows || []).find((x) => x.bill_no === no);
      console.log(`  采购订单 ${no} → ${hit ? '存在 ✔ id=' + hit.id : '不存在'}(count=${r.count})`);
    } catch (e) { console.log(`  采购订单 ${no} 查询失败: ${e.message.slice(0, 100)}`); }
  }
}
