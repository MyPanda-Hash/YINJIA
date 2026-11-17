// 验证:一张 MES 采购入库单里放两张不同采购订单的行,点「转ERP」→ 金蝶侧是否每行各挂各的源单。
// 环境:测试账套(YJ_TEST / HSDZ_MES_TEST) + 金蝶**测试沙箱**(359220 / sandboxInstanceId)。
// 前置(脚本外已做好,见 README):
//   沙箱采购订单  YJ-20260909-01(行1 YJ-XWR-003,行2 YJ-XWR-031,行3 YJ-XWR-032,均 YJ-XWR 供应商,已审核)
//   沙箱采购订单  CGDD-20261113-00001(本脚本前新建:行1 YJ-XWR-031 / 100 / 个,已审核)
// 用法: node tools/archive/_verify-multipo-erp-20261113/verify.mjs
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
const out = {};
const login = await post('/api/auth/login', { userName: 'admin', password: '123456', factory: 'YJ_TEST' });
out.login = { http: login.http, code: login.body?.code, factory: login.body?.data?.user?.factory, msg: login.body?.message };
const token = login.body?.data?.token;
if (!token) { console.log(JSON.stringify(out, null, 1)); process.exit(1); }

const call = (panel, button, formData) => post('/api/px/callButton', { panelCode: panel, buttonName: button, formData, buttonParam: {} }, token);
const PO_A = 'YJ-20260909-01';
const PO_B = 'CGDD-20261113-00001';
const today = new Date().toISOString().slice(0, 10);

// 1) 建单:表头订单号写「A、B」多单串(合单生单后的真实形态),行级 源单编号 各带各的
const save = await call('PURCHASE_IN', '保存', {
  单据日期: today, 供应商: '深圳兴文睿环保科技有限公司', 供应商编码: 'YJ-XWR',
  采购订单号: PO_A + '、' + PO_B,
  detail: { items: [
    { 存货编码: 'YJ-XWR-003', 实收数量: 5, 计量单位: '个', 单价: 0.39, 仓库: '恒亿仓', 源单编号: PO_A, 采购订单行号: 1 },
    { 存货编码: 'YJ-XWR-031', 实收数量: 5, 计量单位: '个', 单价: 0.065, 仓库: '恒亿仓', 源单编号: PO_B, 采购订单行号: 1 },
  ] },
});
const docNo = String(save.body?.data?.['编号'] || save.body?.data?.['单据编号'] || '');
out.save = { http: save.http, code: save.body?.code, msg: String(save.body?.message || '').slice(0, 200), docNo };
if (!docNo) { console.log(JSON.stringify(out, null, 1)); process.exit(2); }

// 2) 审核(转ERP 前置:仅已审核单据可转)
const audit = await call('PURCHASE_IN', '审核', { 单据编号: docNo });
out.audit = { http: audit.http, code: audit.body?.code, msg: String(audit.body?.message || '').slice(0, 200) };

// 3) 转ERP
const push = await call('PURCHASE_IN', '转ERP', { 单据编号: docNo });
out.push = { http: push.http, code: push.body?.code, msg: String(push.body?.message || '').slice(0, 400), data: push.body?.data };

// 4) 回读本单(落库后的 是否已转ERP / ERP单号)
const list = await post('/api/px/queryFormDataList', { panelCode: 'PURCHASE_IN', condition: {}, keyword: docNo, pageNo: 1, pageSize: 5 }, token);
const hit = (list.body?.data?.list || []).find((d) => String(d['单据编号'] || d['编号'] || '') === docNo) || {};
out.after = { 单据编号: hit['单据编号'] || hit['编号'], 是否已转ERP: hit['是否已转ERP'], ERP单号: hit['ERP单号'] };
console.log(JSON.stringify(out, null, 1));
