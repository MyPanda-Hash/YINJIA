import { createRequire } from 'node:module';
const mssql = createRequire('D:/jdy-sync/package.json')('mssql');
const API='http://localhost:8090/api';
const pool = await new mssql.ConnectionPool({ server:'127.0.0.1', port:1433, database:'HSDZ_MES', user:'yinjia', password:'Yinjia@2026', options:{encrypt:false,trustServerCertificate:true} }).connect();
const q = async (s) => (await new mssql.Request(pool).query(s)).recordset;
const lj=await (await fetch(API+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json; charset=utf-8'},body:JSON.stringify({userName:'admin',password:'123456'})})).json();
const H={Authorization:'Bearer '+lj.data.token};
for (const pc of ['INV','GFDA','KHDA','EMP','DEPT','UOM','WH','ZDGL','SETTLE']) {
  const cfg=(await (await fetch(`${API}/px/getPanelConfig?panelCode=${pc}`,{headers:H})).json()).data||{};
  const qf=(cfg.metadata?.panelPageDto?.queryFields||[]).map(f=>f.dataName);
  const name=(await q(`SELECT panel_name FROM yj_panel WHERE panel_code=N'${pc}'`))[0]?.panel_name;
  console.log(`  ${pc}(${name}): ${qf.length} 个 → ${JSON.stringify(qf)}`);
}
await pool.close();
