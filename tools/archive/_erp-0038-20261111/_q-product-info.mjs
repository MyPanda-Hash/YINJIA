import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const cfg = JSON.parse(readFileSync(resolve("deploy/config.json"), "utf8").replace(/^\uFEFF/, "")).kingdee;
const enc1 = (s) => encodeURIComponent(String(s));
const hmacHex = (k, m) => createHmac("sha256", k).update(m, "utf8").digest("hex");
const b64 = (s) => Buffer.from(s, "utf8").toString("base64");
const params = { outerInstanceId: cfg.outerInstanceId };
const qs = Object.keys(params).sort().map((k) => `${k}=${enc1(params[k])}`).join("&");
const nonce = String(Math.floor(Math.random() * 2147483646) + 1);
const ts = String(Date.now());
const plain = ["POST", enc1("/jdyconnector/app_management/push_app_authorize"), qs, `x-api-nonce:${nonce}`, `x-api-timestamp:${ts}`].join("\n") + "\n";
const url = `https://api.kingdee.com/jdyconnector/app_management/push_app_authorize?${qs}`;
const res = await fetch(url, { method: "POST", body: "{}", headers: {
  "Content-Type": "application/json", "X-Api-ClientID": cfg.clientId, "X-Api-Auth-Version": "2.0",
  "X-Api-TimeStamp": ts, "X-Api-Nonce": nonce, "X-Api-SignHeaders": "X-Api-TimeStamp,X-Api-Nonce",
  "X-Api-Signature": b64(hmacHex(cfg.clientSecret, plain)), "X-GW-Router-Addr": cfg.domain } });
const j = await res.json();
const masked = JSON.parse(JSON.stringify(j, (k, v) => (/secret|key/i.test(k) && typeof v === "string" && v.length > 6 ? "***" : v)));
console.log(JSON.stringify(masked, null, 1));
