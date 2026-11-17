import { readFileSync } from "node:fs";
const cfg = JSON.parse(readFileSync(new URL("../../../deploy/push/config.json", import.meta.url), "utf8"));
import { makeAppSignature, makeApiSignature } from "../../../deploy/kingdee-client.mjs";
const { clientId, clientSecret, domain, sandboxInstanceId } = cfg.kingdee;
const AUTH = "/jdyconnector/app_management/push_app_authorize";
const ts = String(Date.now()); const nonce = String(Math.floor(Math.random()*2000000)+1);
const params = { outerInstanceId: sandboxInstanceId };
const sig = makeApiSignature(clientSecret, "POST", AUTH, params, nonce, ts);
const url = `https://api.kingdee.com${AUTH}?outerInstanceId=${encodeURIComponent(sandboxInstanceId)}`;
const res = await fetch(url, { method: "POST", headers: {
  "Content-Type":"application/json","X-Api-ClientID":clientId,"X-Api-Auth-Version":"2.0","X-Api-TimeStamp":ts,
  "X-Api-Nonce":nonce,"X-Api-SignHeaders":"X-Api-TimeStamp,X-Api-Nonce","X-Api-Signature":sig,
  "X-GW-Router-Addr":domain } , body: "{}"});
console.log("HTTP", res.status);
const text = await res.text();
console.log(text.slice(0, 600));

