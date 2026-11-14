const base = "http://127.0.0.1:8090/api";
const res = await fetch(base + "/auth/login", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({userName:"admin",password:"123456",factory:"TEST"}) });
const j = await res.json();
console.log("keys:", Object.keys(j));
console.log(JSON.stringify(j).slice(0, 600));
const d = j.data || {};
const token = d.token || (d.data && d.data.token);
console.log("token?", !!token, "factory?", d.factory, d.database, d.ledger);
if (token) {
  const p = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString("utf8"));
  console.log("jwt claims:", JSON.stringify(p).slice(0, 300));
}
