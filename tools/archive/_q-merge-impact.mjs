const API='http://localhost:8090/api';
const lj=await (await fetch(API+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json; charset=utf-8'},body:JSON.stringify({userName:'admin',password:'123456'})})).json();
const H={Authorization:'Bearer '+lj.data.token};
const cfg=(await (await fetch(API+'/px/getPanelConfig?panelCode=PU_ORDER',{headers:H})).json()).data||{};
console.log('PU_ORDER pushTargets:', JSON.stringify(cfg?.metadata?.pushTargets));
const sel=(await (await fetch(API+'/px/getPanelConfig?panelCode=PURCHASE_IN',{headers:H})).json()).data||{};
console.log('PURCHASE_IN selectConfig.source:', JSON.stringify(sel?.selectConfig?.source));
// 暂收面板(新编码)是否有选单配置
const recv=(await (await fetch(API+'/px/getPanelConfig?panelCode=QC_RECV',{headers:H})).json()).data||{};
console.log('QC_RECV selectConfig.source:', JSON.stringify(recv?.selectConfig?.source), ' 表头字段数', (recv?.dataSchema?.fields||[]).length, ' 明细字段数', (recv?.detail?.tabs?.[0]?.fields||[]).length);
console.log('QC_RECV 表头含批次号:', (recv?.dataSchema?.fields||[]).some(f=>(f.dataName||f.label)==='批次号'));
try { const r=(await (await fetch(API+'/px/getPanelConfig?panelCode=SL_RECV',{headers:H})).json()); console.log('SL_RECV 面板编码还在?', r.code, String(r.message||'').slice(0,60)); } catch(e) { console.log('SL_RECV 查询失败', e.message); }
