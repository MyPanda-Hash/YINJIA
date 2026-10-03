const crypto = require('crypto');
const SECRET = 'CHANGE_ME_YINJIA_RANDOM_HEX_64_A1B2C3D4E5F60718293A4B5C6D7E8F90';
function b64u(o){return Buffer.from(JSON.stringify(o)).toString('base64url');}
const head = b64u({alg:'HS256',typ:'JWT'});
const now = Math.floor(Date.now()/1000);
const payload = b64u({sub:'admin',iat:now,exp:now+3600});
const token = head+'.'+payload+'.'+crypto.createHmac('sha256',SECRET).update(head+'.'+payload).digest('base64url');
(async()=>{
  for (const pc of ['QC_INSP','PURCHASE_IN']) {
    const r = await fetch('http://127.0.0.1:8090/api/px/getPanelConfig?panelCode='+pc,{headers:{Authorization:'Bearer '+token}});
    const j = await r.json();
    const d = j.data || j;
    const sc = d.selectConfig;
    console.log('=====', pc, 'selectConfig.source =', sc && sc.source, '=====');
    if (sc && sc.headerMap) {
      console.log('headerMap 共', sc.headerMap.length, '条:');
      sc.headerMap.forEach((m,i)=>console.log(' ', (i+1)+'.', m.from, '->', m.to));
    } else { console.log('(无 selectConfig/headerMap)'); }
  }
})().catch(e=>{console.error('ERR',e.message);process.exit(1);});
