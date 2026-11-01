const BASE='http://127.0.0.1:8090/api';
(async()=>{
 const lr=await fetch(BASE+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userName:'admin',password:'123456',factory:'YJ'})}).then(r=>r.json());
 const H={Authorization:'Bearer '+lr.data.token};
 const r=await fetch(BASE+'/px/getPanelConfig?panelCode=QC_CATALOG',{headers:H}).then(r=>r.json());
 console.log(JSON.stringify(r.data?.buttons||r.data?.actions||r.data?.toolbar||r.data,null,1).slice(0,2000));
})();
