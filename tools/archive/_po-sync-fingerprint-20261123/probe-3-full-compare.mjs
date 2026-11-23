// 只读全量复核:金蝶「已审核 + 近 31 天(同步窗口)」的采购订单 × 生产 MES,逐单比行/数量/审核时间
// 目的:量化「明细被改过但 MES 没跟上」的样本面(不是只看一张)
import { readFileSync } from 'node:fs';
const API = process.env.MES_API || 'http://36.140.66.163:8090/api';
const cfg = JSON.parse(readFileSync(new URL('../../../deploy/config.json', import.meta.url), 'utf8'));
const { fetchAppToken, kingdeeGet } = await import('../../../deploy/kingdee-client.mjs');

const call = async (path, body, token) => {
  const r = await fetch(API + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch { }
  return { status: r.status, code: j?.code, message: j?.message || t.slice(0, 200), data: j?.data };
};
const mesTok = (await call('/auth/login', { userName: 'admin', password: '123456' })).data?.token;
if (!mesTok) { console.error('MES 登录失败'); process.exit(1); }
const { token: kTok } = await fetchAppToken(cfg.kingdee);

const now = Date.now();
const rows = []; let total = 0;
for (let page = 1; page <= 40; page++) {
  const data = await kingdeeGet(cfg.kingdee, kTok, '/jdy/v2/scm/pur_order', {
    bill_status: 'C', page: String(page), page_size: '50',
    modify_start_time: String(now - 31 * 86400000), modify_end_time: String(now + 180 * 60000),
  });
  total = data.count; rows.push(...(data.rows || []));
  if (page >= (data.total_page || 1)) break;
}
console.log(`金蝶窗口内(已审核/近31天)= ${total} 张`);

const bad = [], missing = [];
let checked = 0;
for (const r of rows) {
  let detail = null;
  try {
    detail = await kingdeeGet(cfg.kingdee, kTok, '/jdy/v2/scm/pur_order_detail', { id: String(r.id), page: '1', page_size: '200' });
  } catch (e) { console.log('详情失败', r.bill_no, e.message); continue; }
  const d = (detail?.rows && detail.rows[0]) || detail || {};
  const kLines = (d.material_entity || []).map((m) => `${m.material_number}:${m.qty}`);
  const kAudit = d.audit_time || null;
  const kMod = d.modify_time || null;
  const kSum = kLines.join(' ');

  const q = await call('/px/queryFormDataList', { panelCode: 'PU_ORDER', keyword: r.bill_no, condition: {}, pageNo: 1, pageSize: 3 }, mesTok);
  const hit = (q.data?.list || []).find((x) => String(x.单据编号) === r.bill_no);
  if (!hit) { missing.push(r.bill_no); continue; }
  const fd = await call('/px/getFormDescriptor?panelCode=PU_ORDER&code=' + encodeURIComponent(r.bill_no), null, mesTok);
  const mLines = (fd.data?.detailData?.items || []).map((m) => `${m.物料编码}:${m.数量}`);
  const mSum = mLines.join(' ');
  checked++;
  if (mSum !== kSum || String(hit.单据状态) !== '已审核') {
    bad.push({ no: r.bill_no, 金蝶: kSum, MES: mSum, MES状态: hit.单据状态, MES审核时间: hit.审核时间, 金蝶审核时间: kAudit, 金蝶修改时间: kMod });
  }
  if (checked % 25 === 0) console.log(`…已核 ${checked}/${rows.length}`);
}
console.log(`\n核对 ${checked} 张;MES 缺失 ${missing.length} 张${missing.length ? '(' + missing.join(',') + ')' : ''}`);
console.log(`明细/状态不一致 ${bad.length} 张:`);
for (const b of bad) console.log(JSON.stringify(b));

