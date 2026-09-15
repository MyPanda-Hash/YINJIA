// 终验探针②(condition 冒烟,v2):从实际返回行取字段值回填 condition 再查——暴露标签→列映射错误
// 行形态:档案/单据面板=list[0].detail[detailKey|items](或单据头字段在 list[i] 顶层);flat 报表=list[i] 直出
const BASE = 'http://127.0.0.1:8090/api';
const PANELS = [
  'KHDA', 'GFDA', 'INV', 'UOM', 'DEPT', 'EMP', 'WH', 'PARTNER', 'PROJ', 'REGION',
  'SO_ORDER', 'PU_ORDER', 'PURCHASE_IN', 'MATERIAL_OUT', 'MANU_ORDER', 'DISPATCH',
  'WLBOM', 'RD_APPROVAL', 'RD_PROD_INFO', 'SETTLE', 'CUSGRP', 'MATGRP', 'CUR',
  'PURCHASE_IN_DETAIL', 'SALES_ORDER_DETAIL', 'DISPATCH_STATS', 'STOCK_STATUS', 'LOT_TRACE',
];

async function api(path, body, token) {
  return fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  }).then((r) => r.json());
}

/** 从首页响应提取「可做条件的样本记录」 */
function sampleRecord(q, detailKey) {
  const list = q.data.list || [];
  if (!list.length) return null;
  const first = list[0];
  if (first.detail && typeof first.detail === 'object') {
    const arr = first.detail[detailKey] || first.detail.items || first.detail.khda || first.detail.gfda;
    if (Array.isArray(arr) && arr.length) return arr[0];
    // 单据面板行顶层就是头字段
    return flatKeys(first);
  }
  return flatKeys(first); // flat 报表直出行
}
function flatKeys(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === 'detail') continue;
    if (typeof v === 'string' && v.trim() && v.length <= 60) out[k] = v;
  }
  return out;
}

async function main() {
  const lr = await fetch(`${BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userName: 'admin', password: '123456' }) }).then((r) => r.json());
  const token = lr.data.token;
  let pass = 0, skip = 0, fail = 0;

  for (const pc of PANELS) {
    const cfg = await fetch(`${BASE}/px/getPanelConfig?panelCode=${pc}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
    if (cfg.code !== 200) { console.log('[%s] config FAIL %s', pc, cfg.message); fail++; continue; }
    const detailKey = cfg.data.metadata.detailKey || 'items';
    const q0 = await api('/px/queryFormDataList', { panelCode: pc, pageNo: 1, pageSize: 5 }, token);
    if (q0.code !== 200) { console.log('[%s] query FAIL %s', pc, q0.message); fail++; continue; }
    if (Number(q0.data.totalSize ?? 0) < 1) { console.log('[%s] skip(空表)', pc); skip++; continue; } // 空表:包装行字段非数据,不做条件
    const rec = sampleRecord(q0, detailKey);
    const keys = rec ? Object.keys(rec) : [];
    if (!keys.length) { console.log('[%s] skip(空表或无样本)', pc); skip++; continue; }
    const cond = {};
    for (const k of keys.slice(0, 2)) cond[k] = rec[k];
    const qc = await api('/px/queryFormDataList', { panelCode: pc, pageNo: 1, pageSize: 5, condition: cond }, token);
    if (qc.code !== 200) { console.log('[%s] condition FAIL %s | cond=%j', pc, qc.message, cond); fail++; continue; }
    const n = qc.data.totalSize ?? (qc.data.list || []).length;
    if (Number(n) < 1) { console.log('[%s] condition 空结果(映射可疑) cond=%j', pc, cond); fail++; continue; }
    pass++;
    console.log('[%s] ok 条件[%s] 命中 %s', pc, Object.keys(cond).join('+'), n);
  }
  console.log('RESULT: pass=%d skip=%d fail=%d', pass, skip, fail);
  if (fail > 0) process.exit(1);
}
main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
