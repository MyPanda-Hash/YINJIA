const API='http://localhost:8090/api';
const lj=await (await fetch(API+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json; charset=utf-8'},body:JSON.stringify({userName:'admin',password:'123456'})})).json();
const H={Authorization:'Bearer '+lj.data.token};
for (const pc of ['SL_RECV','QC_INSP','QC_RETURN','PURCHASE_IN']) {
  const cfg=(await (await fetch(`${API}/px/getPanelConfig?panelCode=${pc}`,{headers:H})).json()).data||{};
  const heads=(cfg?.dataSchema?.fields||[]).filter(f=>!f.hidden).map(f=>f.dataName||f.label);
  const det=(cfg?.detail?.tabs?.[0]?.fields||[]).map(f=>f.dataName||f.label);
  console.log(`  ${pc}: 表头含批次号=${heads.includes('批次号')} 明细含批次号=${det.includes('批次号')}`);
}
