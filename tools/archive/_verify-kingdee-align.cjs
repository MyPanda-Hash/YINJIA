// 终验探针:全部面板 getPanelConfig + queryFormDataList 扫描 + 单据新增/删除 E2E
const BASE = 'http://127.0.0.1:8090/api';

async function api(path, body, token) {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  }).then((x) => x.json());
  return r;
}

async function main() {
  const lr = await fetch(`${BASE}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  }).then((r) => r.json());
  if (lr.code !== 200) throw new Error('login failed: ' + lr.message);
  const token = lr.data.token;
  console.log('[login] ok');

  // 面板全集来自面板配置接口的注册表
  const panelsResp = await fetch(`${BASE}/px/panels`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
  let codes = [];
  if (panelsResp.code === 200 && Array.isArray(panelsResp.data)) {
    codes = panelsResp.data.map((p) => p.code || p.panelCode).filter(Boolean);
  }
  if (!codes.length) {
    // 兜底:已知面板清单(从菜单/审计)
    codes = ['KHDA','GFDA','CKDA','YWYDA','ZDGL','INV','UOM','DEPT','EMP','WH','BOM','INV_PRICE','PARTNER','REGION','PROJ',
      'EQUIP','TEAM','WC','OP','ROUTE','REJECT','QC_ITEM','QC_PLAN','FIN_TAX','FIN_EXP','FIN_ACC','SETTLE','CUSGRP','SUPGRP','MATGRP','CUR',
      'SO_ORDER','PU_ORDER','PU_REQ','PURCHASE_IN','FINISH_IN','OTHER_IN','OTHER_OUT','SALE_OUT','MATERIAL_OUT','OUTSOURCE_ORDER','OUTSOURCE_ISSUE','OUTSOURCE_IN',
      'MANU_ORDER','DISPATCH','WO_ORDER','WO_SCHEDULE','WO_PICK','WO_REPORT','WO_LINE','QC_RECV','QC_INSP','QC_RETURN','QC_OP','QC_RECORD','QC_DISPOSAL','ROD_RETURN',
      'LOT_TRACE','STOCK_STATUS','ERPLG','RD_APPROVAL','RD_PLAN','RD_PROGRESS','RD_PROD_INFO','RD_MOLD_PROC','RD_ASM_PROC','RD_SPEC_DOC','RD_INSP_PLAN',
      'PURCHASE_IN_DETAIL','PURCHASE_IN_STATS','FINISH_IN_DETAIL','FINISH_IN_STATS','OTHER_IN_DETAIL','OTHER_IN_STATS','OTHER_OUT_DETAIL','OTHER_OUT_STATS',
      'SALE_OUT_DETAIL','SALE_OUT_STATS','MATERIAL_OUT_DETAIL','MATERIAL_OUT_STATS','OUTSOURCE_IN_DETAIL','OUTSOURCE_IN_STATS','OUTSOURCE_ISSUE_DETAIL','OUTSOURCE_ISSUE_STATS',
      'MANU_ORDER_DETAIL','MANU_ORDER_STATS','DISPATCH_DETAIL','DISPATCH_STATS','SALES_ORDER_DETAIL','SALES_ORDER_STATS','WO_KIT'];
  }
  console.log('[panels] 共 %d 个面板待扫描', codes.length);

  let cfgFail = [], qFail = [];
  for (const pc of codes) {
    const cfg = await fetch(`${BASE}/px/getPanelConfig?panelCode=${pc}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
    if (cfg.code !== 200) { cfgFail.push(`${pc}:${cfg.message}`); continue; }
    const q = await api('/px/queryFormDataList', { panelCode: pc, pageNo: 1, pageSize: 2 }, token);
    if (q.code !== 200) qFail.push(`${pc}:${q.message}`);
  }
  console.log('[config] 失败 %d 个 %s', cfgFail.length, cfgFail.join(' | ') || '');
  console.log('[query ] 失败 %d 个 %s', qFail.length, qFail.join(' | ') || '');

  // 单据新增 E2E(RKD 空表单保存 = FormNoService 写 s_allno;此前必截断报错)
  const created = [];
  for (const pc of ['RKD', 'SO_ORDER', 'PU_ORDER', 'MANU_ORDER']) {
    const n = await api('/px/callButton', { panelCode: pc, buttonName: '提交', formData: {}, buttonParam: {} }, token);
    if (n.code !== 200) { console.log('[新增 %s] FAIL %s', pc, n.message); process.exitCode = 1; continue; }
    const no = n.data['编号'];
    console.log('[新增 %s] 单号=%s 状态=%s', pc, no, n.data['单据状态']);
    created.push({ pc, no });
  }
  for (const { pc, no } of created) {
    const d = await api('/px/callButton', { panelCode: pc, buttonName: '删除', formData: { 编号: no }, buttonParam: {} }, token);
    console.log('[删除 %s] %s %s', pc, no, d.code === 200 ? 'ok' : 'FAIL ' + d.message);
  }

  // 档案面板新增一行(CUR)+清空
  const s1 = await api('/px/callButton', { panelCode: 'CUR', buttonName: '提交', formData: { detail: { items: [
    { 编码: 'ZZZ', 名称: '终验币别', 币别符号: 'Z', 汇率: 1, 汇率类型: '固定汇率', 金额小数位: 2, 单价小数位: 4 } ] } }, buttonParam: {} }, token);
  console.log('[档案 CUR] 保存 %s', s1.code === 200 ? 'ok' : 'FAIL ' + s1.message);
  await api('/px/callButton', { panelCode: 'CUR', buttonName: '提交', formData: { detail: { items: [] } }, buttonParam: {} }, token);

  const ok = cfgFail.length === 0 && qFail.length === 0 && !process.exitCode;
  console.log(ok ? 'RESULT: ALL PASS' : 'RESULT: HAS FAILURES');
}
main().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
