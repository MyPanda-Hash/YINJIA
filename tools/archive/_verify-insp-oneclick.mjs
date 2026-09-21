const API='http://localhost:8090/api';
const lj=await (await fetch(API+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json; charset=utf-8'},body:JSON.stringify({userName:'admin',password:'123456'})})).json();
const H={'Content-Type':'application/json; charset=utf-8',Authorization:'Bearer '+lj.data.token};
const post=async(u,b)=>{const r=await fetch(API+u,{method:'POST',headers:H,body:JSON.stringify(b)});const j=await r.json();if(j.code!==0&&j.code!==200)throw new Error(`${u} → ${j.message}`);return j.data;};
// ① 先造一批:订单 YJ-20260916-01 行1 送 40
const PO='YJ-20260916-01';
const st=await post('/px/batchFlow/lines',{sourcePanel:'PU_ORDER',targetPanel:'QC_RECV',sourceNo:PO});
const line=st.lines.find(l=>Number(l.剩余数量)>0);
const gen=await post('/px/batchFlow/generate',{sourcePanel:'PU_ORDER',targetPanel:'QC_RECV',sourceNo:PO,lines:[{lineKey:line.lineKey,qty:40}]});
await post('/px/callButton',{panelCode:'QC_RECV',buttonName:'审核',formData:{编号:gen['编号']},buttonParam:{}});
// ② 一键整单生成来料检验单(不带任何数量参数 = 走 PushGenerateHandler 默认整单送完剩余)
const insp=await post('/px/callButton',{panelCode:'QC_RECV',buttonName:'生成来料检验单',formData:{编号:gen['编号']},buttonParam:{}});
console.log('  暂收', gen['编号'], '批次', gen['批次号'], '→ 检验单', insp['编号']);
const rows=await (await fetch(API+'/px/queryFormDataList',{method:'POST',headers:H,body:JSON.stringify({panelCode:'QC_INSP',condition:{单据编号:insp['编号']},pageNo:1,pageSize:5})})).json();
const doc=rows.data.list[0];
console.log('  检验单头批次号=', doc['批次号'], ' 采购订单号=', doc['采购订单号']);
console.log('  检验行 送检数量=', doc.detail.items.map(i=>i['送检数量']), ' 批次号=', doc.detail.items.map(i=>i['批次号']), ' 采购订单行号=', doc.detail.items.map(i=>i['采购订单行号']));
// ③ 再点一次:该暂收单已无剩余 → 应被拒
try { await post('/px/callButton',{panelCode:'QC_RECV',buttonName:'生成来料检验单',formData:{编号:gen['编号']},buttonParam:{}}); console.log('  ✗ 第二次生单未被拒'); }
catch(e){ console.log('  第二次生单被拒:', String(e.message).slice(0, 90)); }
console.log('  清理:', (await post('/px/callButton',{panelCode:'QC_INSP',buttonName:'删除',formData:{编号:insp['编号']},buttonParam:{}}))?'检验单作废 ok':'ok');
await post('/px/callButton',{panelCode:'QC_RECV',buttonName:'弃审',formData:{编号:gen['编号']},buttonParam:{}}).catch(()=>{});
await post('/px/callButton',{panelCode:'QC_RECV',buttonName:'删除',formData:{编号:gen['编号']},buttonParam:{}}).catch(()=>{});
console.log('  暂收单已清理');
