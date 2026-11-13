import { readFileSync } from "node:fs";
const cfg = JSON.parse(readFileSync(new URL("../../../deploy/push/config.json", import.meta.url), "utf8"));
const { clientId, clientSecret, domain, sandboxInstanceId } = cfg.kingdee;
const AUTH = "/jdyconnector/app_management/push_app_authorize";
const TOKEN = "/jdyconnector/app_management/kingdee_auth_token";
import { makeAppSignature, makeApiSignature, makeApiSignature as mk } from "../../../deploy/kingdee-client.mjs";
const ts = String(Date.now()); const nonce = String(Math.floor(Math.random()*2000000)+1);
const ap = { outerInstanceId: sandboxInstanceId };
const auth = await (await fetch(`https://api.kingdee.com${AUTH}?outerInstanceId=${encodeURIComponent(sandboxInstanceId)}`, {
  method:"POST", headers:{ "Content-Type":"application/json","X-Api-ClientID":clientId,"X-Api-Auth-Version":"2.0",
  "X-Api-TimeStamp":ts,"X-Api-Nonce":nonce,"X-Api-SignHeaders":"X-Api-TimeStamp,X-Api-Nonce",
  "X-Api-Signature":mk(clientSecret,"POST",AUTH,ap,nonce,ts),"X-GW-Router-Addr":domain }, body:"{}"})).json();
const appKey = auth.data[0].appKey, appSecret = auth.data[0].appSecret;
const ts2 = String(Date.now()); const nonce2 = String(Math.floor(Math.random()*2000000)+1);
const tp = { app_key: appKey, app_signature: makeAppSignature(appKey, appSecret) };
const url = `https://api.kingdee.com${TOKEN}?app_key=${encodeURIComponent(appKey)}&app_signature=${encodeURIComponent(tp.app_signature)}`;
const res = await fetch(url, { headers: { "Content-Type":"application/json","X-Api-ClientID":clientId,"X-Api-Auth-Version":"2.0",
  "X-Api-TimeStamp":ts2,"X-Api-Nonce":nonce2,"X-Api-SignHeaders":"X-Api-TimeStamp,X-Api-Nonce",
  "X-Api-Signature":mk(clientSecret,"GET",TOKEN,tp,nonce2,ts2),"X-GW-Router-Addr":domain }});
console.log("HTTP", res.status);
const txt = await res.text();
console.log(txt.slice(0,400));
