// deploy/push/_push-one.mjs — 推送单张单据到沙箱(供 Java KingdeePushService 子进程调用)
// 只推送当前单据数据,不创建任何基础资料(基础资料由全量导入脚本处理)
// stdin: JSON { panelCode, docNo, operator, head: {...}, lines: [...] }
// stdout: JSON { ok, erpBillNo, error, hint }
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const { fetchAppToken, kingdeePost } = await import(pathToFileURL(join(HERE, '..', 'kingdee-client.mjs')).href);
const cfg = JSON.parse(readFileSync(join(HERE, 'config.json'), 'utf8'));

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));

const isPur = input.panelCode === 'PURCHASE_IN';
const apiPath = isPur ? '/jdy/v2/scm/pur_inbound' : '/jdy/v2/scm/sal_out_bound';
const h = input.head;
const lines = input.lines;

const { token } = await fetchAppToken(cfg.kingdee);

// 构建推送 body(只含当前单据数据)
const body = {
  bill_no: String(h['单据编号'] || ''),
  bill_date: String(h['单据日期'] || '').slice(0, 10),
  trans_type: '2',
  remark: String(h['备注'] || ''),
};
if (isPur) body.supplier_number = String(h['供应商编码'] || '');
else body.customer_number = String(h['客户编码'] || '');

body.material_entity = lines.map((l) => {
  const e = {
    material_number: String(l['存货编码'] || ''),
    qty: Number(l['实收数量'] || l['数量']) || 0,
    price: Number(l['单价'] || l['售价']) || 0,
  };
  if (l['规格型号']) e.material_model = String(l['规格型号']);
  if (l['税率%']) e.cess = Number(l['税率%']) || 0;
  // 仓库编码:行级 > 头级 > 默认正品仓(金蝶要求必须有仓库)
  const stockCode = l['仓库编码'] || h['仓库编码'] || 'CK00001';
  e.stock_number = String(stockCode);
  if (l['批号']) e.batch_no = String(l['批号']);
  return e;
});

// 推送(不自动换号,不创建基础资料)
const r = await kingdeePost(cfg.kingdee, token, apiPath, {}, body);
if (r.ok) {
  const erpBillNo = String(Object.values(r.data?.id_number_map || {})[0] || h['单据编号']);
  console.log(JSON.stringify({ ok: true, erpBillNo }));
} else if (/组合值.*重复|重复.*组合|已存在/.test(String(r.error || ''))) {
  console.log(JSON.stringify({ ok: false, error: 'DUPLICATE', erpBillNo: h['单据编号'],
    hint: '该单号在金蝶已存在。请先在金蝶界面删除(或弃审作废)旧单,再重新转ERP' }));
} else {
  console.log(JSON.stringify({ ok: false, error: r.error || 'unknown' }));
}
