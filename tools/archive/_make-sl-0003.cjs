// _make-sl-0003.cjs — 建一张已保存的送料暂收测试单(左栏切换验证上下文)
const BASE = 'http://127.0.0.1:8090/api';
async function main() {
  const login = await fetch(BASE + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: 'admin', password: '123456' }),
  }).then((r) => r.json());
  const H = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + login.data.token };
  const body = {
    panelCode: 'SL_RECV', buttonName: '保存',
    formData: {
      单据日期: '2026-09-15', 供应商: 'E2E测试供应商', 数量: 30,
      detail: { items: [{ 物料编码: 'CL005', 物料名称: '包装木箱', 型号: '1200x800', 数量: 30, 单价: 5, 金额: 150, 备注: '左栏切换验证用' }] },
    },
  };
  const r = await fetch(BASE + '/px/callButton', { method: 'POST', headers: H, body: JSON.stringify(body) }).then((x) => x.json());
  console.log(JSON.stringify(r.data ?? r));
}
main().catch((e) => { console.error(e); process.exit(1); });
