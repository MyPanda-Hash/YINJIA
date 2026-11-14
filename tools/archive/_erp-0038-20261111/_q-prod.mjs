// 只读:生产服务器(PI-2026-11-0038 现场)采购入库单列表取证。
// 运行: node tools/archive/_erp-0038-20261111/_q-prod.mjs
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.MES_BASE || 'http://36.140.66.163:8090/api';

async function post(path, body, token) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body),
  });
  const j = await res.json();
  if (j.code !== 200) throw new Error(path + ' → ' + j.code + ' ' + j.message);
  return j.data;
}
const get = async (path, token) => {
  const res = await fetch(BASE + path, { headers: { Authorization: 'Bearer ' + token } });
  const j = await res.json();
  if (j.code !== 200) throw new Error(path + ' → ' + j.code + ' ' + j.message);
  return j.data;
};

const login = await post('/auth/login', { userName: 'admin', password: '123456', factory: 'YINJIA-MES' });
const token = login.token;

// A) 该订单号下的全部采购入库单
for (const cond of [{ 采购订单号: 'YJ-20261103-07' }, {}]) {
  const d = await post('/px/queryFormDataList', {
    panelCode: 'PURCHASE_IN', condition: cond, keyword: cond['采购订单号'] ? '' : 'PI-2026-11-00',
    pageNo: 1, pageSize: 100,
  }, token);
  console.log('\n=== condition=' + JSON.stringify(cond) + ' totalSize=' + d.totalSize + ' ===');
  const keep = [
    '单据编号', '单据日期', '供应商', '采购订单号', '来源单号', '批次号',
    '是否已转ERP', 'ERP单号', '转ERP操作人', '转ERP时间', '单据状态',
  ];
  const rows = (d.list || []).filter((r) => !cond['采购订单号'] || r['采购订单号'] === cond['采购订单号']);
  for (const r of rows) console.log(keep.map((k) => k + '=' + (r[k] ?? '')).join(' | '));
  // 行信息
  for (const r of rows) {
    const items = (r.detail && r.detail.items) || [];
    if (items.length) {
      console.log('  ' + r['单据编号'] + ' 行: ' + items.map((x) => `${x['存货编码']} ${x['存货名称']} ${x['实收数量']}${x['计量单位']} 批号=${x['批号'] ?? ''} 订单行=${x['采购订单行号'] ?? ''} 来料检验=${x['是否来料检验'] ?? ''} 特采=${x['特采'] ?? ''}`).join(' ;; '));
    }
  }
}

// B) 单据 0038 / 0039 / 0040 的表单描述(看有没有更多头字段)
for (const no of ['PI-2026-11-0038', 'PI-2026-11-0039', 'PI-2026-11-0040']) {
  try {
    const d = await get('/px/getFormDescriptor?panelCode=PURCHASE_IN&code=' + encodeURIComponent(no), token);
    writeFileSync(resolve(here, `out-form-${no}.json`), JSON.stringify(d, null, 1), 'utf8');
    console.log('\n=== 表单 ' + no + ' 已存 out-form-' + no + '.json ===');
  } catch (e) { console.log('\n表单 ' + no + ' 拉取失败: ' + e.message); }
}
