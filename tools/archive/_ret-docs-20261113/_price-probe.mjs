const BASE = "http://127.0.0.1:8090";
const login = await (await fetch(`${BASE}/api/auth/login`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({userName:"admin",password:"123456",factory:"YJ_TEST"}) })).json();
const token = login.data.token;
const r = await (await fetch(`${BASE}/api/px/callButton`, { method:"POST", headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},
  body: JSON.stringify({ panelCode:"MATERIAL_RET", buttonName:"保存", formData:{ 单据日期:"2026-11-13", 业务类型:"生产退料", 工单号:"GD-PRICE-TEST", 工单行号:2, 备注:"单价映射测试",
   detail:{ items:[{ 材料编码:"YJ-KBL-012", 材料名称:"PP棉", 数量:2, 单价:7, 金额:14, 计量单位:"个", 仓库编码:"CK00006", 仓库:"华北工控仓" }] } }, buttonParam:{} }) })).json();
console.log(JSON.stringify(r).slice(0,300));
const no = r?.data?.编号 || "";
if (no) {
  const q = await (await import("../../../deploy/node_modules/mssql/index.js")).default.connect({ server:"127.0.0.1",port:1433,database:"HSDZ_MES_TEST",user:"yinjia",password:"Yinjia@2026",options:{encrypt:false,trustServerCertificate:true} });
  const head = (await q.request().query(`SELECT 加工单号, 工单行号 FROM bd_material_ret WHERE 单据编号=N'${no}'`)).recordset[0];
  const line = (await q.request().query(`SELECT 数量, 单价, 金额 FROM bl_material_ret WHERE 单据编号=N'${no}'`)).recordset[0];
  console.log("doc", no, "head", JSON.stringify(head), "line", JSON.stringify(line));
  await q.close();
}
