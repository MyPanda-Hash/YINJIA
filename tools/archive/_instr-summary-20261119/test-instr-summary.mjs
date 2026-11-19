const base='http://127.0.0.1:8090';
for (const factory of ['YJ','YJ_TEST']) {
  const lr=await fetch(base+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({userName:'admin',password:'123456',factory})});
  const lj=await lr.json();
  const token=lj.data?.token;
  const r=await fetch(base+'/api/px/instrUseSummary',{method:'POST',headers:{'content-type':'application/json',Authorization:'Bearer '+token},body:'{}'});
  const j=await r.json();
  console.log(factory,'HTTP',r.status,'code',j.code,'rows',j.data?.list?.length,'total',j.data?.totalSize);
  if (factory==='YJ_TEST') console.log(JSON.stringify(j.data?.list,null,1));
}
