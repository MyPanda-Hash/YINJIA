const crypto = require('crypto');
const SECRET = 'CHANGE_ME_YINJIA_RANDOM_HEX_64_A1B2C3D4E5F60718293A4B5C6D7E8F90';
function b64u(o){return Buffer.from(JSON.stringify(o)).toString('base64url');}
const head = b64u({alg:'HS256',typ:'JWT'});
const now = Math.floor(Date.now()/1000);
const payload = b64u({sub:'admin',iat:now,exp:now+3600});
const sig = crypto.createHmac('sha256',SECRET).update(head+'.'+payload).digest('base64url');
const token = head+'.'+payload+'.'+sig;
(async()=>{
  const r = await fetch('http://127.0.0.1:8090/api/px/getPanelConfig?panelCode=QC_INSP',{headers:{Authorization:'Bearer '+token}});
  const j = await r.json();
  const d = j.data || j;
  const fields = (d.dataSchema&&d.dataSchema.fields)||[];
  console.log('HTTP', r.status, 'header fields count =', fields.length);
  console.log('header list:', fields.map(f=>f.dataName||f.name).join(' | '));
  const names = d.metadata && d.metadata.panelPageDto && d.metadata.panelPageDto.formPages && d.metadata.panelPageDto.formPages[0] && d.metadata.panelPageDto.formPages[0].fieldNames;
  console.log('fieldNames CSV:', names);
  const dup = {};
  fields.forEach(f=>{const k=f.dataName||f.name; dup[k]=(dup[k]||0)+1;});
  console.log('duplicated dataName:', Object.entries(dup).filter(([k,v])=>v>1));
})().catch(e=>{console.error('ERR',e.message);process.exit(1);});
