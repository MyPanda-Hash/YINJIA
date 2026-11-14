// 只读:生产库里含某物料/某供应商的采购入库单,看历史转ERP成败(找对照组)。
// 运行: node tools/archive/_erp-0038-20261111/_q-peer.mjs YJ-HKB-001
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const BASE = 'http://36.140.66.163:8090/api';
const post = async (path, body, token) => {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body),
  });
  const j = await res.json();
  if (j.code !== 200) throw new Error(path + ' → ' + j.code + ' ' + j.message);
  return j.data;
};
const login = await post('/auth/login', { userName: 'admin', password: '123456', factory: 'YINJIA-MES' });

const kw = process.argv[2] || 'YJ-HKB-001';
const d = await post('/px/queryFormDataList', { panelCode: 'PURCHASE_IN', condition: {}, keyword: kw, pageNo: 1, pageSize: 200 }, login.token);
console.log('keyword=' + kw + ' totalSize=' + d.totalSize);
const keep = ['单据编号', '单据日期', '供应商', '采购订单号', '来源单号', '批次号', '是否已转ERP', 'ERP单号', '转ERP操作人', '转ERP时间', '单据状态'];
for (const r of (d.list || [])) {
  const items = (r.detail && r.detail.items) || [];
  const hitLines = items.filter((x) => String(x['存货编码'] || '').includes(kw));
  if (!hitLines.length) continue;
  console.log('\n' + keep.map((k) => k + '=' + (r[k] ?? '')).join(' | '));
  for (const x of hitLines) console.log('   行: ' + `${x['存货编码']} ${x['存货名称']} ${x['实收数量']}${x['计量单位']} 订单行=${x['采购订单行号'] ?? ''} 批号=${x['批号'] ?? ''}`);
}
