const crypto = require('crypto');
const SECRET = 'CHANGE_ME_YINJIA_RANDOM_HEX_64_A1B2C3D4E5F60718293A4B5C6D7E8F90';
function b64u(o){return Buffer.from(JSON.stringify(o)).toString('base64url');}
const head = b64u({alg:'HS256',typ:'JWT'});
const now = Math.floor(Date.now()/1000);
const payload = b64u({sub:'admin',iat:now,exp:now+3600});
const token = head+'.'+payload+'.'+crypto.createHmac('sha256',SECRET).update(head+'.'+payload).digest('base64url');
(async()=>{
  // 列表表头列:queryFormDataList 的 meta/列标签
  const r = await fetch('http://127.0.0.1:8090/api/px/queryFormDataList?panelCode=QC_INSP&pageNo=1&pageSize=1',{
    method:'POST', headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body: JSON.stringify({panelCode:'QC_INSP', pageNo:1, pageSize:1})});
  const j = await r.json();
  const d = j.data || j;
  if (!r.ok || j.code >= 400) console.log('BODY:', JSON.stringify(j).slice(0, 600));
  const cols = (d.meta && d.meta.columns) || d.columns || [];
  console.log('HTTP', r.status);
  console.log('list column count =', Array.isArray(cols) ? cols.length : JSON.stringify(cols).slice(0,200));
  if (Array.isArray(cols)) console.log('list columns:', cols.map(c=>c.label||c.title||c.dataIndex||c.prop||String(c)).join(' | '));
})().catch(e=>{console.error('ERR',e.message);process.exit(1);});
