const BASE='http://127.0.0.1:8090'
const login=async()=>{const r=await fetch(BASE+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userName:'admin',password:'123456'})});return (await r.json()).data.token}
const t=await login()
for (const p of ['QC_TC_IN','QC_BHC','QC_BHG','QC_INSP_REC','QC_RETURN']) {
  const l=await fetch(BASE+'/api/px/queryFormDataList',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+t},body:JSON.stringify({panelCode:p,condition:{},pageNo:1,pageSize:2})}).then(r=>r.json())
  console.log(p, '->', Object.keys(l.data?.list?.[0]||{}).join(','))
}
