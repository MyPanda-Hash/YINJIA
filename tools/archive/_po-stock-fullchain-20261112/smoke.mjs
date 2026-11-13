// 冒烟(2026-11-12):确认 8090 在跑的面板配置里,四站的「现存量」都在(且除采购订单/采购入库外均 hidden)
const base = 'http://127.0.0.1:8090';
const l = await (await fetch(base + '/api/auth/login', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userName: 'admin', password: '123456' }),
})).json();
const H = { Authorization: 'Bearer ' + l.data.token };
for (const p of ['PU_ORDER', 'QC_RECV', 'QC_INSP', 'QC_RETURN', 'QC_TC_IN', 'PURCHASE_IN']) {
  const r = await (await fetch(`${base}/api/px/getPanelConfig?panelCode=${p}`, { headers: H })).json();
  const d = r.data || {};
  const form = (d.metadata?.panelPageDto?.formPages?.[0]?.fields) || [];
  const tabs = d.detail?.tabs || [];
  const det = tabs.flatMap((t) => t.fields || []);
  const hit = [...form, ...det].find((f) => f.dataName === '现存量');
  const schema = (d.dataSchema?.fields || []).find((f) => f.dataName === '现存量');
  const none = !hit;
  console.log(`${p.padEnd(12)} 现存量: ${hit ? `宽${hit.width} 隐藏=${!!hit.hidden} 可见=${hit.visible !== false}` : '（表单不下发）'}` +
    `  schema=${schema ? '登记' : '无'}` +
    (none ? '  ← 表头隐藏字段与 批次键/检验单号 同口径:不进表单下发,但保存仍写列(e2e-tc.mjs 实测 TCI-2026-11-0001 表头=8888)' : ''));
}
