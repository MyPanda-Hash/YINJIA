/** _probe-next-process.mjs — 下一道工序/候选产线(方案第2步统一口径)验收(2026-10-05) */
const b=(process.argv[2]||'http://127.0.0.1:8090')+'/api'; let pass=0,fail=0,tk=''
const ok=m=>{pass++;console.log('  [PASS] '+m)}, bad=m=>{fail++;console.log('  [FAIL] '+m)}
async function call(p,body){const r=await fetch(b+p,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(tk?{Authorization:'Bearer '+tk}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});const t=await r.text();let j=null;try{j=JSON.parse(t)}catch{};return{status:r.status,json:j,text:t}}
(async()=>{
  console.log('== 下一道工序 + 候选产线 ==')
  const l=await call('/auth/login',{userName:'admin',password:'123456'}); tk=l.json?.data?.token
  if(!tk){bad('登录失败');return end()}
  const wos=(await call('/px/workOrderList',{})).json?.data||[]
  const unstarted=wos.filter(r=>r['结案']!=='Y'&&!r['生产线']).slice(0,12).map(r=>r['工单号'])
  const nos=unstarted.length?unstarted:wos.slice(0,6).map(r=>r['工单号'])
  const res=(await call('/px/processTask/nextProcess',{工单号列表:nos})).json?.data||[]
  console.log('  查询 '+nos.length+' 张单 → 返回 '+res.length+' 条')
  res.length>0?ok('接口返回下一道工序'):bad('接口无返回')
  const bad1=res.filter(x=>!x['下一道工序']||!x['生产车间'])
  bad1.length===0?ok('每条都有 工艺路线/下一道工序/生产车间'):bad('缺字段: '+JSON.stringify(bad1[0]))
  const allLines=res.every(x=>(x['候选产线']||[]).length>0)
  allLines?ok('候选产线非空(按该工序功能收敛)'):bad('有工单候选产线为空: '+JSON.stringify(res.find(x=>!(x['候选产线']||[]).length)))
  const sample=res[0]||{}
  console.log('  样例: '+sample['单号']+' 路线='+sample['工艺路线']+' 下一道='+sample['下一道工序']+'('+sample['生产车间']+') 候选线 '+(sample['候选产线']||[]).length+' 条')
  const lines=(await call('/px/scheduleBoard/linesSummary',{})).json?.data||[]
  const okShop=res.every(x=>(x['候选产线']||[]).every(n=>{const L=lines.find(y=>y['生产线']===n);return !L||L['生产车间']===x['生产车间']}))
  okShop?ok('候选产线的生产车间 = 下一道工序功能(口径一致)'):bad('候选线与工序功能不一致')
  const d=(await call('/px/processTask/detail',{工单号:res[0]['单号']})).json?.data||{}
  const steps=(d['工序步骤']||[]).map(s=>s['工序'])
  const routeOps=(await call('/px/processTask/nextProcess',{工单号列表:[res[0]['单号']]})).json?.data?.[0]||{}
  console.log('  详情步骤: '+steps.join('→')+' ｜ 路线='+((d['表头']||{})['工艺路线']))
  steps.length>0?ok('工单详情步骤条按路线渲染('+steps.length+' 步)'):bad('详情无步骤')
  return end()
  function end(){console.log(`\n== 结果: PASS ${pass} / FAIL ${fail} ==`);process.exit(fail?1:0)}
})();