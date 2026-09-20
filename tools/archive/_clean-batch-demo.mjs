const API='http://localhost:8090/api';
const lj=await (await fetch(API+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json; charset=utf-8'},body:JSON.stringify({userName:'admin',password:'123456'})})).json();
const H={'Content-Type':'application/json; charset=utf-8',Authorization:'Bearer '+lj.data.token};
const cb=async(p,b,f)=>{const r=await fetch(API+'/px/callButton',{method:'POST',headers:H,body:JSON.stringify({panelCode:p,buttonName:b,formData:f,buttonParam:{}})});const j=await r.json();return j.code===0||j.code===200?'ok':(j.message||JSON.stringify(j));};
for (const [p,no] of [['PURCHASE_IN','PI-2026-09-0022'],['QC_RETURN','TH-2026-09-0004']]) {
  for (const b of ['删除']) { const r = await cb(p,b,{编号:no}); console.log(`  ${p} ${no} ${b}: ${r}`); }
}
