const API='http://localhost:8090/api';
const lj=await (await fetch(API+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json; charset=utf-8'},body:JSON.stringify({userName:'admin',password:'123456'})})).json();
const H={Authorization:'Bearer '+lj.data.token};
for (const pc of ['INV','GFDA','EMP','DEPT','UOM']) {
  const cfg=(await (await fetch(`${API}/px/getPanelConfig?panelCode=${pc}`,{headers:H})).json()).data||{};
  const md=cfg.metadata||{};
  const heads=(cfg.dataSchema?.fields||[]).filter(f=>!f.hidden).map(f=>f.dataName||f.label);
  const names=md.panelPageDto?.formPages?.[0]?.fieldNames||'';
  const qf=(md.panelPageDto?.queryFields||[]).map(f=>f.dataName);
  console.log(`${pc}: singleDoc=${md.singleDoc} category=${md.panelCategory} 非隐藏字段=${heads.length} formPages.fieldNames=${JSON.stringify(String(names).slice(0,70))} queryFields=${JSON.stringify(qf)}`);
}
