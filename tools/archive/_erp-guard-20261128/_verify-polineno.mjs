/**
 * 验证(2026-11-28):采购订单**新建**时明细「行号」自动补号(assignPoLineNo)。
 * 走真实后端保存路径(8091 新代码 → 测试账套),保存后由 SQL 查 bl_pu_order.行号 断言 1/2。
 * 用法:node tools\archive\_erp-guard-20261128\_verify-polineno.mjs
 */
const BASE = process.env.MES_BASE || 'http://127.0.0.1:8091';
const jpost = async (path, body, token) => {
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch { /* noop */ }
  return { status: r.status, json, text };
};

const lr = await jpost('/api/auth/login', { userName: 'admin', password: '123456', factory: 'YJ_TEST' });
const token = lr.json?.data?.token;
if (!token) { console.log('[login] FAILED', lr.text.slice(0, 300)); process.exit(1); }
console.log('[login] ok');

const formData = {
  单据日期: '2026-11-28',
  币种: '人民币',
  汇率: 1,
  供应商编码: 'YJ-XWR',
  供应商: '深圳兴文睿环保科技有限公司',
  detail: {
    items: [
      { 物料编码: 'YJ-XWR-031', 物料名称: '白色无纺布80g', 数量: 10, 单位: '张', 单价: 0.065, 计量单位: '张' },
      { 物料编码: 'YJ-XWR-032', 物料名称: '白色无纺布100g', 数量: 20, 单位: '张', 单价: 0.05, 计量单位: '张' },
    ],
  },
};
const res = await jpost('/api/px/callButton',
  { panelCode: 'PU_ORDER', buttonName: '保存', formData, buttonParam: {} }, token);
console.log('[保存] status=' + res.status);
console.log(JSON.stringify(res.json ?? res.text, null, 2).slice(0, 1500));
