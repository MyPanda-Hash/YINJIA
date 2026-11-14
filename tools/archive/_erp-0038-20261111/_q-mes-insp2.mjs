const BASE = "http://36.140.66.163:8090/api";
async function post(path, body, token) {
  const res = await fetch(BASE + path, { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8", ...(token ? { Authorization: "Bearer " + token } : {}) }, body: JSON.stringify(body) });
  const j = await res.json();
  if (j.code !== 200) throw new Error(path + " → " + j.code + " " + j.message);
  return j.data;
}
const login = await post("/auth/login", { userName: "admin", password: "123456", factory: "YINJIA-MES" });
const t = login.token;
const d = await post("/px/queryFormDataList", { panelCode: "INV", condition: {}, keyword: "YJ-XH-001", pageNo: 1, pageSize: 3 }, t);
console.log("totalSize=" + d.totalSize);
const r = (d.list || [])[0] || {};
console.log("首行键: " + Object.keys(r).join(","));
console.log(JSON.stringify(r).slice(0, 900));
