const BASE='http://127.0.0.1:8090'
const login=async()=>{const r=await fetch(BASE+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userName:'admin',password:'123456'})});return (await r.json()).data.token}
const t=await login()
const g=async(p)=>{const r=await fetch(BASE+'/api'+p,{headers:{Authorization:'Bearer '+t}});return await r.json()}
const c=await g('/px/getPanelConfig?panelCode=QC_TC_IN')
console.log('metadata keys:', Object.keys(c.data.metadata||{}).join(','))
const l=await fetch(BASE+'/api/px/queryFormDataList',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+t},body:JSON.stringify({panelCode:'QC_BHC',condition:{},pageNo:1,pageSize:3})}).then(r=>r.json())
console.log('QC_BHC row keys:', Object.keys(l.data.list[0]||{}).join(','))
