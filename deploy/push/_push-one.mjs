// deploy/push/_push-one.mjs — 推送单张单据到沙箱(供 Java KingdeePushService 子进程调用)
// stdin: JSON { panelCode, docNo, operator, head: {...}, lines: [...] }
// stdout: JSON { ok, erpBillNo, error }
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
const { fetchAppToken, kingdeePost } = await import(pathToFileURL(join(HERE, '..', 'kingdee-client.mjs')).href);
const cfg = JSON.parse(readFileSync(join(HERE, 'config.json'), 'utf8'));

// 读 stdin(Windows 兼容)
const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));

const isPur = input.panelCode === 'PURCHASE_IN';
const apiPath = isPur ? '/jdy/v2/scm/pur_inbound' : '/jdy/v2/scm/sal_out_bound';

const h = input.head;
const lines = input.lines;
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
  if (l['仓库编码']) e.stock_number = String(l['仓库编码']);
  if (l['批号']) e.batch_no = String(l['批号']);
  return e;
});

try {
  const { token } = await fetchAppToken(cfg.kingdee);
  const r = await kingdeePost(cfg.kingdee, token, apiPath, {}, body);
  if (r.ok) {
    const erpBillNo = String(Object.values(r.data?.id_number_map || {})[0] || h['单据编号']);
    console.log(JSON.stringify({ ok: true, erpBillNo }));
  } else {
    console.log(JSON.stringify({ ok: false, error: r.error || 'unknown' }));
  }
} catch (e) {
  console.log(JSON.stringify({ ok: false, error: e.message }));
}
