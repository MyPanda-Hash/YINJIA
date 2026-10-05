const b=(process.argv[2]||'http://127.0.0.1:8090')+'/api'; let ok=0,bad=0,tk='';
const P=m=>{ok++;console.log('  [PASS] '+m)},F=m=>{bad++;console.log('  [FAIL] '+m)};
async function c(p,body){const r=await fetch(b+p,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(tk?{Authorization:'Bearer '+tk}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});const t=await r.text();let j=null;try{j=JSON.parse(t)}catch{};return{status:r.status,json:j,text:t}}
(async()=>{
  console.log('== 工艺路线:撤回两轮状态改动 ==');
  const l=await c('/auth/login',{userName:'admin',password:'123456'}); tk=l.json?.data?.token; if(!tk){F('登录失败');return end()}
  const doc=(await c('/px/getFormDescriptor?panelCode=ROUTE&code=GY-CB-STD')).json?.data||{};
  const hdr=doc.data||{}, meta=doc.meta||[], cols=((((doc.detail||{}).tabs||[])[0]||{}).fields||[]).map(f=>f.dataName);
  const m=k=>meta.find(x=>x.code===k)||{};
  console.log('  表头键: '+Object.keys(hdr).join(','));
  console.log('  明细列: '+cols.join(','));
  console.log('  状态: '+JSON.stringify(m('状态'))+'  审核状态: '+JSON.stringify(m('审核状态')));
  m('状态').dataType==='文本'?P('状态 回到文本字段'):F('状态 dataType='+m('状态').dataType);
  Object.keys(hdr).includes('状态')?P('状态 在表头(值='+hdr['状态']+')'):F('状态 不在表头');
  !cols.includes('状态')?P('状态 不在明细列'):F('状态 仍在明细列');
  m('审核状态').dataType==='文本'?P('审核状态 回到文本字段'):F('审核状态 dataType='+m('审核状态').dataType);
  Object.keys(hdr).includes('审核状态')?P('审核状态 在表头(值='+hdr['审核状态']+')'):F('审核状态 不在表头');
  !cols.includes('审核状态')?P('审核状态 已退出明细列'):F('审核状态 仍在明细列');
  return end();
  function end(){console.log(`\n== 结果: PASS ${ok} / FAIL ${bad} ==`);process.exit(bad?1:0)}
})();