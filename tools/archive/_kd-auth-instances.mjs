// 探针:① 列出本应用被授权的全部实例(判断"API 看的账套"是不是唯一的真实账套);
//       ② 核对 API 看到的商品 id 是否就是 MES 从金蝶同步来的那批(账套同一性硬证据)
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { buildSignPlain, makeApiSignature, fetchAppToken, kingdeeTryGet } from '../../deploy/kingdee-client.mjs';

const cfg = JSON.parse(readFileSync(new URL('../../deploy/config.json', import.meta.url), 'utf8'));
const k = cfg.kingdee;

// ① push_app_authorize(POST,需签名):拿授权实例清单
const path = '/jdyconnector/app_management/push_app_authorize';
const params = { outerInstanceId: k.outerInstanceId };
const ts = String(Date.now());
const nonce = String(Math.floor(Math.random() * 2147483646) + 1);
const qs = Object.keys(params).sort().map((x) => `${x}=${encodeURIComponent(params[x])}`).join('&');
const url = `https://api.kingdee.com${path}?${qs}`;
const res = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Api-ClientID': k.clientId,
    'X-Api-Auth-Version': '2.0',
    'X-Api-TimeStamp': ts,
    'X-Api-Nonce': nonce,
    'X-Api-SignHeaders': 'X-Api-TimeStamp,X-Api-Nonce',
    'X-Api-Signature': makeApiSignature(k.clientSecret, 'POST', path, params, nonce, ts),
    'X-GW-Router-Addr': k.domain,
  },
  body: '{}',
});
const j = await res.json().catch(() => ({}));
console.log('push_app_authorize errcode=', j.errcode, j.description || '');
const list = Array.isArray(j.data) ? j.data : (j.data ? [j.data] : []);
console.log(`授权实例数 = ${list.length}`);
const mask = (s) => (s ? String(s).slice(0, 6) + '…' : s);
for (const x of list) {
  const safe = {};
  for (const [kk, vv] of Object.entries(x)) safe[kk] = /key|secret/i.test(kk) ? mask(vv) : vv;
  console.log('  -', JSON.stringify(safe));
}

// ② 账套同一性:API 的商品 id 能否在 MES bs_inv 里找到
const { token } = await fetchAppToken(k);
const mat = await kingdeeTryGet(k, token, '/jdy/v2/bd/material', { page: '1', page_size: '5' });
const picks = (mat.data?.rows || []).map((r) => ({ id: String(r.id), no: r.number, name: r.name }));
console.log('\nAPI 看到的商品(前 5 个):');
for (const p of picks) console.log(`   ${p.no} | ${p.name} | id=${p.id}`);
console.log('\n核对 SQL(在 MES 库执行,看这些 id/编码是否就是同步来的):');
console.log(picks.map((p) => `SELECT '${p.no}' AS 编码, (SELECT COUNT(*) FROM bs_inv WHERE 外部数据ID = '${p.id}') AS 按id命中, (SELECT COUNT(*) FROM bs_inv WHERE 存货编码 = '${p.no}') AS 按编码命中;`).join('\n'));
