import assert from 'node:assert/strict'
const base=process.argv[2] || 'http://127.0.0.1:8090'
for(const factory of ['YJ','YJ_TEST']){
 const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userName:process.env.YINJIA_UI_USER||'admin',password:process.env.YINJIA_UI_PASS,factory})}).then(r=>r.json())
 assert.ok(login.data?.token,'login '+factory)
 const headers={'Content-Type':'application/json',Authorization:'Bearer '+login.data.token}
 const cfg=await fetch(base+'/api/px/getPanelConfig?panelCode=WO_COMPLETION_LIST',{headers}).then(r=>r.json())
 assert.ok(cfg.data,'config '+JSON.stringify(cfg))
 assert.equal(cfg.data.metadata.panelCategory,'报表','flat rows must use report renderer, not document browser')
 assert.notEqual(cfg.data.metadata.singleDoc,true,'not a single-document panel')
 const query=await fetch(base+'/api/px/queryFormDataList',{method:'POST',headers,body:JSON.stringify({panelCode:'WO_COMPLETION_LIST',pageNo:1,pageSize:100})}).then(r=>r.json())
 assert.ok(query.code===0 || query.code===200,'query '+JSON.stringify(query))
 console.log('PASS '+factory+' independent completion list config and query; response='+JSON.stringify(query.data).slice(0,900))
}
