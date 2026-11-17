// 续跑:对已建好的采购入库单(默认 PI-2026-11-0016)执行 审核 → 转ERP → 回读。
// 用法: node tools/archive/_verify-multipo-erp-20261113/push-existing.mjs [单据编号]
const BASE = 'http://127.0.0.1:8090';
const post = async (path, body, token) => {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body || {}),
  });
  const txt = await res.text();
  let json = {}; try { json = JSON.parse(txt); } catch { json = { raw: txt.slice(0, 300) }; }
  return { http: res.status, body: json };
};
const docNo = process.argv[2] || 'PI-2026-11-0016';
const out = {};
const login = await post('/api/auth/login', { userName: 'admin', password: '123456', factory: 'YJ_TEST' });
const token = login.body?.data?.token;
out.login = { code: login.body?.code, factory: login.body?.data?.user?.factory };
const call = (panel, button, formData) => post('/api/px/callButton', { panelCode: panel, buttonName: button, formData, buttonParam: {} }, token);

// 审核(前端提交的是「编号」;「单据编号」会报"缺少表单编号")
const audit = await call('PURCHASE_IN', '审核', { 编号: docNo, 单据编号: docNo });
out.audit = { http: audit.http, code: audit.body?.code, msg: String(audit.body?.message || '').slice(0, 300) };

// 转ERP
const push = await call('PURCHASE_IN', '转ERP', { 编号: docNo, 单据编号: docNo });
out.push = { http: push.http, code: push.body?.code, msg: String(push.body?.message || '').slice(0, 500), data: push.body?.data };

// 回读落库结果
const list = await post('/api/px/queryFormDataList', { panelCode: 'PURCHASE_IN', condition: {}, keyword: docNo, pageNo: 1, pageSize: 5 }, token);
const hit = (list.body?.data?.list || []).find((d) => String(d['单据编号'] || d['编号'] || '') === docNo) || {};
out.after = { 单据编号: hit['单据编号'] || hit['编号'], 单据状态: hit['单据状态'], 是否已转ERP: hit['是否已转ERP'], ERP单号: hit['ERP单号'] };
console.log(JSON.stringify(out, null, 1));
