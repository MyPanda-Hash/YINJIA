const BASE = "http://36.140.66.163:8090/api";
async function post(path, body, token) {
  const res = await fetch(BASE + path, { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8", ...(token ? { Authorization: "Bearer " + token } : {}) }, body: JSON.stringify(body) });
  const j = await res.json();
  if (j.code !== 200) throw new Error(path + " → " + j.code + " " + j.message);
  return j.data;
}
const login = await post("/auth/login", { userName: "admin", password: "123456", factory: "YINJIA-MES" });
const t = login.token;
for (const no of ["YJ-XH-001", "YJ-TJHZ-001", "YJ-HKB-001", "YJ-YCYX-020"]) {
  const d = await post("/px/queryFormDataList", { panelCode: "INV", condition: {}, keyword: no, pageNo: 1, pageSize: 5 }, t);
  const r = (d.list || []).find((x) => String(x["存货编码"] ?? x["商品编码"] ?? "").trim() === no) || (d.list || [])[0];
  console.log(no + " → " + (r ? JSON.stringify({ 存货编码: r["存货编码"], 存货名称: r["存货名称"], 来料检验: r["来料检验"], 是否来料检验: r["是否来料检验"] }) : "未查到"));
}
