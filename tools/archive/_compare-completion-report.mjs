const base='http://127.0.0.1:8090'
const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userName:'admin',password:process.env.YINJIA_UI_PASS,factory:'YJ'})}).then(r=>r.json())
for(const code of ['WO_REPORT_LIST','WO_COMPLETION_LIST']){
 const cfg=await fetch(base+'/api/px/getPanelConfig?panelCode='+code,{headers:{Authorization:'Bearer '+login.data.token}}).then(r=>r.json())
 console.log(code,JSON.stringify({metadata:cfg.data?.metadata && {panelCategory:cfg.data.metadata.panelCategory,report:cfg.data.metadata.report,singleDoc:cfg.data.metadata.singleDoc},keys:Object.keys(cfg.data||{})}))
}
