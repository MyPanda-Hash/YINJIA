const BASE = "http://36.140.66.163:8090/api";
async function post(path, body, token) {
  const res = await fetch(BASE + path, { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8", ...(token ? { Authorization: "Bearer " + token } : {}) }, body: JSON.stringify(body) });
  const j = await res.json();
  if (j.code !== 200) throw new Error(path + " → " + j.code + " " + j.message);
  return j.data;
}
const login = await post("/auth/login", { userName: "admin", password: "123456", factory: "YINJIA-MES" });
const t = login.token;
const out = [];
for (const no of ["YJ-XH-001", "YJ-TJHZ-001", "YJ-HKB-001", "YJ-YCYX-020"]) {
  const d = await post("/px/queryFormDataList", { panelCode: "INV", condition: {}, keyword: no, pageNo: 1, pageSize: 5 }, t);
  const rows = [];
  for (const r of (d.list || [])) for (const x of ((r.detail && r.detail.inv) || [])) rows.push(x);
  const hit = rows.find((x) => String(x["存货编码"] || "").trim() === no);
  console.log(no + " | MES bs_inv.来料检验 = " + (hit ? JSON.stringify(hit["来料检验"]) : "未命中") + (hit ? " | 所属类别=" + hit["所属类别"] : ""));
}
