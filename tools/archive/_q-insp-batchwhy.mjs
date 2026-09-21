const API='http://localhost:8090/api';
const lj=await (await fetch(API+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json; charset=utf-8'},body:JSON.stringify({userName:'admin',password:'123456'})})).json();
const H={Authorization:'Bearer '+lj.data.token};
const cfg=(await (await fetch(API+'/px/getPanelConfig?panelCode=QC_RECV',{headers:H})).json()).data||{};
console.log('QC_RECV pushTargets:', JSON.stringify(cfg?.metadata?.pushTargets));
const insp=(await (await fetch(API+'/px/getPanelConfig?panelCode=QC_INSP',{headers:H})).json()).data||{};
console.log('QC_INSP 表头含批次号(→ 会被判为"分批面板"):', (insp?.dataSchema?.fields||[]).some(f=>(f.dataName||f.label)==='批次号'));
console.log('QC_INSP selectConfig.batchFlow:', insp?.selectConfig?.batchFlow, ' 来源:', insp?.selectConfig?.source);
