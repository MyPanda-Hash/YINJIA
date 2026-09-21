import { createRequire } from 'node:module';
const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const API='http://localhost:8090/api';
const lj=await (await fetch(API+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json; charset=utf-8'},body:JSON.stringify({userName:'admin',password:'123456'})})).json();
const H={Authorization:'Bearer '+lj.data.token};
const cfg=(await (await fetch(API+'/px/getPanelConfig?panelCode=QC_RECV',{headers:H})).json()).data||{};
console.log('QC_RECV 按钮组:', JSON.stringify((cfg?.metadata?.buttonGroups||[]).map(g=>({name:g.name,actions:g.actions}))));
console.log('QC_RECV 灰置动作:', JSON.stringify(cfg?.metadata?.disabledActions));
console.log('QC_RECV pushTargets:', JSON.stringify(cfg?.metadata?.pushTargets));
await pool_unused();
function pool_unused(){}
