const b='http://127.0.0.1:8090/api'; let tk='', pass=0, fail=0;
const ok=m=>{pass++;console.log('  [PASS] '+m)}, bad=m=>{fail++;console.log('  [FAIL] '+m)};
async function post(p,body){const r=await fetch(b+p,{method:'POST',headers:{'Content-Type':'application/json',...(tk?{Authorization:'Bearer '+tk}:{})},body:JSON.stringify(body||{})});const t=await r.text();let j=null;try{j=JSON.parse(t)}catch{};return{status:r.status,json:j,text:t}}
const msg=r=>String(r.json?.message||r.text||'').slice(0,140);
const btn=(pc,bn,fd)=>post('/px/callButton',{panelCode:pc,buttonName:bn,formData:fd,buttonParam:{}});
(async()=>{
  console.log('== 报工封顶按换算后工序量 ==');
  const l=await post('/auth/login',{userName:'admin',password:'123456'}); tk=l.json?.data?.token; if(!tk){bad('登录');return end()}
  const rows=(await post('/px/workOrderList',{})).json?.data||[];
  const w=rows.find(x=>x['生产线']&&x['结案']!=='Y')||{};
  const no=w['工单号']; console.log('  工单 '+no+' 行排产='+w['排产数量']);
  const d=(await post('/px/processTask/detail',{工单号:no})).json?.data||{};
  const st=(d['工序步骤']||[]).find(x=>x['工序']==='成型')||{};
  const cap=Number(st['计划量']||0), done=Number(st['完工量']||0);
  console.log('  成型:换算后计划量='+cap+' 已完工='+done);
  const qty=Math.max(cap-done,0);
  if(qty<=0){ ok('该单成型已报满,跳过报工用例'); return end() }
  const sv=await btn('WO_REPORT','保存',{单据日期:new Date().toISOString().slice(0,10),detail:{items:[{工单号:no,工序:'成型',报工数量:qty,报工人:'admin',批次号:w['批次号']}]}});
  const rep=sv.json?.data?.编号;
  if(!rep){ bad('报工保存失败(说明仍被旧口径拦住): '+msg(sv)); return end() }
  const au=await btn('WO_REPORT','审核',{编号:rep});
  au.status===200? ok('按换算量报工成功并审核:'+rep+' 数量='+qty) : bad('审核失败: '+msg(au));
  const d2=(await post('/px/processTask/detail',{工单号:no})).json?.data||{};
  const st2=(d2['工序步骤']||[]).find(x=>x['工序']==='成型')||{};
  (st2['状态']==='已完工'||st2['状态']==='超产')? ok('成型步骤状态 = '+st2['状态']+' ('+st2['完工量']+'/'+st2['计划量']+')') : bad('成型状态 = '+st2['状态']);
  const un=await btn('WO_REPORT','弃审',{编号:rep});
  un.status===200? ok('已弃审(痕迹由外层 SQL 清理)') : bad('弃审失败: '+msg(un));
  console.log('清理用报工单号: '+rep);
  return end();
  function end(){console.log(`\n== 结果: PASS ${pass} / FAIL ${fail} ==`);process.exit(fail?1:0)}
})();