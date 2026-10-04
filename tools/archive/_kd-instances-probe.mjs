// 探针:列出本应用被授权的全部实例(账套)——判断 BOM 数据是否在另一个账套里
import { readFileSync } from 'node:fs';
import { fetchAuthorization } from '../../deploy/kingdee-client.mjs';

const cfg = JSON.parse(readFileSync(new URL('../../deploy/config.json', import.meta.url), 'utf8'));
const auth = await fetchAuthorization(cfg.kingdee);
console.log('当前使用实例:', JSON.stringify({ appKey: auth.appKey.slice(0, 6) + '…', domain: auth.domain }));
// 再取原始响应,看有几个实例
const mask = (s) => (s ? String(s).slice(0, 6) + '…' : s);
const { buildSignPlain, makeApiSignature } = await import('../../deploy/kingdee-client.mjs').catch(() => ({}));
const res = await fetch('https://api.kingdee.com/jdyconnector/app_management/push_app_authorize?outerInstanceId=' + encodeURIComponent(cfg.kingdee.outerInstanceId), {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Api-ClientID': cfg.kingdee.clientId,
    'X-Api-Auth-Version': '2.0',
    'X-GW-Router-Addr': cfg.kingdee.domain,
  },
  body: '{}',
}).catch((e) => ({ json: async () => ({ err: e.message }) }));
const j = await res.json().catch(() => ({}));
console.log('raw errcode=', j.errcode, 'code=', j.code, 'desc=', j.description || j.msg);
const list = Array.isArray(j.data) ? j.data : [];
console.log(`授权实例数 = ${list.length}`);
for (const x of list) {
  console.log('  -', JSON.stringify({ status: x.status, appKey: mask(x.appKey), appSecret: mask(x.appSecret), domain: x.domain, ...Object.fromEntries(Object.entries(x).filter(([k]) => !/key|secret/i.test(k)).slice(0, 8)) }));
}
