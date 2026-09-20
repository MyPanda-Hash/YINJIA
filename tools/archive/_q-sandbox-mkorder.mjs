/**
 * _q-sandbox-mkorder.mjs — 在测试沙箱(359220)建一张最小采购订单,供"源单挂联"实测使用
 * 用法: node tools/archive/_q-sandbox-mkorder.mjs            (创建)
 *       node tools/archive/_q-sandbox-mkorder.mjs --dry      (只打印将要提交的 body,不提交)
 * 说明:沙箱本无任何采购订单(实测 count=0),而金蝶在收到 src_bill_type_id 后**会校验来源单存在**,
 *       故要实测"7 字段全落"必须先在沙箱有一张订单。此为测试账套的一次性测试数据。
 */
import { readFileSync } from 'node:fs';
import { fetchAppToken, kingdeeGet, kingdeePost } from '../../deploy/kingdee-client.mjs';

const k = JSON.parse(readFileSync(new URL('../../deploy/push/config.json', import.meta.url), 'utf8'));
const cfg = k.kingdee || k;
const { token } = await fetchAppToken(cfg);
const G = (p, q) => kingdeeGet(cfg, token, p, q);

// 1) 取沙箱主数据:供应商编码 / 商品 / 单位id / 仓库(全部取自已有入库单,保证合法)
const ib = await G('/jdy/v2/scm/pur_inbound', { page: '1', page_size: '5' });
const d = await G('/jdy/v2/scm/pur_inbound_detail', { id: ib.rows[0].id });
const line0 = (d.material_entity || [])[0];
const units = await G('/jdy/v2/bd/measure_unit', { page: '1', page_size: '50' });
const unitRow = (units.rows || []).find((u) => u.name === line0.unit_name) || (units.rows || [])[0];
console.log(`[主数据] 供应商=${d.supplier_number}/${d.supplier_name} 商品=${line0.material_number} 单位=${unitRow.name}(id=${unitRow.id}) 仓库=${line0.stock_number}`);

const today = new Date().toISOString().slice(0, 10);
const body = {
  bill_date: today,
  supplier_number: d.supplier_number,
  remark: 'YINJIA-MES 源单挂联实测(测试数据,可删)',
  material_entity: [{
    material_number: line0.material_number,
    qty: '10',            // 金蝶保存接口要求数值字段传字符串(实测 qty:10 报 invalid value for string type)
    unit_id: unitRow.id,
    stock_number: line0.stock_number,
    price: '1',
  }],
};
console.log('[将提交] ' + JSON.stringify(body));
if (process.argv.includes('--dry')) { console.log('(dry-run,未提交)'); process.exit(0); }

const res = await kingdeePost(cfg, token, '/jdy/v2/scm/pur_order', {}, body);
console.log('[创建响应] ' + JSON.stringify(res).slice(0, 400));
const map = res?.data?.id_number_map;
if (map) {
  const no = Object.values(map)[0];
  console.log(`[沙箱采购订单已建] ${no}`);
  const r = await G('/jdy/v2/scm/pur_order', { page: '1', page_size: '5', bill_no: String(no) });
  const hit = (r.rows || []).find((x) => x.bill_no === String(no));
  if (hit) {
    const dd = await G('/jdy/v2/scm/pur_order_detail', { id: hit.id });
    console.log(`[核对] ${dd.bill_no} 状态=${dd.bill_status} id=${dd.id}`);
    for (const e of (dd.material_entity || [])) console.log(`   分录 seq=${e.seq} id=${e.id} 商品=${e.material_number} 数量=${e.qty}`);
  }
}
