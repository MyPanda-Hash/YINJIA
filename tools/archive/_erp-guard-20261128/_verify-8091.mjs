/**
 * 验证脚本(2026-11-28):在 8091(新代码)上对测试账套单据执行「转ERP」,验证
 *   ① 行上没有采购订单行号 ⇒ 按物料自动定位到金蝶订单分录;
 *   ② batch_no 落 MES「批次号」而不是 PC0000;
 *   ③ 预检提示(超收/已收满)出现在返回 message 里。
 * 目标:测试账套 HSDZ_MES_TEST 的单据 → 金蝶**沙箱**(application.yml allowProd=false)。
 * 用法:node tools\archive\_erp-guard-20261128\_verify-8091.mjs [单据编号]
 */
const BASE = process.env.MES_BASE || 'http://127.0.0.1:8091';
const DOC = process.argv[2] || 'PI-TEST-1128';

const jpost = async (path, body, token) => {
  const r = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* 非 JSON 原样打印 */ }
  return { status: r.status, json, text };
};

const lr = await jpost('/api/auth/login', { userName: 'admin', password: '123456', factory: 'YJ_TEST' });
const token = lr.json?.data?.token;
console.log('[login] status=' + lr.status + ' factory=' + (lr.json?.data?.user?.factory || '?') + ' token=' + (token ? 'ok' : 'MISSING'));
if (!token) { console.log(lr.text.slice(0, 400)); process.exit(1); }

const push = await jpost('/api/px/callButton',
  { panelCode: 'PURCHASE_IN', buttonName: '转ERP', formData: { 编号: DOC, 单据编号: DOC }, buttonParam: {} }, token);
console.log('[转ERP] status=' + push.status);
console.log(JSON.stringify(push.json ?? push.text, null, 2));
